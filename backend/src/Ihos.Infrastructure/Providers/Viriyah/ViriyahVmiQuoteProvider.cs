using System.Diagnostics;
using System.Text.Json;
using Ihos.Application.Common.Interfaces;
using Ihos.Application.Providers;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Infrastructure.Caching;
using Microsoft.Extensions.Logging;
using Polly.CircuitBreaker;
using Polly.Timeout;

namespace Ihos.Infrastructure.Providers.Viriyah;

/// <summary>
/// Viriyah VMI (Voluntary Motor Insurance — ชั้น 1/2/3/2+/3+) quote adapter. Calls
/// <c>POST /api/policy/motor/vmi/v3/quotation</c>. Handles 401 → token refresh + single retry.
/// </summary>
public sealed class ViriyahVmiQuoteProvider : IInsurerQuoteProvider
{
    public const string CompanyShortCode = "VIRIYAH";

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private readonly ViriyahHttpClient _http;
    private readonly ViriyahTokenCache _tokens;
    private readonly IInsuranceCompanyRepository _companies;
    private readonly IVehicleModelRepository _vehicles;
    private readonly IVehicleModelMappingRepository _mappings;
    private readonly QuoteCacheService _cache;
    private readonly ILogger<ViriyahVmiQuoteProvider> _logger;

    public ViriyahVmiQuoteProvider(
        ViriyahHttpClient http,
        ViriyahTokenCache tokens,
        IInsuranceCompanyRepository companies,
        IVehicleModelRepository vehicles,
        IVehicleModelMappingRepository mappings,
        QuoteCacheService cache,
        ILogger<ViriyahVmiQuoteProvider> logger)
    {
        _http = http;
        _tokens = tokens;
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
            return ProviderQuoteResult.Failure(CompanyShortCode, "Viriyah",
                ProviderQuoteStatus.Failed, "Viriyah company row not configured",
                sw.ElapsedMilliseconds);
        }

        var vehicle = await _vehicles.GetByIdAsync(request.VehicleModelId, cancellationToken);
        if (vehicle is null)
        {
            sw.Stop();
            return ProviderQuoteResult.Failure(CompanyShortCode, company.Name,
                ProviderQuoteStatus.NoMatch,
                $"Vehicle model {request.VehicleModelId} not found", sw.ElapsedMilliseconds);
        }

        // Resolve Viriyah's exact brand/model/submodel triple via VehicleModelMapping.
        // RawName format: "BRAND|MODEL|SUBMODEL" (populated by ViriyahCsvMasterImporter).
        // Falls back to local VehicleModel fields when no mapping exists — works for vehicles
        // whose names already match Viriyah's catalog format.
        var (carBrand, carModel, carSubModel) = await ResolveViriyahTripleAsync(
            company.Id, vehicle, cancellationToken);

        var body = new
        {
            agentCode = _http.Options.AgentCode,
            energyType = "C", // C = gasoline. TODO: derive from VehicleModel
            carBrand,
            carModel,
            carSubModel,
            registrationYear = request.RegistrationYear.ToString(),
            vehicleTypeCode = new[] { "110" }, // 110 = passenger car
        };

        // ── SWR cache (Phase 7) ──────────────────────────────────────────────────
        var cacheKey = QuoteCacheMapper.BuildKey(CompanyShortCode, request);

        try
        {
            var lookup = await _cache.GetOrCallAsync<QuoteCachePayload>(cacheKey,
                async innerCt => await CallViriyahLiveAsync(body, company, vehicle, request, innerCt),
                cancellationToken);

            sw.Stop();
            var plans = QuoteCacheMapper.ToInsurancePlans(lookup.Value);
            return ProviderQuoteResult.Success(CompanyShortCode, company.Name, plans,
                sw.ElapsedMilliseconds,
                dataSource: DataSourceType.Api,
                isStale: lookup.IsStale);
        }
        catch (TimeoutRejectedException) { return await StaleFallbackOrFailureAsync(
            cacheKey, company, sw, ProviderQuoteStatus.Timeout, "Viriyah VMI request timed out", cancellationToken); }
        catch (BrokenCircuitException)   { return await StaleFallbackOrFailureAsync(
            cacheKey, company, sw, ProviderQuoteStatus.BreakerOpen, "Viriyah VMI circuit breaker open", cancellationToken); }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            sw.Stop();
            return ProviderQuoteResult.Failure(CompanyShortCode, company.Name,
                ProviderQuoteStatus.Timeout, "Cancelled", sw.ElapsedMilliseconds,
                dataSource: DataSourceType.Api);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Viriyah VMI quotation failed");
            return await StaleFallbackOrFailureAsync(cacheKey, company, sw,
                ProviderQuoteStatus.Failed, ex.Message, cancellationToken);
        }
    }

    /// <summary>
    /// Single live Viriyah VMI quote — extracted so the SWR cache can wrap it. Handles
    /// 401 → token refresh + single retry. Throws on transport / non-2xx failure so the
    /// cache layer can fall back to stale data.
    /// </summary>
    private async Task<QuoteCachePayload> CallViriyahLiveAsync(
        object body, InsuranceCompany company, VehicleModel vehicle,
        ProviderQuoteRequest request, CancellationToken ct)
    {
        for (var attempt = 1; attempt <= 2; attempt++)
        {
            var token = await _tokens.GetTokenAsync(ct);
            using var req = ViriyahQuoteRequestBuilder.Build(
                "api/policy/motor/vmi/v3/quotation", body, token, _http.Options);
            using var resp = await _http.HttpClient.SendAsync(req, ct);

            if (resp.StatusCode == System.Net.HttpStatusCode.Unauthorized && attempt == 1)
            {
                _logger.LogInformation("Viriyah VMI returned 401 — refreshing token and retrying");
                _tokens.Invalidate();
                continue;
            }

            if (!resp.IsSuccessStatusCode)
            {
                var text = await resp.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("Viriyah VMI quotation returned {Status}: {Body}",
                    resp.StatusCode, text.Length > 500 ? text[..500] : text);
                throw new HttpRequestException(
                    $"Viriyah returned HTTP {(int)resp.StatusCode}", null, resp.StatusCode);
            }

            using var doc = JsonDocument.Parse(await resp.Content.ReadAsStreamAsync(ct));
            var plans = MapVmiResponseToPlans(doc.RootElement, company, vehicle, request);
            return QuoteCacheMapper.ToPayload(
                CompanyShortCode, company.Name, company.Id, vehicle, plans);
        }

        throw new InvalidOperationException("Auth retry exhausted");
    }

    /// <summary>
    /// Live call failed — try a stale cache entry (up to 24 h old). If found, return
    /// Success with isStale=true so the UI can show "Cached" badge. Else return the
    /// original failure status.
    /// </summary>
    private async Task<ProviderQuoteResult> StaleFallbackOrFailureAsync(
        string cacheKey, InsuranceCompany company, Stopwatch sw,
        ProviderQuoteStatus failureStatus, string failureMessage, CancellationToken ct)
    {
        var stale = await _cache.TryGetStaleAsync<QuoteCachePayload>(cacheKey, ct);
        sw.Stop();
        if (stale is not null)
        {
            _logger.LogInformation("Viriyah live call failed ({Status}) — serving stale cache",
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

    /// <summary>
    /// Looks up the Viriyah-specific brand/model/submodel strings for a canonical
    /// VehicleModel via <see cref="VehicleModelMapping"/>. Returns the first matching
    /// mapping; falls back to the raw VehicleModel fields when no mapping is registered
    /// (best-effort — Viriyah may still respond "Quotation not found" in that case).
    /// </summary>
    private async Task<(string brand, string model, string submodel)> ResolveViriyahTripleAsync(
        Guid companyId, VehicleModel vehicle, CancellationToken ct)
    {
        var mappings = await _mappings.GetByCompanyAsync(companyId, ct);
        var match = mappings
            .Where(m => m.CanonicalModelId == vehicle.Id &&
                        m.RawName.Contains(ViriyahCsvMasterImporter.Separator))
            .Select(m => m.RawName)
            .FirstOrDefault();

        if (match is not null)
        {
            var parts = match.Split(ViriyahCsvMasterImporter.Separator);
            if (parts.Length >= 3)
                return (parts[0], parts[1], parts[2]);
        }

        // Fallback — uppercase brand to match Viriyah's catalog convention.
        return (
            (vehicle.Make?.Name ?? string.Empty).ToUpperInvariant(),
            vehicle.Name.ToUpperInvariant(),
            vehicle.SubModel ?? string.Empty);
    }

    /// <summary>
    /// Maps Viriyah VMI quotation response to <see cref="InsurancePlan"/> instances. Field
    /// mapping is best-effort against the published spec; refine once we capture live samples.
    /// </summary>
    private static IReadOnlyList<InsurancePlan> MapVmiResponseToPlans(
        JsonElement root, InsuranceCompany company, VehicleModel vehicle,
        ProviderQuoteRequest request)
    {
        // Viriyah VMI typically returns either { packages: [...] } or { data: { packages: [...] } }
        // Locate the array flexibly.
        var packages = LocateArray(root, "packages", "data", "plans", "items");
        if (!packages.HasValue) return Array.Empty<InsurancePlan>();

        var plans = new List<InsurancePlan>();
        foreach (var pkg in packages.Value.EnumerateArray())
        {
            var premium = ReadDecimal(pkg, "premiumTotal", "premium", "totalPremium") ?? 0m;
            var sumInsured = ReadDecimal(pkg, "sumInsured") ?? request.SumInsured;
            var planType = ParsePlanType(ReadString(pkg, "planType", "classCode", "class"))
                ?? request.PlanType;

            plans.Add(new InsurancePlan
            {
                Id = Guid.NewGuid(),
                CompanyId = company.Id,
                Company = company,
                VehicleModelId = vehicle.Id,
                VehicleModel = vehicle,
                PlanType = planType,
                RepairType = (ReadString(pkg, "repairType") ?? "").Equals("dealer",
                                StringComparison.OrdinalIgnoreCase)
                    ? RepairType.Dealer
                    : RepairType.Garage,
                RegistrationYear = request.RegistrationYear,
                SumInsured = sumInsured,
                PremiumTotal = premium,
                ExcessAmount = ReadDecimal(pkg, "excess", "deductible") ?? request.Deductible,
                CoverageDetails = "{}",
                Remarks = ReadString(pkg, "packageName", "name", "description"),
                ExternalPackageId = ReadString(pkg, "packageCode", "code") ?? string.Empty,
                RegionGroup = string.Empty,
                IsPublished = true,
            });
        }
        return plans;
    }

    private static JsonElement? LocateArray(JsonElement root, params string[] paths)
    {
        foreach (var name in paths)
        {
            if (root.TryGetProperty(name, out var prop))
            {
                if (prop.ValueKind == JsonValueKind.Array) return prop;
                if (prop.ValueKind == JsonValueKind.Object)
                {
                    var inner = LocateArray(prop, paths);
                    if (inner.HasValue) return inner;
                }
            }
        }
        return null;
    }

    private static PlanType? ParsePlanType(string? s) => (s ?? "").Trim() switch
    {
        "1" or "Type1" or "ชั้น1" => PlanType.Type1,
        "2" or "Type2" or "ชั้น2" => PlanType.Type2,
        "3" or "Type3" or "ชั้น3" => PlanType.Type3,
        "2+" or "Type2Plus" or "2Plus" => PlanType.Type2Plus,
        "3+" or "Type3Plus" or "3Plus" => PlanType.Type3Plus,
        _ => null,
    };

    private static string? ReadString(JsonElement el, params string[] names)
    {
        foreach (var n in names)
        {
            if (el.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.String)
                return v.GetString();
        }
        return null;
    }

    private static decimal? ReadDecimal(JsonElement el, params string[] names)
    {
        foreach (var n in names)
        {
            if (!el.TryGetProperty(n, out var v)) continue;
            switch (v.ValueKind)
            {
                case JsonValueKind.Number when v.TryGetDecimal(out var d): return d;
                case JsonValueKind.String when decimal.TryParse(v.GetString(),
                        System.Globalization.NumberStyles.Any,
                        System.Globalization.CultureInfo.InvariantCulture, out var d2): return d2;
            }
        }
        return null;
    }
}
