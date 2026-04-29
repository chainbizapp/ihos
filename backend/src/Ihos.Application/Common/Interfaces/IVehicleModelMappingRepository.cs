using Ihos.Domain.Entities;

namespace Ihos.Application.Common.Interfaces;

public interface IVehicleModelMappingRepository
{
    Task<VehicleModelMapping?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<VehicleModelMapping?> GetByCompanyAndRawNameAsync(Guid companyId, string rawName, CancellationToken ct = default);
    Task<(IReadOnlyList<VehicleModelMapping> Items, int TotalCount)> GetPagedByCompanyAsync(Guid? companyId, string? makeName, int page, int pageSize, CancellationToken ct = default);
    Task<IReadOnlyList<VehicleModelMapping>> GetByCompanyAsync(Guid companyId, CancellationToken ct = default);
    Task AddAsync(VehicleModelMapping mapping, CancellationToken ct = default);
    Task AddRangeAsync(IEnumerable<VehicleModelMapping> mappings, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
