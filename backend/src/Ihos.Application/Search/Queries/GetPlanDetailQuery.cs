using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;

namespace Ihos.Application.Search.Queries;

public record GetPlanDetailQuery(Guid Id) : IRequest<InsurancePlanDetailDto?>;

public record InsurancePlanDetailDto(
    Guid Id,
    Guid CompanyId,
    string CompanyName,
    Guid VehicleModelId,
    string VehicleModel,
    string VehicleMake,
    string PlanType,
    string RepairType,
    int RegistrationYear,
    decimal SumInsured,
    decimal PremiumTotal,
    decimal ExcessAmount,
    string CoverageDetails,
    string? Remarks,
    bool IsPublished,
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

public class GetPlanDetailQueryHandler : IRequestHandler<GetPlanDetailQuery, InsurancePlanDetailDto?>
{
    private readonly IInsurancePlanRepository _plans;

    public GetPlanDetailQueryHandler(IInsurancePlanRepository plans) => _plans = plans;

    public async Task<InsurancePlanDetailDto?> Handle(GetPlanDetailQuery request, CancellationToken ct)
    {
        var plan = await _plans.GetByIdAsync(request.Id, ct);
        if (plan == null || !plan.IsPublished) return null;

        return new InsurancePlanDetailDto(
            plan.Id,
            plan.CompanyId,
            plan.Company?.Name ?? string.Empty,
            plan.VehicleModelId,
            plan.VehicleModel?.Name ?? string.Empty,
            plan.VehicleModel?.Make?.Name ?? string.Empty,
            plan.PlanType.ToString(),
            plan.RepairType.ToString(),
            plan.RegistrationYear,
            plan.SumInsured,
            plan.PremiumTotal,
            plan.ExcessAmount,
            plan.CoverageDetails,
            plan.Remarks,
            plan.IsPublished,
            TpbiPerPerson:     plan.TpbiPerPerson,
            TpbiPerAccident:   plan.TpbiPerAccident,
            Tppd:              plan.Tppd,
            FireTheft:         plan.FireTheft,
            PersonalAccident:  plan.PersonalAccident,
            PassengerAccident: plan.PassengerAccident,
            MedicalExpenses:   plan.MedicalExpenses,
            BailBond:          plan.BailBond
        );
    }
}
