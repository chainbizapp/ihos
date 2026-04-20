using Ihos.Domain.Entities;

namespace Ihos.Application.Common.Interfaces;

public interface IVehicleModelRepository
{
    Task<VehicleModel?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<VehicleModel>> GetAllAsync(CancellationToken ct = default);
    Task<IReadOnlyList<VehicleModel>> GetByMakeAsync(Guid makeId, CancellationToken ct = default);
    /// <summary>Returns all models (all sub-models and CC variants) for a given make + base model name.</summary>
    Task<IReadOnlyList<VehicleModel>> GetByMakeAndNameAsync(Guid makeId, string name, CancellationToken ct = default);
    Task<IReadOnlyList<VehicleMake>> GetAllMakesAsync(CancellationToken ct = default);

    // For YMM sync operations
    Task<VehicleMake?> FindMakeByNameAsync(string name, CancellationToken ct = default);
    Task<VehicleModel?> FindModelAsync(Guid makeId, string name, string? subModel, CancellationToken ct = default);
    Task AddMakeAsync(VehicleMake make, CancellationToken ct = default);
    Task AddModelAsync(VehicleModel model, CancellationToken ct = default);
    Task AddMakesAsync(IEnumerable<VehicleMake> makes, CancellationToken ct = default);
    Task AddModelsAsync(IEnumerable<VehicleModel> models, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
