using Ihos.Domain.Entities;
using Ihos.Domain.Enums;

namespace Ihos.Application.Common.Interfaces;

public interface IInsurancePlanRepository
{
    Task<InsurancePlan?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<InsurancePlan>> GetByIdsAsync(IEnumerable<Guid> ids, CancellationToken ct = default);
    Task<InsurancePlan?> GetByUniqueKeyAsync(
        Guid companyId, Guid vehicleModelId, PlanType planType, RepairType repairType,
        int minYear, int maxYear, decimal sumInsured, string regionGroup = "",
        string externalPackageId = "", CancellationToken ct = default);
    /// <summary>
    /// Loads all non-deleted plans for a company as a dictionary keyed by unique composite key.
    /// Used during publish to avoid N+1 lookups.
    /// </summary>
    Task<Dictionary<string, InsurancePlan>> GetExistingByCompanyAsync(Guid companyId, CancellationToken ct = default);
    Task<(IReadOnlyList<InsurancePlan> Items, int TotalCount)> SearchAsync(
        IReadOnlyList<Guid> vehicleModelIds,
        int? vehicleAge,
        PlanType? planType,
        RepairType repairType,
        Guid? companyId,
        decimal? excessMin,
        decimal? excessMax,
        string sort,
        int page,
        int pageSize,
        CancellationToken ct = default);
    Task AddAsync(InsurancePlan plan, CancellationToken ct = default);
    Task AddRangeAsync(IEnumerable<InsurancePlan> plans, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
