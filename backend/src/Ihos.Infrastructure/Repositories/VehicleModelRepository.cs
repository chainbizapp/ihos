using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Ihos.Infrastructure.Repositories;

public class VehicleModelRepository : IVehicleModelRepository
{
    private readonly ApplicationDbContext _db;

    public VehicleModelRepository(ApplicationDbContext db) => _db = db;

    public Task<VehicleModel?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.VehicleModels.Include(m => m.Make).FirstOrDefaultAsync(m => m.Id == id && !m.IsDeleted, ct);

    public async Task<IReadOnlyList<VehicleModel>> GetAllAsync(CancellationToken ct = default) =>
        await _db.VehicleModels
            .Include(m => m.Make)
            .Where(m => !m.IsDeleted)
            .OrderBy(m => m.Make.Name).ThenBy(m => m.Name)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<VehicleModel>> GetByMakeAsync(Guid makeId, CancellationToken ct = default) =>
        await _db.VehicleModels
            .Include(m => m.Make)
            .Where(m => m.MakeId == makeId && !m.IsDeleted)
            .OrderBy(m => m.Name)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<VehicleModel>> GetByMakeAndNameAsync(Guid makeId, string name, CancellationToken ct = default) =>
        await _db.VehicleModels
            .Include(m => m.Make)
            .Where(m => m.MakeId == makeId && m.Name == name && !m.IsDeleted)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<VehicleMake>> GetAllMakesAsync(CancellationToken ct = default) =>
        await _db.VehicleMakes
            .Where(m => !m.IsDeleted)
            .OrderBy(m => m.Name)
            .ToListAsync(ct);

    public Task<VehicleMake?> FindMakeByNameAsync(string name, CancellationToken ct = default) =>
        _db.VehicleMakes.FirstOrDefaultAsync(
            m => !m.IsDeleted && m.Name.ToLower() == name.ToLower(), ct);

    public Task<VehicleModel?> FindModelAsync(Guid makeId, string name, string? subModel, CancellationToken ct = default) =>
        _db.VehicleModels.FirstOrDefaultAsync(
            m => !m.IsDeleted
              && m.MakeId == makeId
              && m.Name.ToLower() == name.ToLower()
              && (subModel == null ? m.SubModel == null : m.SubModel != null && m.SubModel.ToLower() == subModel.ToLower()),
            ct);

    public async Task AddMakeAsync(VehicleMake make, CancellationToken ct = default) =>
        await _db.VehicleMakes.AddAsync(make, ct);

    public async Task AddModelAsync(VehicleModel model, CancellationToken ct = default) =>
        await _db.VehicleModels.AddAsync(model, ct);

    public Task AddMakesAsync(IEnumerable<VehicleMake> makes, CancellationToken ct = default) =>
        _db.VehicleMakes.AddRangeAsync(makes, ct);

    public Task AddModelsAsync(IEnumerable<VehicleModel> models, CancellationToken ct = default) =>
        _db.VehicleModels.AddRangeAsync(models, ct);

    public Task SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
