using Ihos.Domain.Entities;

namespace Ihos.Application.Common.Interfaces;

public record DuplicateRecordGroup(
    int    Count,
    int    FirstRowNumber,
    string RepairType,
    string RegistrationYear,
    string SumInsured,
    string ExternalPackageId,
    /// <summary>Distinct carname_codes (vehicle_model raw values) that share this key.</summary>
    IReadOnlyList<string> VehicleModels,
    /// <summary>Row numbers of the duplicate records (all except the first).</summary>
    IReadOnlyList<int> DuplicateRows
);

public interface IImportRecordRepository
{
    Task<ImportRecord?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<(IReadOnlyList<ImportRecord> Items, int TotalCount)> GetByBatchAsync(
        Guid batchId, int page, int pageSize, bool issuesOnly = false, CancellationToken ct = default);
    Task<IReadOnlyList<ImportRecord>> GetResolvedPendingByBatchAsync(Guid batchId, CancellationToken ct = default);
    Task<IReadOnlyList<ImportRecord>> GetPendingMappingByBatchAsync(Guid batchId, CancellationToken ct = default);
    Task AddRangeAsync(IEnumerable<ImportRecord> records, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
    /// <summary>
    /// Bulk-inserts rows via PostgreSQL COPY — single round trip, far faster than EF SaveChanges chunks.
    /// </summary>
    Task BulkInsertAsync(IReadOnlyList<ImportRecord> records, CancellationToken ct = default);
    /// <summary>
    /// Approves all resolved-pending records for a batch in a single UPDATE statement.
    /// Returns the number of rows updated.
    /// </summary>
    Task<int> BulkApproveResolvedAsync(Guid batchId, Guid? userId, DateTime now, CancellationToken ct = default);
    /// <summary>
    /// Rejects all PendingMapping+Pending records for a batch in a single UPDATE statement.
    /// Returns the number of rows updated.
    /// </summary>
    Task<int> BulkRejectUnresolvedAsync(Guid batchId, Guid? userId, DateTime now, string reason, CancellationToken ct = default);
    Task<int> BulkRejectAllPendingAsync(Guid batchId, Guid? userId, DateTime now, string reason, CancellationToken ct = default);
    /// <summary>
    /// Returns all non-deleted records for a batch with only the mapping FK navigation needed for publish.
    /// Avoids the deep ThenInclude(CanonicalModel) join used by the review UI.
    /// </summary>
    Task<IReadOnlyList<ImportRecord>> GetAllForPublishAsync(Guid batchId, CancellationToken ct = default);
    /// <summary>
    /// Returns the top duplicate groups in a batch — records that share the same effective unique key
    /// (vehicleModelMappingId + planTypeMappingId + repair_type + min_year + max_year + sum_insured + external_package_id).
    /// Each group includes the count, the first row number seen, and the raw carname_codes involved.
    /// </summary>
    Task<IReadOnlyList<DuplicateRecordGroup>> GetDuplicateGroupsAsync(Guid batchId, int limit = 30, CancellationToken ct = default);
}
