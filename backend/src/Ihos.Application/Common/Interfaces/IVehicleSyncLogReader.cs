using Ihos.Application.Sync.Queries;
using Ihos.Domain.Entities;

namespace Ihos.Application.Common.Interfaces;

/// <summary>
/// Read-only access to <see cref="VehicleSyncLog"/> for status + history queries. Writes
/// go through <see cref="Ihos.Application.Sync.ISyncOrchestrator"/> only — sync log rows
/// are immutable after completion (Constitution Principle IV — Traceability).
/// </summary>
public interface IVehicleSyncLogReader
{
    /// <summary>Latest sync log per company id (newest StartedAtUtc wins).</summary>
    Task<IReadOnlyDictionary<Guid, VehicleSyncLog>> GetLatestPerCompanyAsync(
        CancellationToken cancellationToken);

    /// <summary>Paginated history across all companies, ordered StartedAtUtc desc.</summary>
    Task<GetSyncHistoryResult> GetHistoryAsync(int page, int pageSize, CancellationToken ct);
}
