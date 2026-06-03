using Ihos.Domain.Entities;

namespace Ihos.Application.Common.Interfaces;

/// <summary>
/// Data access for <see cref="ProviderBrandAlias"/>. Lives in Application so the resolver
/// stays free of EF Core (Clean Architecture — implementation is in Infrastructure).
/// </summary>
public interface IBrandAliasRepository
{
    /// <summary>
    /// Verified alias for (provider, raw) if one exists — case-insensitive on RawValue.
    /// Only verified rows are returned: unverified guesses must not affect live matching.
    /// </summary>
    Task<ProviderBrandAlias?> FindVerifiedAsync(
        string providerCode, string rawValue, CancellationToken ct = default);

    /// <summary>All aliases for a provider (verified or not) — for the admin list view.</summary>
    Task<IReadOnlyList<ProviderBrandAlias>> GetByProviderAsync(
        string providerCode, CancellationToken ct = default);

    Task<ProviderBrandAlias?> GetByIdAsync(Guid id, CancellationToken ct = default);

    /// <summary>All active canonical makes — used by the fuzzy fallback to score candidates.</summary>
    Task<IReadOnlyList<VehicleMake>> GetAllMakesAsync(CancellationToken ct = default);

    Task AddAsync(ProviderBrandAlias alias, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
