using Ihos.Domain.Entities;

namespace Ihos.Application.Providers;

/// <summary>
/// Resolves provider implementations by <c>InsuranceCompany.ShortCode</c>. Backed by the DB list
/// of active InsuranceCompany rows + DI-registered IInsurerQuoteProvider / IVehicleMasterSyncer
/// instances. Adding a new provider requires only (a) a new adapter class registered in DI and
/// (b) an InsuranceCompany row — no code changes in the Search or Sync modules (Constitution
/// Principle IX — Scalability).
/// </summary>
public interface IProviderRegistry
{
    /// <summary>
    /// Returns all active companies paired with the matching quote provider.
    /// Companies without a registered provider are filtered out and logged as a warning.
    /// </summary>
    Task<IReadOnlyList<ActiveQuoteProvider>> GetActiveQuoteProvidersAsync(
        CancellationToken cancellationToken);

    /// <summary>
    /// Returns the master-data syncer for a specific company. Returns <c>null</c> when the
    /// company is Import-sourced or has no syncer registered.
    /// </summary>
    Task<ActiveMasterSyncer?> GetMasterSyncerAsync(
        Guid companyId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Returns every API-sourced company paired with its master-data syncer.
    /// Used by the daily scheduled sync.
    /// </summary>
    Task<IReadOnlyList<ActiveMasterSyncer>> GetActiveMasterSyncersAsync(
        CancellationToken cancellationToken);
}

public sealed record ActiveQuoteProvider(
    InsuranceCompany Company,
    IInsurerQuoteProvider Provider);

public sealed record ActiveMasterSyncer(
    InsuranceCompany Company,
    IVehicleMasterSyncer Syncer);
