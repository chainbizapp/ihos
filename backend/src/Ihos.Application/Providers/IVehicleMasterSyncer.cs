using Ihos.Domain.Enums;

namespace Ihos.Application.Providers;

/// <summary>
/// Per-provider vehicle-master sync interface. Implemented only by providers with
/// <c>DataSource = Api</c>. Allianz (Import) does not implement this.
/// </summary>
public interface IVehicleMasterSyncer
{
    /// <summary>Matches <c>InsuranceCompany.ShortCode</c>. Used as the DI registration key.</summary>
    string ShortCode { get; }

    /// <summary>
    /// Performs an upsert-style sync: insert new vehicles, update existing, soft-deactivate
    /// missing rows. Returns counts and outcome. Must not throw on per-record errors —
    /// surface them via <see cref="SyncOutcome.ErrorCount"/>.
    /// </summary>
    Task<SyncOutcome> SyncAsync(
        SyncTriggerType trigger,
        Guid? actorUserId,
        CancellationToken cancellationToken);
}
