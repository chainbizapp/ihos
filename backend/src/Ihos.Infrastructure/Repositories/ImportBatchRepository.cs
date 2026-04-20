using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Ihos.Infrastructure.Repositories;

public class ImportBatchRepository : IImportBatchRepository
{
    private readonly ApplicationDbContext _db;

    public ImportBatchRepository(ApplicationDbContext db) => _db = db;

    public Task<ImportBatch?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.ImportBatches
            .Include(b => b.Company)
            .FirstOrDefaultAsync(b => b.Id == id && !b.IsDeleted, ct);

    public async Task<ImportBatch?> GetByIdWithRecordsAsync(Guid id, int recordPage, int recordPageSize, CancellationToken ct = default)
    {
        var batch = await _db.ImportBatches
            .Include(b => b.Company)
            .FirstOrDefaultAsync(b => b.Id == id && !b.IsDeleted, ct);

        return batch;
    }

    public async Task<(IReadOnlyList<ImportBatch> Items, int TotalCount)> GetPagedAsync(
        int page, int pageSize,
        Guid? companyId = null,
        ImportBatchStatus? status = null,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        CancellationToken ct = default)
    {
        var query = _db.ImportBatches
            .Include(b => b.Company)
            .Where(b => !b.IsDeleted);

        if (companyId.HasValue)
            query = query.Where(b => b.CompanyId == companyId.Value);
        if (status.HasValue)
            query = query.Where(b => b.Status == status.Value);
        if (fromDate.HasValue)
            query = query.Where(b => b.UploadedAt >= fromDate.Value);
        if (toDate.HasValue)
            query = query.Where(b => b.UploadedAt <= toDate.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(b => b.UploadedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task AddAsync(ImportBatch batch, CancellationToken ct = default) =>
        await _db.ImportBatches.AddAsync(batch, ct);

    public Task SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
