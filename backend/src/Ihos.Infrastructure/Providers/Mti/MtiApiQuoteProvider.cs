using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Ihos.Application.Common.Interfaces;
using Ihos.Application.Providers;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Infrastructure.Caching;
using Microsoft.Extensions.Logging;
using Polly.CircuitBreaker;
using Polly.Timeout;

namespace Ihos.Infrastructure.Providers.Mti;

/// <summary>
/// MTI (Muang Thai Insurance) live-quote adapter. Calls
/// <c>POST /MTIMotor/GetCoverage</c> and maps the <c>Coverages[]</c> array to
/// canonical <see cref="InsurancePlan"/> instances (in-memory only — not persisted).
///
/// MTI request encoding uses PascalCase JSON. Vehicle parameters are derived from the
/// canonical <see cref="VehicleModel"/> via <c>VehicleModelMapping</c> on the MTI company
/// (Constitution Principle III — Mapping-First).
/// </summary>
public sealed class MtiApiQuoteProvider : IInsurerQuoteProvider
{
    /// <summary>MTI short-code in <c>insurance_companies</c>.</summary>
    public const string CompanyShortCode = "MTI";

    /// <summary>
    /// Magic value for the <c>Fund</c> field. ⚠️ Confirmed by MTI-ITDEV via email 2026-05-13.
    /// Sending <c>0</c> causes MTI to return an empty <c>Coverages[]</c> array silently — they
    /// interpret it as "sum insured = 0 baht". <c>-1</c> means "all funds". Not documented in
    /// the official MTI spec; encapsulated here so callers never deal with it.
    /// </summary>
    private const int CoverageFundMagicValue = -1;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        // MTI uses PascalCase (e.g. "MakeCode", "Coverages") — leave property names verbatim.
        PropertyNamingPolicy = null,
        PropertyNameCaseInsensitive = true,
    };

    private readonly MtiHttpClient _http;
    private readonly IInsuranceCompanyRepository _companies;
    private readonly IVehicleModelRepository _vehicles;
    private readonly IVehicleModelMappingRepository _mappings;
    private readonly QuoteCacheService _cache;
    private readonly ILogger<MtiApiQuoteProvider> _logger;

    public MtiApiQuoteProvider(
        MtiHttpClient http,
        IInsuranceCompanyRepository companies,
        IVehicleModelRepository vehicles,
        IVehicleModelMappingRepository mappings,
        QuoteCacheService cache,
        ILogger<MtiApiQuoteProvider> logger)
    {
        _http = http;
        _companies = companies;
        _vehicles = vehicles;
        _mappings = mappings;
        _cache = cache;
        _logger = logger;
    }

    public string ShortCode => CompanyShortCode;

    public async Task<ProviderQuoteResult> GetQuoteAsync(
        ProviderQuoteRequest request, CancellationToken cancellationToken)
    {
        var sw = Stopwatch.StartNew();

        var company = (await _companies.GetAllActiveAsync(cancellationToken))
            .FirstOrDefault(c => string.Equals(c.ShortCode, CompanyShortCode, StringComparison.OrdinalIgnoreCase));

        if (company is null)
        {
            sw.Stop();
            return ProviderQuoteResult.Failure(CompanyShortCode, "MTI",
                ProviderQuoteStatus.Failed, "MTI company row not configured", sw.ElapsedMilliseconds);
        }

        // Resolve vehicle attributes (MakeCode, Family, EngineSize) from canonical
        // VehicleModel via mapping table. If the mapping is missing, we cannot quote.
        var vehicle = await _vehicles.GetByIdAsync(request.VehicleModelId, cancellationToken);
        if (vehicle is null)
        {
            sw.Stop();
            return ProviderQuoteResult.Failure(CompanyShortCode, company.Name,
                ProviderQuoteStatus.NoMatch,
                $"Vehicle model {request.VehicleModelId} not found", sw.ElapsedMilliseconds);
        }

        // For MVP we expect mapping data on the VehicleModel itself (MakeCode = make.Name,
        // Family = model.Name, EngineSize parsed from EngineCC). When a richer
        // VehicleModelMapping row exists, prefer that.
        var (makeCode, family, engineSize) = ResolveMtiVehicleParams(vehicle);

        var payload = new
        {
            ClassNo = MapPlanTypeToClassNo(request.PlanType),
            MakeCode = makeCode,
            Family = family,
            YearGroupId = request.RegistrationYear,
            EngineSize = engineSize,
            FuelType = "เบนซิน", // TODO: derive from VehicleModel when available
            PrvId = 0,
            VehCode = "110",       // 110 = passenger car. TODO: derive from vehicle type
            DriverFlag = "N",
            Fund = CoverageFundMagicValue,
        };

        // ── SWR cache lookup (Phase 7) ───────────────────────────────────────────
        // Fresh hit (< 15 min) → return immediately, isStale=false, came from cache
        // Stale hit (< 24 h) → return immediately, isStale=true, schedule bg refresh
        // Miss → live call below, cache result on success
        var cacheKey = QuoteCacheMapper.BuildKey(CompanyShortCode, request);

        try
        {
            var lookup = await _cache.GetOrCallAsync<QuoteCachePayload>(cacheKey,
                async innerCt => await CallMtiLiveAsync(payload, company, vehicle, request, innerCt),
                cancellationToken);

            sw.Stop();
            var plans = QuoteCacheMapper.ToInsurancePlans(lookup.Value);
            return ProviderQuoteResult.Success(CompanyShortCode, company.Name, plans,
                sw.ElapsedMilliseconds,
                dataSource: DataSourceType.Api,
                isStale: lookup.IsStale);
        }
        catch (TimeoutRejectedException) { return await StaleFallbackOrFailureAsync(
            cacheKey, company, sw, ProviderQuoteStatus.Timeout, "MTI request timed out", cancellationToken); }
        catch (BrokenCircuitException)   { return await StaleFallbackOrFailureAsync(
            cacheKey, company, sw, ProviderQuoteStatus.BreakerOpen, "MTI circuit breaker open", cancellationToken); }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            sw.Stop();
            return ProviderQuoteResult.Failure(CompanyShortCode, company.Name,
                ProviderQuoteStatus.Timeout, "Cancelled", sw.ElapsedMilliseconds,
                dataSource: DataSourceType.Api);
        }
        catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.RequestTimeout)
        {
            return await StaleFallbackOrFailureAsync(cacheKey, company, sw,
                ProviderQuoteStatus.Timeout, ex.Message, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MTI GetCoverage failed");
            return await StaleFallbackOrFailureAsync(cacheKey, company, sw,
                ProviderQuoteStatus.Failed, ex.Message, cancellationToken);
        }
    }

    /// <summary>
    /// Single live MTI call — extracted so the SWR cache wrapper can invoke it on miss
    /// and on background refresh. Returns the cache-friendly <see cref="QuoteCachePayload"/>;
    /// throws on HTTP/transport failure so the cache layer can fall back to stale data.
    /// </summary>
    private async Task<QuoteCachePayload> CallMtiLiveAsync(
        object payload, InsuranceCompany company, VehicleModel vehicle,
        ProviderQuoteRequest request, CancellationToken ct)
    {
        using var resp = await _http.HttpClient.PostAsJsonAsync(
            "MTIMotor/GetCoverage", payload, JsonOpts, ct);

        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync(ct);
            _logger.LogWarning("MTI GetCoverage returned {Status}: {Body}", resp.StatusCode,
                body.Length > 500 ? body[..500] : body);
            throw new HttpRequestException(
                $"MTI returned HTTP {(int)resp.StatusCode}", null, resp.StatusCode);
        }

        var raw = await resp.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(raw);
        var plans = MapCoveragesToPlans(doc.RootElement, company, vehicle, request);

        if (plans.Count == 0)
        {
            _logger.LogInformation(
                "MTI returned 0 plans. Request payload: {Payload}. Response head: {Head}",
                JsonSerializer.Serialize(payload, JsonOpts),
                raw.Length > 400 ? raw[..400] : raw);
        }

        return QuoteCacheMapper.ToPayload(
            CompanyShortCode, company.Name, company.Id, vehicle, plans);
    }

    /// <summary>
    /// Last-resort fallback: live call failed — try a stale cache entry (up to 24 h old).
    /// If found, return Success with isStale=true; otherwise return the original failure
    /// status. This is the "API down → still show something useful" path.
    /// </summary>
    private async Task<ProviderQuoteResult> StaleFallbackOrFailureAsync(
        string cacheKey, InsuranceCompany company, Stopwatch sw,
        ProviderQuoteStatus failureStatus, string failureMessage, CancellationToken ct)
    {
        var stale = await _cache.TryGetStaleAsync<QuoteCachePayload>(cacheKey, ct);
        sw.Stop();
        if (stale is not null)
        {
            _logger.LogInformation("MTI live call failed ({Status}) — serving stale cache",
                failureStatus);
            return ProviderQuoteResult.Success(CompanyShortCode, company.Name,
                QuoteCacheMapper.ToInsurancePlans(stale), sw.ElapsedMilliseconds,
                dataSource: DataSourceType.Api,
                isStale: true);
        }
        return ProviderQuoteResult.Failure(CompanyShortCode, company.Name,
            failureStatus, failureMessage, sw.ElapsedMilliseconds,
            dataSource: DataSourceType.Api);
    }

    private (string makeCode, string family, int engineSize) ResolveMtiVehicleParams(
        VehicleModel vehicle)
    {
        // Best-effort defaults from the canonical model. Refined once VehicleModelMapping for
        // MTI is populated (master sync — Phase 4).
        var makeCode = vehicle.Make?.Name?.ToUpperInvariant()
            .Substring(0, Math.Min(4, vehicle.Make.Name.Length)) ?? string.Empty;
        var family = vehicle.Name.ToUpperInvariant();

        int engineSize = 0;
        if (!string.IsNullOrWhiteSpace(vehicle.EngineCC))
        {
            // VehicleModel.EngineCC may be stored as either:
            //   • cc directly ("1500", "1800") — values ≥ 100
            //   • litres ("1.5", "1.8")        — values < 100
            // Detect by magnitude and convert litres → cc when needed.
            if (decimal.TryParse(vehicle.EngineCC, System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var raw))
            {
                engineSize = raw < 100m
                    ? (int)Math.Round(raw * 1000m)
                    : (int)Math.Round(raw);
            }
        }

        return (makeCode, family, engineSize);
    }

    private static string MapPlanTypeToClassNo(PlanType planType) => planType switch
    {
        PlanType.Type1 => "1",
        PlanType.Type2 or PlanType.Type2Plus => "2",
        PlanType.Type3 or PlanType.Type3Plus => "3",
        _ => "0",
    };

    /// <summary>
    /// Maps MTI <c>Coverages[]</c> entries to in-memory <see cref="InsurancePlan"/> instances.
    /// Plans are NOT persisted — they are returned to the search aggregator and serialized
    /// directly to the response. Field mapping is best-effort against the MTI sample shape
    /// described in <c>restclient/mti-car.http</c>; refine once we capture live samples.
    /// </summary>
    private static IReadOnlyList<InsurancePlan> MapCoveragesToPlans(
        JsonElement root, InsuranceCompany company, VehicleModel vehicle,
        ProviderQuoteRequest request)
    {
        if (!root.TryGetProperty("Coverages", out var coverages)
            || coverages.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<InsurancePlan>();
        }

        var plans = new List<InsurancePlan>();
        foreach (var cov in coverages.EnumerateArray())
        {
            // Field mapping verified against MTI UAT response 2026-05-25:
            //   NetPremium = total premium (incl. stamp+vat)
            //   VehiclePrice / ODSI_PerTime / FTSI = sum insured (all equal in samples)
            //   WorkShop = Thai string "ซ่อมอู่" (garage) / "ซ่อมห้าง" (dealer)
            //   ClassNo = integer (1..9)
            //   TPBI_PerPerson / TPBI_PerTime / TPPD = third-party limits
            var planType = MapClassNoToPlanType(ReadString(cov, "ClassNo", "ClassId"))
                ?? request.PlanType;

            var premium = GetDecimal(cov, "NetPremium")
                ?? GetDecimal(cov, "Gross")
                ?? 0m;

            var sumInsured = GetDecimal(cov, "VehiclePrice")
                ?? GetDecimal(cov, "ODSI_PerTime")
                ?? GetDecimal(cov, "FTSI")
                ?? request.SumInsured;

            var workShop = GetString(cov, "WorkShop") ?? "";
            var repairType = workShop.Contains("ห้าง", StringComparison.Ordinal)
                ? RepairType.Dealer
                : RepairType.Garage;

            plans.Add(new InsurancePlan
            {
                Id = Guid.NewGuid(),                  // transient — not persisted
                CompanyId = company.Id,
                Company = company,
                VehicleModelId = vehicle.Id,
                VehicleModel = vehicle,
                PlanType = planType,
                RepairType = repairType,
                RegistrationYear = request.RegistrationYear,
                SumInsured = sumInsured,
                PremiumTotal = premium,
                ExcessAmount = GetDecimal(cov, "Excess") ?? 0m,
                CoverageDetails = "{}",
                Remarks = GetString(cov, "PackageDescription")
                    ?? GetString(cov, "CampaignTitle"),
                RegionGroup = string.Empty,
                ExternalPackageId = GetString(cov, "PackageCode") ?? string.Empty,
                TpbiPerPerson    = GetDecimal(cov, "TPBI_PerPerson"),
                TpbiPerAccident  = GetDecimal(cov, "TPBI_PerTime"),
                Tppd             = GetDecimal(cov, "TPPD"),
                FireTheft        = GetDecimal(cov, "FTSI"),
                IsPublished = true,
            });
        }
        return plans;
    }

    private static PlanType? MapClassNoToPlanType(string? classNo) => classNo switch
    {
        "1" or "9" => PlanType.Type1,
        "2" => PlanType.Type2,
        "3" => PlanType.Type3,
        "4" or "6" or "8" => PlanType.Type2Plus,
        "5" or "7" => PlanType.Type3Plus,
        _ => null,
    };

    private static string? GetString(JsonElement el, string name)
        => el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString()
            : null;

    /// <summary>
    /// Reads a string from the first matching property, coercing numbers to their decimal
    /// representation. Useful for fields like <c>ClassNo</c> that MTI returns as either
    /// integer or string depending on the endpoint version.
    /// </summary>
    private static string? ReadString(JsonElement el, params string[] names)
    {
        foreach (var n in names)
        {
            if (!el.TryGetProperty(n, out var v)) continue;
            return v.ValueKind switch
            {
                JsonValueKind.String => v.GetString(),
                JsonValueKind.Number => v.GetRawText(),
                _ => null,
            };
        }
        return null;
    }

    private static decimal? GetDecimal(JsonElement el, string name)
    {
        if (!el.TryGetProperty(name, out var v)) return null;
        return v.ValueKind switch
        {
            JsonValueKind.Number => v.TryGetDecimal(out var d) ? d : null,
            JsonValueKind.String when decimal.TryParse(v.GetString(),
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var d) => d,
            _ => null,
        };
    }
}
