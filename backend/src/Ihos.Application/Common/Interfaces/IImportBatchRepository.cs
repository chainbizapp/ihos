using Ihos.Domain.Entities;
using Ihos.Domain.Enums;

namespace Ihos.Application.Common.Interfaces;

public interface IImportBatchRepository
{
    Task<ImportBatch?> GetByIdAsync(Guid id, CancellationToken ct = default, bool asNoTracking = false);
    Task<ImportBatch?> GetByIdWithRecordsAsync(Guid id, int recordPage, int recordPageSize, CancellationToken ct = default);
    Task<(IReadOnlyList<ImportBatch> Items, int TotalCount)> GetPagedAsync(
        int page, int pageSize,
        Guid? companyId = null,
        ImportBatchStatus? status = null,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        CancellationToken ct = default);
    Task AddAsync(ImportBatch batch, CancellationToken ct = default);
    Task RecalculateCountersAsync(Guid batchId, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
