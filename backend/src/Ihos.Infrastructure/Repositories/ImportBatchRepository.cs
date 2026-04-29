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

    public Task<ImportBatch?> GetByIdAsync(Guid id, CancellationToken ct = default, bool asNoTracking = false)
    {
        var query = _db.ImportBatches.AsQueryable();
        if (asNoTracking) query = query.AsNoTracking();
        return query
            .Include(b => b.Company)
            .FirstOrDefaultAsync(b => b.Id == id && !b.IsDeleted, ct);
    }

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

    public async Task RecalculateCountersAsync(Guid batchId, CancellationToken ct = default)
    {
        // Use raw SQL to update all counters in one atomic step based on actual record state.
        // This handles any drift caused by concurrency or previous bugs.
        const string sql = """
            UPDATE import_batches b
            SET "PendingRows" = (
                SELECT count(*)::int FROM import_records r 
                WHERE r."BatchId" = b."Id" AND r."MappingStatus" = 'PendingMapping' AND r."ReviewStatus" = 'Pending' AND NOT r."IsDeleted"
            ),
            "ResolvedRows" = (
                SELECT count(*)::int FROM import_records r 
                WHERE r."BatchId" = b."Id" AND r."MappingStatus" = 'Resolved' AND r."ReviewStatus" = 'Pending' AND NOT r."IsDeleted"
            ),
            "ApprovedRows" = (
                SELECT count(*)::int FROM import_records r 
                WHERE r."BatchId" = b."Id" AND r."ReviewStatus" = 'Approved' AND NOT r."IsDeleted"
            ),
            "RejectedRows" = (
                SELECT count(*)::int FROM import_records r 
                WHERE r."BatchId" = b."Id" AND r."ReviewStatus" = 'Rejected' AND NOT r."IsDeleted"
            )
            WHERE b."Id" = @batchId;
            """;

        await _db.Database.ExecuteSqlRawAsync(sql, new object[] { new Npgsql.NpgsqlParameter("batchId", batchId) }, ct);
    }

    public Task SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
