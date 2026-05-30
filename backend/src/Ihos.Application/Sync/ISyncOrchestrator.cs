using Ihos.Domain.Enums;

namespace Ihos.Application.Sync;

/// <summary>
/// Coordinates manual + scheduled vehicle-master sync runs. Writes a <c>VehicleSyncLog</c>
/// row in <see cref="SyncStatus.Running"/> state before invoking the per-provider
/// <see cref="Ihos.Application.Providers.IVehicleMasterSyncer"/>, then updates the same row
/// on completion. Rejects starts when a Running log already exists for the same company.
/// </summary>
public interface ISyncOrchestrator
{
    /// <summary>
    /// Starts a sync for the given provider short-code. Returns the new
    /// <c>VehicleSyncLog.Id</c> immediately. The actual sync runs in the background — the
    /// UI polls status via <c>GetSyncStatusQuery</c>.
    /// </summary>
    Task<Guid> StartAsync(
        string shortCode,
        SyncTriggerType trigger,
        Guid? actorUserId,
        CancellationToken cancellationToken);
}
