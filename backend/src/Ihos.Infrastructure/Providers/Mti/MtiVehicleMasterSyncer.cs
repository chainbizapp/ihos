using System.Diagnostics;
using System.Net.Http.Json;
using System.Text.Json;
using Ihos.Application.Common.Interfaces;
using Ihos.Application.Providers;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Ihos.Infrastructure.Providers.Mti;

/// <summary>
/// MTI vehicle master syncer. MVP scope: enumerate MTI's Brand → Model catalog and
/// register <see cref="VehicleModelMapping"/> rows for matching local
/// <see cref="VehicleModel"/>s. RawName format is
/// <c>MAKECODE|FAMILY</c> (4-char + 15-char per MTI spec). Deeper attributes
/// (Year, EngineSize, FuelType) stay derived per quote call — they have far too high a
/// cardinality to enumerate exhaustively in MVP, and MTI's GetCoverage tolerates direct
/// values without pre-registration.
/// </summary>
public sealed class MtiVehicleMasterSyncer : IVehicleMasterSyncer
{
    public const string CompanyShortCode = "MTI";

    /// <summary>RawName separator for MTI mapping rows.</summary>
    public const char Separator = '|';

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = null,
        PropertyNameCaseInsensitive = true,
    };

    private readonly MtiHttpClient _http;
    private readonly Persistence.ApplicationDbContext _db;
    private readonly ILogger<MtiVehicleMasterSyncer> _logger;

    public MtiVehicleMasterSyncer(
        MtiHttpClient http,
        Persistence.ApplicationDbContext db,
        ILogger<MtiVehicleMasterSyncer> logger)
    {
        _http = http;
        _db = db;
        _logger = logger;
    }

    public string ShortCode => CompanyShortCode;

    public async Task<SyncOutcome> SyncAsync(
        SyncTriggerType trigger, Guid? actorUserId, CancellationToken cancellationToken)
    {
        var sw = Stopwatch.StartNew();

        var company = await _db.InsuranceCompanies
            .FirstOrDefaultAsync(c => c.ShortCode == CompanyShortCode, cancellationToken);
        if (company is null)
        {
            sw.Stop();
            return new SyncOutcome(SyncStatus.Failed, 0, 0, 0, 0, sw.ElapsedMilliseconds,
                "MTI InsuranceCompany row missing.");
        }

        List<MtiBrand> brands;
        try
        {
            brands = await GetBrandsAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogError(ex, "MTI GetBrand failed");
            return new SyncOutcome(SyncStatus.Failed, 0, 0, 0, 0, sw.ElapsedMilliseconds,
                $"MTI GetBrand failed: {ex.Message}");
        }

        var localMakes = await _db.VehicleMakes
            .ToDictionaryAsync(m => m.Name.ToUpperInvariant(), m => m.Id, cancellationToken);

        var localModels = (await _db.VehicleModels
            .AsNoTracking()
            .Where(m => !m.IsDeleted)
            .ToListAsync(cancellationToken))
            .GroupBy(m => m.MakeId)
            .ToDictionary(g => g.Key, g => g.ToList());

        // Include soft-deleted rows: the unique constraint on (CompanyId, RawName) does NOT
        // filter on IsDeleted, so we must treat soft-deleted rows as occupying that key —
        // otherwise the upsert path would attempt to insert a "new" row with the same
        // RawName and the DB would reject with a duplicate-key violation, which aborts the
        // entire sync transaction.
        var existing = await _db.VehicleModelMappings
            .IgnoreQueryFilters()
            .Where(m => m.CompanyId == company.Id)
            .ToDictionaryAsync(m => m.RawName, m => m, cancellationToken);

        int inserted = 0, updated = 0, errors = 0;
        var seen = new HashSet<string>();

        // ── Phase 1: pre-filter brands to ones that exist in local DB ──────────
        // Brands MTI knows about but we don't carry locally are skipped without an HTTP
        // call, so we don't waste round-trips on data we'd discard anyway.
        var brandsToFetch = brands
            .Select(b =>
            {
                var key = (b.Description ?? "").ToUpperInvariant();
                if (!localMakes.TryGetValue(key, out var makeId)) return ((MtiBrand brand, Guid makeId, List<VehicleModel> candidates)?)null;
                if (!localModels.TryGetValue(makeId, out var candidates) || candidates.Count == 0) return null;
                return (b, makeId, candidates);
            })
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .ToList();

        _logger.LogInformation(
            "MTI sync: {Matched} of {Total} brands match local DB — fetching models in parallel",
            brandsToFetch.Count, brands.Count);

        // ── Phase 2: parallel HTTP fetch (5 in flight) ─────────────────────────
        // GetModelsAsync is pure HTTP — safe to run in parallel as long as we don't touch
        // the shared EF DbContext from these tasks. Results are collected into a thread-safe
        // bag, then Phase 3 does single-threaded DB upserts.
        const int MaxParallelism = 5;
        using var gate = new SemaphoreSlim(MaxParallelism);
        var bag = new System.Collections.Concurrent.ConcurrentBag<(MtiBrand brand, List<VehicleModel> candidates, List<MtiModel>? models, Exception? error)>();

        var tasks = brandsToFetch.Select(async tuple =>
        {
            await gate.WaitAsync(cancellationToken);
            try
            {
                var models = await GetModelsAsync(tuple.brand.MakeCode, cancellationToken);
                bag.Add((tuple.brand, tuple.candidates, models, null));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "MTI GetModel failed for {MakeCode}", tuple.brand.MakeCode);
                bag.Add((tuple.brand, tuple.candidates, null, ex));
            }
            finally
            {
                gate.Release();
            }
        }).ToList();

        await Task.WhenAll(tasks);

        // ── Phase 3: single-threaded DB upsert (DbContext is NOT thread-safe) ──
        foreach (var (brand, candidates, mtiModels, error) in bag)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (error is not null || mtiModels is null) { errors++; continue; }

            foreach (var mtiModel in mtiModels)
            {
                var family = (mtiModel.Family ?? mtiModel.ModelCode ?? "").Trim();
                if (string.IsNullOrEmpty(family)) continue;

                var match = candidates.FirstOrDefault(m =>
                    string.Equals(m.Name.ToUpperInvariant(), family, StringComparison.Ordinal));
                if (match is null) continue;

                var rawName = $"{brand.MakeCode}{Separator}{family}";
                if (!seen.Add(rawName)) continue;

                if (existing.TryGetValue(rawName, out var row))
                {
                    var changed = false;
                    // Resurrect soft-deleted rows — MTI catalog says this mapping should
                    // exist, so we restore it instead of leaving a phantom DELETE in place.
                    if (row.IsDeleted)
                    {
                        row.IsDeleted = false;
                        changed = true;
                    }
                    if (row.CanonicalModelId != match.Id)
                    {
                        row.CanonicalModelId = match.Id;
                        changed = true;
                    }
                    if (changed) updated++;
                }
                else
                {
                    _db.VehicleModelMappings.Add(new VehicleModelMapping
                    {
                        Id = Guid.NewGuid(),
                        CompanyId = company.Id,
                        RawName = rawName,
                        CanonicalModelId = match.Id,
                        IsAutoSuggested = true,
                    });
                    inserted++;
                }
            }
        }

        await _db.SaveChangesAsync(cancellationToken);
        sw.Stop();

        var status = errors == 0
            ? SyncStatus.Succeeded
            : (inserted + updated > 0 ? SyncStatus.PartialSuccess : SyncStatus.Failed);

        _logger.LogInformation(
            "MTI master sync done in {Ms} ms — inserted={Inserted} updated={Updated} errors={Errors}",
            sw.ElapsedMilliseconds, inserted, updated, errors);

        return new SyncOutcome(status, inserted, updated, 0, errors, sw.ElapsedMilliseconds,
            errors > 0 ? $"{errors} GetModel calls failed" : null);
    }

    private async Task<List<MtiBrand>> GetBrandsAsync(CancellationToken ct)
    {
        using var resp = await _http.HttpClient.PostAsJsonAsync(
            "Car/GetBrand", new { }, JsonOpts, ct);
        resp.EnsureSuccessStatusCode();
        var doc = await JsonDocument.ParseAsync(
            await resp.Content.ReadAsStreamAsync(ct), cancellationToken: ct);

        var array = LocateArray(doc.RootElement, "Brands", "Result", "Items")
            ?? (doc.RootElement.ValueKind == JsonValueKind.Array ? doc.RootElement : (JsonElement?)null);

        var result = new List<MtiBrand>();
        if (array is null) return result;
        foreach (var el in array.Value.EnumerateArray())
        {
            var code = GetString(el, "MakeCode") ?? "";
            var desc = GetString(el, "Description") ?? "";
            if (!string.IsNullOrEmpty(code))
                result.Add(new MtiBrand(code, desc));
        }
        return result;
    }

    private async Task<List<MtiModel>> GetModelsAsync(string makeCode, CancellationToken ct)
    {
        using var resp = await _http.HttpClient.PostAsJsonAsync(
            "Car/GetModel", new { MakeCode = makeCode }, JsonOpts, ct);
        resp.EnsureSuccessStatusCode();
        var doc = await JsonDocument.ParseAsync(
            await resp.Content.ReadAsStreamAsync(ct), cancellationToken: ct);

        var array = LocateArray(doc.RootElement, "Models", "Result", "Items")
            ?? (doc.RootElement.ValueKind == JsonValueKind.Array ? doc.RootElement : (JsonElement?)null);

        var result = new List<MtiModel>();
        if (array is null) return result;
        foreach (var el in array.Value.EnumerateArray())
        {
            result.Add(new MtiModel(
                ModelCode: GetString(el, "ModelCode") ?? "",
                Family: GetString(el, "Family") ?? GetString(el, "FamilyCode") ?? "",
                Description: GetString(el, "Description") ?? ""));
        }
        return result;
    }

    private static JsonElement? LocateArray(JsonElement root, params string[] names)
    {
        // If the response is already a bare array (e.g. MTI GetBrand returns [...] directly),
        // use it as-is. TryGetProperty only works on Object roots.
        if (root.ValueKind == JsonValueKind.Array) return root;
        if (root.ValueKind != JsonValueKind.Object) return null;

        foreach (var n in names)
        {
            if (root.TryGetProperty(n, out var prop) && prop.ValueKind == JsonValueKind.Array)
                return prop;
        }
        return null;
    }

    private static string? GetString(JsonElement el, string name)
        => el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString()
            : null;

    private sealed record MtiBrand(string MakeCode, string Description);
    private sealed record MtiModel(string ModelCode, string Family, string Description);
}
