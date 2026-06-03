using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;

namespace Ihos.Application.Brands;

/// <summary>
/// Outcome of resolving a provider's raw brand string to a canonical make.
/// </summary>
public sealed record BrandResolution(
    Guid? CanonicalMakeId,
    string? CanonicalMakeName,
    AliasSource Source,
    int? Confidence,
    /// <summary>True when matched/created confidently enough to use without human review.</summary>
    bool IsUsable);

/// <summary>
/// Resolves a provider's raw brand text to a canonical <see cref="VehicleMake"/> using a
/// three-tier strategy (feature 003):
///
///   1. Verified alias  — exact (case-insensitive) lookup in the alias table. Instant, trusted.
///   2. Fuzzy fallback  — Levenshtein with a LENGTH GUARD: short names (≤4 chars) demand a
///                        tighter distance because a 2-edit window matches almost anything
///                        ("TR" vs "AC"). Produces an AiFuzzy/AiGuess suggestion.
///   3. No match        — returns Pending; caller queues it for manual resolution.
///
/// Pure logic — all data access goes through <see cref="IBrandAliasRepository"/> so this
/// class has zero EF Core dependency (Clean Architecture).
/// </summary>
public sealed class BrandAliasResolver
{
    /// <summary>Names this long or shorter must match within <see cref="ShortNameMaxDistance"/>.</summary>
    public const int ShortNameThreshold = 4;
    public const int ShortNameMaxDistance = 1;
    public const int LongNameMaxDistance = 2;

    private readonly IBrandAliasRepository _repo;

    public BrandAliasResolver(IBrandAliasRepository repo) => _repo = repo;

    /// <summary>
    /// Resolves <paramref name="rawBrand"/> for the given provider. Reuses a pre-loaded make
    /// list (pass from a context so a bulk sync doesn't re-query per row).
    /// </summary>
    public async Task<BrandResolution> ResolveAsync(
        string providerCode,
        string rawBrand,
        IReadOnlyList<VehicleMake>? makesCache = null,
        CancellationToken ct = default)
    {
        var raw = rawBrand?.Trim() ?? string.Empty;
        if (raw.Length == 0)
            return new BrandResolution(null, null, AliasSource.Pending, null, false);

        // ── Tier 1: verified alias ──────────────────────────────────────────────
        var alias = await _repo.FindVerifiedAsync(providerCode, raw, ct);
        if (alias is { CanonicalMakeId: not null })
        {
            return new BrandResolution(
                alias.CanonicalMakeId, alias.CanonicalMake?.Name,
                alias.Source, alias.Confidence, IsUsable: true);
        }

        // ── Tier 2: fuzzy fallback ──────────────────────────────────────────────
        var makes = makesCache ?? await _repo.GetAllMakesAsync(ct);
        var (best, distance) = BestFuzzyMatch(raw, makes);

        if (best is not null)
        {
            var maxAllowed = Normalize(raw).Length <= ShortNameThreshold
                ? ShortNameMaxDistance
                : LongNameMaxDistance;

            if (distance <= maxAllowed)
            {
                // distance 0–1 on a long name → high confidence; distance 2 → a guess.
                var source = distance <= 1 ? AliasSource.AiFuzzy : AliasSource.AiGuess;
                var confidence = ConfidenceFromDistance(distance, Normalize(best.Name).Length);
                // AiFuzzy is usable immediately; AiGuess waits for human verification.
                var usable = source == AliasSource.AiFuzzy;
                return new BrandResolution(best.Id, best.Name, source, confidence, usable);
            }
        }

        // ── Tier 3: no confident match ──────────────────────────────────────────
        return new BrandResolution(null, null, AliasSource.Pending, null, false);
    }

    private static (VehicleMake? make, int distance) BestFuzzyMatch(
        string raw, IReadOnlyList<VehicleMake> makes)
    {
        var rawN = Normalize(raw);
        VehicleMake? best = null;
        int bestDist = int.MaxValue;

        foreach (var m in makes)
        {
            var n = Normalize(m.Name);
            if (n.Length == 0) continue;

            // Exact after normalize → distance 0, can't beat it.
            if (n == rawN) return (m, 0);

            // Length pre-filter: if lengths differ by more than the running best, the
            // Levenshtein distance cannot be smaller — skip the expensive computation.
            if (Math.Abs(n.Length - rawN.Length) >= bestDist) continue;

            var d = Levenshtein(rawN, n);
            if (d < bestDist) { bestDist = d; best = m; if (d == 0) break; }
        }
        return (best, bestDist);
    }

    /// <summary>Lowercase + strip non-alphanumerics so "ROLLS-ROYCE" == "Rolls Royce".</summary>
    private static string Normalize(string s)
    {
        Span<char> buf = s.Length <= 64 ? stackalloc char[s.Length] : new char[s.Length];
        int k = 0;
        foreach (var c in s)
            if (char.IsLetterOrDigit(c)) buf[k++] = char.ToLowerInvariant(c);
        return new string(buf[..k]);
    }

    private static int ConfidenceFromDistance(int distance, int targetLen)
    {
        if (distance == 0) return 100;
        if (targetLen == 0) return 0;
        // 1 edit on a 7-char name ≈ 86%; on a 3-char name ≈ 67%.
        var pct = (int)Math.Round(100.0 * (1.0 - (double)distance / Math.Max(targetLen, 1)));
        return Math.Clamp(pct, 0, 99);
    }

    private static int Levenshtein(string a, string b)
    {
        if (a.Length == 0) return b.Length;
        if (b.Length == 0) return a.Length;
        if (a.Length < b.Length) (a, b) = (b, a);

        var prev = new int[b.Length + 1];
        var curr = new int[b.Length + 1];
        for (var j = 0; j <= b.Length; j++) prev[j] = j;

        for (var i = 1; i <= a.Length; i++)
        {
            curr[0] = i;
            for (var j = 1; j <= b.Length; j++)
            {
                var cost = a[i - 1] == b[j - 1] ? 0 : 1;
                curr[j] = Math.Min(Math.Min(curr[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
            }
            (prev, curr) = (curr, prev);
        }
        return prev[b.Length];
    }
}
