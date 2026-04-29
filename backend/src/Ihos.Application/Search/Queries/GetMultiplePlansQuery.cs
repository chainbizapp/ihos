using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;

namespace Ihos.Application.Search.Queries;

public record GetMultiplePlansQuery(IReadOnlyList<Guid> Ids) : IRequest<GetMultiplePlansResult>;

public record GetMultiplePlansResult(IReadOnlyList<InsurancePlanDetailDto> Plans);

public class GetMultiplePlansQueryHandler : IRequestHandler<GetMultiplePlansQuery, GetMultiplePlansResult>
{
    private readonly IInsurancePlanRepository _plans;

    public GetMultiplePlansQueryHandler(IInsurancePlanRepository plans) => _plans = plans;

    public async Task<GetMultiplePlansResult> Handle(GetMultiplePlansQuery request, CancellationToken ct)
    {
        if (request.Ids.Count > 3)
            throw new ArgumentException("Maximum 3 plans can be compared at once.");

        var plans = await _plans.GetByIdsAsync(request.Ids, ct);

        var dtos = plans.Select(p => new InsurancePlanDetailDto(
            p.Id,
            p.CompanyId,
            p.Company?.Name ?? string.Empty,
            p.VehicleModelId,
            p.VehicleModel?.Name ?? string.Empty,
            p.VehicleModel?.Make?.Name ?? string.Empty,
            p.PlanType.ToString(),
            p.RepairType.ToString(),
            p.RegistrationYear,
            p.SumInsured,
            p.PremiumTotal,
            p.ExcessAmount,
            p.CoverageDetails,
            p.Remarks,
            p.IsPublished,
            TpbiPerPerson:     p.TpbiPerPerson,
            TpbiPerAccident:   p.TpbiPerAccident,
            Tppd:              p.Tppd,
            FireTheft:         p.FireTheft,
            PersonalAccident:  p.PersonalAccident,
            PassengerAccident: p.PassengerAccident,
            MedicalExpenses:   p.MedicalExpenses,
            BailBond:          p.BailBond
        )).ToList();

        return new GetMultiplePlansResult(dtos);
    }
}
