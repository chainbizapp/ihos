using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;

namespace Ihos.Application.Import.Services;

public class MappingResolution
{
    public Guid? VehicleModelMappingId { get; init; }
    public Guid? PlanTypeMappingId { get; init; }
    public ImportMappingStatus MappingStatus { get; init; }
}

/// <summary>
/// Pre-loaded data for a single import batch — lets all rows resolve in-memory
/// with zero per-row DB queries.
/// </summary>
public class MappingResolverContext
{
    public required Guid CompanyId { get; init; }
    public required Guid CurrentUserId { get; init; }

    // Keyed by RawName (case-insensitive)
    public required Dictionary<string, VehicleModelMapping> VehicleMappings { get; init; }
    public required Dictionary<string, PlanTypeMapping> PlanTypeMappings { get; init; }
    public required IReadOnlyList<VehicleModel> AllModels { get; init; }

    // Auto-suggested vehicle model mappings created during this batch
    public List<VehicleModelMapping> NewAutoSuggestions { get; } = [];

    // Auto-created plan type mappings for raw names that are already canonical enum values
    public List<PlanTypeMapping> NewAutoPlanTypeMappings { get; } = [];
}

public class MappingResolverService
{
    private readonly IVehicleModelMappingRepository _vehicleMappings;
    private readonly IPlanTypeMappingRepository _planTypeMappings;
    private readonly IVehicleModelRepository _vehicleModels;

    public MappingResolverService(
        IVehicleModelMappingRepository vehicleMappings,
        IPlanTypeMappingRepository planTypeMappings,
        IVehicleModelRepository vehicleModels)
    {
        _vehicleMappings  = vehicleMappings;
        _planTypeMappings = planTypeMappings;
        _vehicleModels    = vehicleModels;
    }

    // ── Bulk path (used by import handler) ───────────────────────────────────

    /// <summary>
    /// Pre-loads all mappings and vehicle models for a company into memory.
    /// Call once per batch, then pass the context to <see cref="Resolve"/> for each row.
    /// </summary>
    public async Task<MappingResolverContext> CreateContextAsync(
        Guid companyId, Guid currentUserId, CancellationToken ct)
    {
        var vehicleMappings  = await _vehicleMappings.GetByCompanyAsync(companyId, ct);
        var planTypeMappings = await _planTypeMappings.GetByCompanyAsync(companyId, ct);
        var allModels        = await _vehicleModels.GetAllAsync(ct);

        return new MappingResolverContext
        {
            CompanyId        = companyId,
            CurrentUserId    = currentUserId,
            VehicleMappings  = vehicleMappings.ToDictionary(m => m.RawName, StringComparer.OrdinalIgnoreCase),
            PlanTypeMappings = planTypeMappings.ToDictionary(m => m.RawName, StringComparer.OrdinalIgnoreCase),
            AllModels        = allModels
        };
    }

    /// <summary>
    /// Resolves a single row entirely in-memory using the pre-loaded context.
    /// Any auto-suggested mappings are accumulated in <see cref="MappingResolverContext.NewAutoSuggestions"/>
    /// and must be flushed to DB by the caller after all rows are processed.
    /// </summary>
    public MappingResolution Resolve(
        MappingResolverContext ctx, string rawVehicleModel, string rawPlanType)
    {
        var vehicleMappingId  = ResolveVehicleModel(ctx, rawVehicleModel);
        var planTypeMappingId = ResolvePlanType(ctx, rawPlanType);

        var status = vehicleMappingId.HasValue && planTypeMappingId.HasValue
            ? ImportMappingStatus.Resolved
            : ImportMappingStatus.PendingMapping;

        return new MappingResolution
        {
            VehicleModelMappingId = vehicleMappingId,
            PlanTypeMappingId     = planTypeMappingId,
            MappingStatus         = status
        };
    }

    /// <summary>
    /// Persists any auto-suggested/auto-created mappings accumulated during
    /// <see cref="Resolve"/> calls. Call once after the row loop, before saving import records.
    /// </summary>
    public async Task FlushAutoSuggestionsAsync(MappingResolverContext ctx, CancellationToken ct)
    {
        if (ctx.NewAutoSuggestions.Count > 0)
        {
            await _vehicleMappings.AddRangeAsync(ctx.NewAutoSuggestions, ct);
            await _vehicleMappings.SaveChangesAsync(ct);
        }

        if (ctx.NewAutoPlanTypeMappings.Count > 0)
        {
            await _planTypeMappings.AddRangeAsync(ctx.NewAutoPlanTypeMappings, ct);
            await _planTypeMappings.SaveChangesAsync(ct);
        }
    }

    // ── Single-row async path (kept for other callers) ────────────────────────

    public async Task<MappingResolution> ResolveAsync(
        Guid companyId,
        string rawVehicleModel,
        string rawPlanType,
        Guid currentUserId,
        CancellationToken ct = default)
    {
        var ctx = await CreateContextAsync(companyId, currentUserId, ct);
        var result = Resolve(ctx, rawVehicleModel, rawPlanType);
        await FlushAutoSuggestionsAsync(ctx, ct);
        return result;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private static Guid? ResolveVehicleModel(MappingResolverContext ctx, string rawName)
    {
        if (ctx.VehicleMappings.TryGetValue(rawName, out var mapping))
            return mapping.Id;

        // Some adapters (e.g. Allianz) store a composite MODEL_NAME such as
        // "A4 3.0 4 Doors" — model code followed by engine CC and door count.
        // Extract the "root token" (everything before the first purely-numeric or
        // decimal token) so we can also compare against just the base model name.
        // "A4 3.0 4 Doors" → root = "A4"
        // "D9"             → root = "D9" (same as rawName, no split)
        // "X9 Plus"        → root = "X9 Plus" (no numeric suffix)
        var rootToken = ExtractModelRoot(rawName);
        bool hasRoot = !string.Equals(rootToken, rawName, StringComparison.OrdinalIgnoreCase)
                       && rootToken.Length >= 2;

        // Levenshtein auto-suggest.
        // For each canonical model we compute two distances and take the minimum:
        //   1. rawName vs full candidate ("A4 3.0 4 Doors" vs "A4 3.0 4 Doors") — exact match if same trim
        //   2. rootToken vs model.Name  ("A4" vs "A4") — umbrella match for composite raw names
        VehicleModel? bestModel = null;
        int bestDistance = int.MaxValue;

        foreach (var model in ctx.AllModels)
        {
            var candidate = model.SubModel != null
                ? $"{model.Name} {model.SubModel}"
                : model.Name;

            var dist = LevenshteinDistance(rawName, candidate);

            // Also try root-token vs base model name to handle "A4 3.0 4 Doors" → "A4"
            if (hasRoot)
            {
                var rootDist = LevenshteinDistance(rootToken, model.Name);
                if (rootDist < dist) dist = rootDist;
            }

            if (dist < bestDistance)
            {
                bestDistance = dist;
                bestModel    = model;
            }
        }

        if (bestDistance <= 2 && bestModel != null)
        {
            var suggested = new VehicleModelMapping
            {
                CompanyId        = ctx.CompanyId,
                RawName          = rawName,
                CanonicalModelId = bestModel.Id,
                IsAutoSuggested  = true,
                CreatedBy        = ctx.CurrentUserId
            };
            ctx.VehicleMappings[rawName] = suggested;
            ctx.NewAutoSuggestions.Add(suggested);
            return suggested.Id;
        }

        return null;
    }

    /// <summary>
    /// Extracts the model identifier from a composite raw name by stripping
    /// trailing numeric/spec tokens (engine CC, door count, etc.).
    /// "A4 3.0 4 Doors" → "A4"
    /// "D9"             → "D9"
    /// "X9 Plus"        → "X9 Plus"
    /// </summary>
    private static string ExtractModelRoot(string rawName)
    {
        var tokens = rawName.Trim().Split(' ');
        int cut = tokens.Length;
        for (int i = 1; i < tokens.Length; i++)
        {
            // A token is "numeric/spec" if it starts with a digit or decimal point
            if (tokens[i].Length > 0 && (char.IsDigit(tokens[i][0]) || tokens[i][0] == '.'))
            {
                cut = i;
                break;
            }
        }
        return string.Join(' ', tokens[..cut]);
    }

    private static Guid? ResolvePlanType(MappingResolverContext ctx, string rawName)
    {
        // 1. Exact lookup in existing company-specific mappings
        if (ctx.PlanTypeMappings.TryGetValue(rawName, out var mapping))
            return mapping.Id;

        // 2. Canonical fallback: if rawName is already a valid PlanType enum name
        //    (e.g. "Type1", "Type2Plus"), auto-create a PlanTypeMapping so the record
        //    resolves immediately without requiring manual admin setup.
        //    This handles adapters like Allianz that pre-translate company codes to
        //    canonical names before storing them.
        if (!Enum.TryParse<PlanType>(rawName, ignoreCase: true, out var canonicalType))
            return null;

        var autoMapping = new PlanTypeMapping
        {
            CompanyId         = ctx.CompanyId,
            RawName           = rawName,
            CanonicalPlanType = canonicalType,
            CreatedBy         = ctx.CurrentUserId
        };

        // Register in-memory so subsequent rows in the same batch reuse it
        ctx.PlanTypeMappings[rawName] = autoMapping;
        ctx.NewAutoPlanTypeMappings.Add(autoMapping);
        return autoMapping.Id;
    }

    private static int LevenshteinDistance(string a, string b)
    {
        a = a.ToLowerInvariant();
        b = b.ToLowerInvariant();

        if (a.Length == 0) return b.Length;
        if (b.Length == 0) return a.Length;

        var dp = new int[a.Length + 1, b.Length + 1];
        for (int i = 0; i <= a.Length; i++) dp[i, 0] = i;
        for (int j = 0; j <= b.Length; j++) dp[0, j] = j;

        for (int i = 1; i <= a.Length; i++)
        for (int j = 1; j <= b.Length; j++)
        {
            int cost = a[i - 1] == b[j - 1] ? 0 : 1;
            dp[i, j] = Math.Min(
                Math.Min(dp[i - 1, j] + 1, dp[i, j - 1] + 1),
                dp[i - 1, j - 1] + cost);
        }

        return dp[a.Length, b.Length];
    }
}
