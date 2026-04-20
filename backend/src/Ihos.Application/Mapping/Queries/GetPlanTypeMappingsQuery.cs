using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;

namespace Ihos.Application.Mapping.Queries;

public record GetPlanTypeMappingsQuery(
    Guid? CompanyId = null,
    int Page = 1,
    int PageSize = 50
) : IRequest<GetPlanTypeMappingsResult>;

public record PlanTypeMappingDto(
    Guid Id,
    Guid CompanyId,
    string CompanyName,
    string RawName,
    string CanonicalPlanType
);

public record GetPlanTypeMappingsResult(
    IReadOnlyList<PlanTypeMappingDto> Items,
    int TotalCount,
    int Page,
    int PageSize
);

public class GetPlanTypeMappingsQueryHandler : IRequestHandler<GetPlanTypeMappingsQuery, GetPlanTypeMappingsResult>
{
    private readonly IPlanTypeMappingRepository _mappings;

    public GetPlanTypeMappingsQueryHandler(IPlanTypeMappingRepository mappings) =>
        _mappings = mappings;

    public async Task<GetPlanTypeMappingsResult> Handle(GetPlanTypeMappingsQuery request, CancellationToken ct)
    {
        var (items, total) = await _mappings.GetPagedByCompanyAsync(
            request.CompanyId, request.Page, request.PageSize, ct);

        var dtos = items.Select(m => new PlanTypeMappingDto(
            m.Id,
            m.CompanyId,
            m.Company?.Name ?? string.Empty,
            m.RawName,
            m.CanonicalPlanType.ToString()
        )).ToList();

        return new GetPlanTypeMappingsResult(dtos, total, request.Page, request.PageSize);
    }
}
