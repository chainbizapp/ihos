using Ihos.Domain.Entities;

namespace Ihos.Application.Common.Interfaces;

public interface IPlanTypeMappingRepository
{
    Task<PlanTypeMapping?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<PlanTypeMapping?> GetByCompanyAndRawNameAsync(Guid companyId, string rawName, CancellationToken ct = default);
    Task<(IReadOnlyList<PlanTypeMapping> Items, int TotalCount)> GetPagedByCompanyAsync(Guid? companyId, int page, int pageSize, CancellationToken ct = default);
    Task<IReadOnlyList<PlanTypeMapping>> GetByCompanyAsync(Guid companyId, CancellationToken ct = default);
    Task AddAsync(PlanTypeMapping mapping, CancellationToken ct = default);
    Task AddRangeAsync(IEnumerable<PlanTypeMapping> mappings, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
