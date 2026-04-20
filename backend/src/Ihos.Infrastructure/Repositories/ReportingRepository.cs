using Ihos.Application.Common.Interfaces;
using Ihos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Ihos.Infrastructure.Repositories;

public class ReportingRepository : IReportingRepository
{
    private readonly ApplicationDbContext _db;

    public ReportingRepository(ApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<DateTime>> GetQuotationDatesAsync(
        DateTime from, DateTime to, CancellationToken ct = default)
    {
        return await _db.Quotations
            .Where(q => !q.IsDeleted && q.GeneratedAt >= from && q.GeneratedAt <= to)
            .Select(q => q.GeneratedAt)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<(string Make, string ModelName, int Count)>> GetTopVehicleModelsAsync(
        DateTime from, DateTime to, int topN, CancellationToken ct = default)
    {
        var results = await _db.Quotations
            .Where(q => !q.IsDeleted && q.GeneratedAt >= from && q.GeneratedAt <= to)
            .GroupBy(q => new { q.VehicleMake, q.VehicleModelName })
            .Select(g => new
            {
                g.Key.VehicleMake,
                g.Key.VehicleModelName,
                Count = g.Count()
            })
            .OrderByDescending(x => x.Count)
            .Take(topN)
            .ToListAsync(ct);

        return results.Select(x => (x.VehicleMake, x.VehicleModelName, x.Count)).ToList();
    }

    public async Task<(IReadOnlyList<ImportBatchRow> Items, int TotalCount)> GetImportBatchSummariesAsync(
        Guid? companyId, DateTime from, DateTime to,
        int page, int pageSize, CancellationToken ct = default)
    {
        var query = _db.ImportBatches
            .Include(b => b.Company)
            .Where(b => !b.IsDeleted && b.UploadedAt >= from && b.UploadedAt <= to);

        if (companyId.HasValue)
            query = query.Where(b => b.CompanyId == companyId.Value);

        var total = await query.CountAsync(ct);

        var batches = await query
            .OrderByDescending(b => b.UploadedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var rows = batches.Select(b => new ImportBatchRow(
            b.Id,
            b.Company?.Name ?? string.Empty,
            b.SourceFileName,
            b.UploadedAt,
            b.Status.ToString(),
            b.TotalRows,
            b.ResolvedRows,
            b.PendingRows,
            b.ApprovedRows,
            b.RejectedRows
        )).ToList();

        return (rows, total);
    }
}
