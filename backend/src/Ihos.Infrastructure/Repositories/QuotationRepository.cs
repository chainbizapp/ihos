using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Ihos.Infrastructure.Repositories;

public class QuotationRepository : IQuotationRepository
{
    private readonly ApplicationDbContext _db;

    public QuotationRepository(ApplicationDbContext db) => _db = db;

    public Task<Quotation?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.Quotations
            .Include(q => q.Plan).ThenInclude(p => p.Company)
            .Include(q => q.Plan).ThenInclude(p => p.VehicleModel).ThenInclude(m => m!.Make)
            .FirstOrDefaultAsync(q => q.Id == id && !q.IsDeleted, ct);

    public async Task<(IReadOnlyList<Quotation> Items, int TotalCount)> GetPagedAsync(
        Guid? createdBy,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = _db.Quotations
            .Include(q => q.Plan).ThenInclude(p => p.Company)
            .Where(q => !q.IsDeleted);

        if (createdBy.HasValue)
            query = query.Where(q => q.CreatedBy == createdBy.Value);

        var total = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(q => q.GeneratedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task AddAsync(Quotation quotation, CancellationToken ct = default) =>
        await _db.Quotations.AddAsync(quotation, ct);

    public Task SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
