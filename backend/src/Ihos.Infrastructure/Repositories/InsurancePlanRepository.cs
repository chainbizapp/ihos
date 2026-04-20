using System.Globalization;
using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Ihos.Infrastructure.Repositories;

public class InsurancePlanRepository : IInsurancePlanRepository
{
    private readonly ApplicationDbContext _db;

    public InsurancePlanRepository(ApplicationDbContext db) => _db = db;

    public Task<InsurancePlan?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.InsurancePlans
            .Include(p => p.Company)
            .Include(p => p.VehicleModel)
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted, ct);

    public async Task<(IReadOnlyList<InsurancePlan> Items, int TotalCount)> SearchAsync(
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
        CancellationToken ct = default)
    {
        var query = _db.InsurancePlans
            .Include(p => p.Company)
            .Include(p => p.VehicleModel).ThenInclude(m => m.Make)
            .Where(p =>
                p.IsPublished &&
                !p.IsDeleted &&
                vehicleModelIds.Contains(p.VehicleModelId) &&
                p.RepairType == repairType &&
                (vehicleAge == null || (p.MinYear <= vehicleAge && p.MaxYear >= vehicleAge)));

        if (planType.HasValue)
            query = query.Where(p => p.PlanType == planType.Value);

        if (companyId.HasValue)
            query = query.Where(p => p.CompanyId == companyId.Value);

        if (excessMin.HasValue)
            query = query.Where(p => p.ExcessAmount >= excessMin.Value);

        if (excessMax.HasValue)
            query = query.Where(p => p.ExcessAmount <= excessMax.Value);

        var total = await query.CountAsync(ct);

        query = sort switch
        {
            "sum_insured_desc" => query.OrderByDescending(p => p.SumInsured),
            _ => query.OrderBy(p => p.PremiumTotal)
        };

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task<IReadOnlyList<InsurancePlan>> GetByIdsAsync(IEnumerable<Guid> ids, CancellationToken ct = default)
    {
        var idList = ids.ToList();
        return await _db.InsurancePlans
            .Include(p => p.Company)
            .Include(p => p.VehicleModel).ThenInclude(m => m!.Make)
            .Where(p => idList.Contains(p.Id) && p.IsPublished && !p.IsDeleted)
            .ToListAsync(ct);
    }

    public Task<InsurancePlan?> GetByUniqueKeyAsync(
        Guid companyId, Guid vehicleModelId, PlanType planType, RepairType repairType,
        int minYear, int maxYear, decimal sumInsured, string regionGroup = "",
        string externalPackageId = "", CancellationToken ct = default) =>
        _db.InsurancePlans
            .FirstOrDefaultAsync(p =>
                p.CompanyId == companyId &&
                p.VehicleModelId == vehicleModelId &&
                p.PlanType == planType &&
                p.RepairType == repairType &&
                p.MinYear == minYear &&
                p.MaxYear == maxYear &&
                p.SumInsured == sumInsured &&
                p.RegionGroup == regionGroup &&
                p.ExternalPackageId == externalPackageId &&
                !p.IsDeleted, ct);

    public async Task AddAsync(InsurancePlan plan, CancellationToken ct = default) =>
        await _db.InsurancePlans.AddAsync(plan, ct);

    public async Task<Dictionary<string, InsurancePlan>> GetExistingByCompanyAsync(Guid companyId, CancellationToken ct = default)
    {
        var plans = await _db.InsurancePlans
            .Where(p => p.CompanyId == companyId && !p.IsDeleted)
            .ToListAsync(ct);

        return plans.ToDictionary(p =>
            FormattableString.Invariant($"{p.CompanyId}|{p.VehicleModelId}|{p.PlanType}|{p.RepairType}|{p.MinYear}|{p.MaxYear}|{p.SumInsured}|{p.RegionGroup}|{p.ExternalPackageId}"));
    }

    public async Task AddRangeAsync(IEnumerable<InsurancePlan> plans, CancellationToken ct = default) =>
        await _db.InsurancePlans.AddRangeAsync(plans, ct);

    public Task SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
