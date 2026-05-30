using Ihos.Application.Providers;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;

namespace Ihos.Infrastructure.Caching;

/// <summary>
/// Flat, JSON-friendly snapshot of an aggregated provider quote response. Used by the
/// SWR cache so that <see cref="InsurancePlan"/> navigation properties (Company,
/// VehicleModel, Make) round-trip cleanly without dragging in EF Core proxies.
/// </summary>
public sealed record QuoteCachePayload(
    string CompanyShortCode,
    string CompanyDisplayName,
    Guid CompanyId,
    Guid VehicleModelId,
    string VehicleMake,
    string VehicleModelName,
    string? VehicleSubModel,
    string? VehicleEngineCC,
    string? VehicleGearType,
    IReadOnlyList<CachedPlan> Plans);

public sealed record CachedPlan(
    PlanType PlanType,
    RepairType RepairType,
    int RegistrationYear,
    decimal SumInsured,
    decimal PremiumTotal,
    decimal ExcessAmount,
    string? Remarks,
    string? RegionGroup,
    string ExternalPackageId,
    decimal? TpbiPerPerson,
    decimal? TpbiPerAccident,
    decimal? Tppd,
    decimal? FireTheft,
    decimal? PersonalAccident,
    decimal? PassengerAccident,
    decimal? MedicalExpenses,
    decimal? BailBond);

/// <summary>
/// Converts between <see cref="InsurancePlan"/> (in-memory entity used by the search
/// aggregator) and the cache-friendly <see cref="QuoteCachePayload"/>.
/// </summary>
public static class QuoteCacheMapper
{
    /// <summary>
    /// Build a cache payload from the in-memory <see cref="InsurancePlan"/> list returned
    /// by a live API call. Strips EF navs to keep the JSON tight.
    /// </summary>
    public static QuoteCachePayload ToPayload(
        string companyShortCode,
        string companyDisplayName,
        Guid companyId,
        VehicleModel vehicle,
        IReadOnlyList<InsurancePlan> plans) => new(
            CompanyShortCode: companyShortCode,
            CompanyDisplayName: companyDisplayName,
            CompanyId: companyId,
            VehicleModelId: vehicle.Id,
            VehicleMake: vehicle.Make?.Name ?? string.Empty,
            VehicleModelName: vehicle.Name,
            VehicleSubModel: vehicle.SubModel,
            VehicleEngineCC: vehicle.EngineCC,
            VehicleGearType: vehicle.GearType,
            Plans: plans.Select(p => new CachedPlan(
                p.PlanType, p.RepairType, p.RegistrationYear,
                p.SumInsured, p.PremiumTotal, p.ExcessAmount,
                p.Remarks, p.RegionGroup, p.ExternalPackageId,
                p.TpbiPerPerson, p.TpbiPerAccident, p.Tppd,
                p.FireTheft, p.PersonalAccident, p.PassengerAccident,
                p.MedicalExpenses, p.BailBond)).ToList());

    /// <summary>
    /// Re-hydrates the cache payload into transient <see cref="InsurancePlan"/> instances
    /// with synthesized Company / VehicleModel / Make navs — no DB calls. These are NOT
    /// EF-tracked and never persisted.
    /// </summary>
    public static IReadOnlyList<InsurancePlan> ToInsurancePlans(QuoteCachePayload payload)
    {
        var make = new VehicleMake { Name = payload.VehicleMake };
        var company = new InsuranceCompany
        {
            Id = payload.CompanyId,
            Name = payload.CompanyDisplayName,
            ShortCode = payload.CompanyShortCode,
        };
        var vehicle = new VehicleModel
        {
            Id = payload.VehicleModelId,
            Name = payload.VehicleModelName,
            SubModel = payload.VehicleSubModel,
            EngineCC = payload.VehicleEngineCC,
            GearType = payload.VehicleGearType,
            Make = make,
        };

        return payload.Plans.Select(p => new InsurancePlan
        {
            Id = Guid.NewGuid(),
            CompanyId = company.Id,
            Company = company,
            VehicleModelId = vehicle.Id,
            VehicleModel = vehicle,
            PlanType = p.PlanType,
            RepairType = p.RepairType,
            RegistrationYear = p.RegistrationYear,
            SumInsured = p.SumInsured,
            PremiumTotal = p.PremiumTotal,
            ExcessAmount = p.ExcessAmount,
            CoverageDetails = "{}",
            Remarks = p.Remarks,
            RegionGroup = p.RegionGroup ?? string.Empty,
            ExternalPackageId = p.ExternalPackageId,
            TpbiPerPerson = p.TpbiPerPerson,
            TpbiPerAccident = p.TpbiPerAccident,
            Tppd = p.Tppd,
            FireTheft = p.FireTheft,
            PersonalAccident = p.PersonalAccident,
            PassengerAccident = p.PassengerAccident,
            MedicalExpenses = p.MedicalExpenses,
            BailBond = p.BailBond,
            IsPublished = true,
        }).ToList();
    }

    /// <summary>Stable cache key for a quote request.</summary>
    public static string BuildKey(string providerShortCode, ProviderQuoteRequest r) =>
        $"quote:{providerShortCode}:{r.VehicleModelId}:{r.RegistrationYear}:{r.PlanType}:{r.RepairType}:{r.SumInsured}";
}
