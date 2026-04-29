using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Ihos.Infrastructure.Repositories;

public class VehicleModelMappingRepository : IVehicleModelMappingRepository
{
    private readonly ApplicationDbContext _db;

    public VehicleModelMappingRepository(ApplicationDbContext db) => _db = db;

    public Task<VehicleModelMapping?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.VehicleModelMappings
            .Include(m => m.Company)
            .Include(m => m.CanonicalModel)
            .FirstOrDefaultAsync(m => m.Id == id && !m.IsDeleted, ct);

    public Task<VehicleModelMapping?> GetByCompanyAndRawNameAsync(Guid companyId, string rawName, CancellationToken ct = default) =>
        _db.VehicleModelMappings
            .FirstOrDefaultAsync(m => m.CompanyId == companyId && m.RawName == rawName && !m.IsDeleted, ct);

    public async Task<(IReadOnlyList<VehicleModelMapping> Items, int TotalCount)> GetPagedByCompanyAsync(Guid? companyId, string? makeName, int page, int pageSize, CancellationToken ct = default)
    {
        var query = _db.VehicleModelMappings
            .Include(m => m.Company)
            .Include(m => m.CanonicalModel).ThenInclude(cm => cm.Make)
            .Where(m => !m.IsDeleted);

        if (companyId.HasValue)
            query = query.Where(m => m.CompanyId == companyId.Value);

        if (!string.IsNullOrWhiteSpace(makeName))
            query = query.Where(m => m.CanonicalModel!.Make!.Name == makeName);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(m => m.CanonicalModel!.Make!.Name)
            .ThenBy(m => m.CanonicalModel!.Name)
            .ThenBy(m => m.CompanyId)
            .ThenBy(m => m.RawName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task<IReadOnlyList<VehicleModelMapping>> GetByCompanyAsync(Guid companyId, CancellationToken ct = default) =>
        await _db.VehicleModelMappings
            .Include(m => m.CanonicalModel)
            .Where(m => m.CompanyId == companyId && !m.IsDeleted)
            .ToListAsync(ct);

    public async Task AddAsync(VehicleModelMapping mapping, CancellationToken ct = default) =>
        await _db.VehicleModelMappings.AddAsync(mapping, ct);

    public Task AddRangeAsync(IEnumerable<VehicleModelMapping> mappings, CancellationToken ct = default) =>
        _db.VehicleModelMappings.AddRangeAsync(mappings, ct);

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var mapping = await _db.VehicleModelMappings
            .FirstOrDefaultAsync(m => m.Id == id && !m.IsDeleted, ct);
        if (mapping == null) return false;
        mapping.IsDeleted = true;
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public Task SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
