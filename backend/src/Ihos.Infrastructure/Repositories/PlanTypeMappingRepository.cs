using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Ihos.Infrastructure.Repositories;

public class PlanTypeMappingRepository : IPlanTypeMappingRepository
{
    private readonly ApplicationDbContext _db;

    public PlanTypeMappingRepository(ApplicationDbContext db) => _db = db;

    public Task<PlanTypeMapping?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.PlanTypeMappings
            .Include(m => m.Company)
            .FirstOrDefaultAsync(m => m.Id == id && !m.IsDeleted, ct);

    public Task<PlanTypeMapping?> GetByCompanyAndRawNameAsync(Guid companyId, string rawName, CancellationToken ct = default) =>
        _db.PlanTypeMappings
            .FirstOrDefaultAsync(m => m.CompanyId == companyId && m.RawName == rawName && !m.IsDeleted, ct);

    public async Task<(IReadOnlyList<PlanTypeMapping> Items, int TotalCount)> GetPagedByCompanyAsync(Guid? companyId, int page, int pageSize, CancellationToken ct = default)
    {
        var query = _db.PlanTypeMappings
            .Include(m => m.Company)
            .Where(m => !m.IsDeleted);

        if (companyId.HasValue)
            query = query.Where(m => m.CompanyId == companyId.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(m => m.CompanyId).ThenBy(m => m.RawName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task<IReadOnlyList<PlanTypeMapping>> GetByCompanyAsync(Guid companyId, CancellationToken ct = default) =>
        await _db.PlanTypeMappings
            .Where(m => m.CompanyId == companyId && !m.IsDeleted)
            .ToListAsync(ct);

    public async Task AddAsync(PlanTypeMapping mapping, CancellationToken ct = default) =>
        await _db.PlanTypeMappings.AddAsync(mapping, ct);

    public Task AddRangeAsync(IEnumerable<PlanTypeMapping> mappings, CancellationToken ct = default) =>
        _db.PlanTypeMappings.AddRangeAsync(mappings, ct);

    public Task SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
