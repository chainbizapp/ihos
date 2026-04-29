using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;
using Ihos.Domain.Entities;

namespace Ihos.Application.Search.Queries;

public record SearchPlansQuery(
    Guid VehicleModelId,
    int RegistrationYear,
    PlanType? PlanType,
    RepairType RepairType,
    Guid? CompanyId = null,
    decimal? ExcessMin = null,
    decimal? ExcessMax = null,
    string Sort = "price_asc",
    int Page = 1,
    int PageSize = 20,
    /// <summary>Filter by engine CC (e.g. "3.0"). Null = all CCs.</summary>
    string? EngineCC = null,
    /// <summary>Filter by gear type (e.g. "Automatic"). Null = all gear types.</summary>
    string? GearType = null,
    /// <summary>If true, bypasses specific sub-model restriction and searches all trims for this model.</summary>
    bool AllVariants = false,
    /// <summary>Thai province name (e.g. "กรุงเทพมหานคร"). Used to filter region-specific plans.</summary>
    string? Province = null
) : IRequest<SearchPlansResult>;

public record InsurancePlanSummaryDto(
    Guid Id,
    string CompanyName,
    string CompanyShortCode,
    string PlanType,
    string RepairType,
    string VehicleModel,
    string VehicleMake,
    string? VehicleSubModel,
    string? VehicleEngineCC,
    string? VehicleGearType,
    int RegistrationYear,
    decimal SumInsured,
    decimal PremiumTotal,
    decimal ExcessAmount,
    string CoverageDetails,
    string? Remarks,
    string? RegionGroup        = null,
    // Structured coverage limits (null = company does not publish this value)
    decimal? TpbiPerPerson     = null,
    decimal? TpbiPerAccident   = null,
    decimal? Tppd              = null,
    decimal? FireTheft         = null,
    decimal? PersonalAccident  = null,
    decimal? PassengerAccident = null,
    decimal? MedicalExpenses   = null,
    decimal? BailBond          = null
);

public record SearchPlansResult(
    IReadOnlyList<InsurancePlanSummaryDto> Items,
    int TotalCount,
    int Page,
    int PageSize
);

public class SearchPlansQueryHandler : IRequestHandler<SearchPlansQuery, SearchPlansResult>
{
    private readonly IInsurancePlanRepository _plans;
    private readonly IVehicleModelRepository _vehicles;

    public SearchPlansQueryHandler(
        IInsurancePlanRepository plans,
        IVehicleModelRepository vehicles)
    {
        _plans    = plans;
        _vehicles = vehicles;
    }

    public async Task<SearchPlansResult> Handle(SearchPlansQuery request, CancellationToken ct)
    {
        var pageSize = Math.Min(request.PageSize, 50);
        // 0 = "All Years" sentinel → no year filter
        int? registrationYear = request.RegistrationYear > 0 ? request.RegistrationYear : null;

        var vehicleModelIds = await ResolveVehicleModelIdsAsync(
            request.VehicleModelId, request.EngineCC, request.GearType, request.AllVariants, ct);

        var (items, total) = await _plans.SearchAsync(
            vehicleModelIds,
            registrationYear,
            request.PlanType,
            request.RepairType,
            request.CompanyId,
            request.ExcessMin,
            request.ExcessMax,
            request.Sort,
            request.Page,
            pageSize,
            request.Province,
            ct);

        var dtos = items.Select(p => new InsurancePlanSummaryDto(
            p.Id,
            p.Company?.Name ?? string.Empty,
            p.Company?.ShortCode ?? string.Empty,
            p.PlanType.ToString(),
            p.RepairType.ToString(),
            p.VehicleModel?.Name ?? string.Empty,
            p.VehicleModel?.Make?.Name ?? string.Empty,
            p.VehicleModel?.SubModel,
            p.VehicleModel?.EngineCC,
            p.VehicleModel?.GearType,
            p.RegistrationYear,
            p.SumInsured,
            p.PremiumTotal,
            p.ExcessAmount,
            p.CoverageDetails,
            p.Remarks,
            RegionGroup       : string.IsNullOrEmpty(p.RegionGroup) ? null : p.RegionGroup,
            TpbiPerPerson     : p.TpbiPerPerson,
            TpbiPerAccident   : p.TpbiPerAccident,
            Tppd              : p.Tppd,
            FireTheft         : p.FireTheft,
            PersonalAccident  : p.PersonalAccident,
            PassengerAccident : p.PassengerAccident,
            MedicalExpenses   : p.MedicalExpenses,
            BailBond          : p.BailBond
        )).ToList();

        return new SearchPlansResult(dtos, total, request.Page, pageSize);
    }

    /// <summary>
    /// Resolves the set of VehicleModel IDs to search.
    ///
    /// Fans out to ALL models sharing the same Make + Name, then optionally
    /// filters by EngineCC if the user specified one.  This handles:
    ///   • Allianz-style umbrella models (SubModel=null, one row per model-line)
    ///   • Viriyah-style specific trims (SubModel set, one row per variant)
    ///   • Mixed: searching "A4" with CC="3.0" returns only 3.0 L variants;
    ///     without CC returns all A4 CC/trim combinations.
    /// </summary>
    private async Task<IReadOnlyList<Guid>> ResolveVehicleModelIdsAsync(
        Guid vehicleModelId, string? engineCC, string? gearType, bool allVariants, CancellationToken ct)
    {
        var model = await _vehicles.GetByIdAsync(vehicleModelId, ct);
        if (model == null) return [vehicleModelId];

        // Get every model with the same make + base name (all CCs, all sub-models)
        var siblings = await _vehicles.GetByMakeAndNameAsync(model.MakeId, model.Name, ct);

        IEnumerable<VehicleModel> candidates = siblings.Count > 0 ? siblings : [model];

        // If the user selected a specific sub-model trim (not "All variants"), strictly restrict candidates
        // to that exact model, plus umbrella models (SubModel == null) which apply to all trims.
        if (!allVariants && !string.IsNullOrWhiteSpace(model.SubModel))
        {
            candidates = candidates.Where(m => string.IsNullOrWhiteSpace(m.SubModel) || m.Id == model.Id);
        }

        // Filter by CC when specified (preserving umbrellas without CC)
        if (!string.IsNullOrWhiteSpace(engineCC))
        {
            candidates = candidates.Where(m =>
                string.IsNullOrWhiteSpace(m.EngineCC) ||
                string.Equals(m.EngineCC, engineCC, StringComparison.OrdinalIgnoreCase));
        }

        // Filter by Gear Type only when specified AND the user picked a specific trim (not "all variants")
        if (!allVariants && !string.IsNullOrWhiteSpace(gearType))
        {
            candidates = candidates.Where(m =>
                string.IsNullOrWhiteSpace(m.GearType) ||
                string.Equals(m.GearType, gearType, StringComparison.OrdinalIgnoreCase));
        }

        var ids = candidates.Select(m => m.Id).ToList();
        return ids.Count > 0 ? ids : [vehicleModelId];
    }
}
