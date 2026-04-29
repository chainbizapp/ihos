using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;

namespace Ihos.Application.Mapping.Queries;

public record GetVehicleModelMappingsQuery(
    Guid? CompanyId = null,
    string? MakeName = null,
    int Page = 1,
    int PageSize = 50
) : IRequest<GetVehicleModelMappingsResult>;

public record VehicleModelMappingDto(
    Guid Id,
    Guid CompanyId,
    string CompanyName,
    string RawName,
    Guid CanonicalModelId,
    string CanonicalModelName,
    string? CanonicalSubModel,
    string? CanonicalEngineCC,
    string CanonicalMakeName,
    bool IsAutoSuggested
);

public record GetVehicleModelMappingsResult(
    IReadOnlyList<VehicleModelMappingDto> Items,
    int TotalCount,
    int Page,
    int PageSize
);

public class GetVehicleModelMappingsQueryHandler : IRequestHandler<GetVehicleModelMappingsQuery, GetVehicleModelMappingsResult>
{
    private readonly IVehicleModelMappingRepository _mappings;

    public GetVehicleModelMappingsQueryHandler(IVehicleModelMappingRepository mappings) =>
        _mappings = mappings;

    public async Task<GetVehicleModelMappingsResult> Handle(GetVehicleModelMappingsQuery request, CancellationToken ct)
    {
        var (items, total) = await _mappings.GetPagedByCompanyAsync(
            request.CompanyId, request.MakeName, request.Page, request.PageSize, ct);

        var dtos = items.Select(m => new VehicleModelMappingDto(
            m.Id,
            m.CompanyId,
            m.Company?.Name ?? string.Empty,
            m.RawName,
            m.CanonicalModelId,
            m.CanonicalModel?.Name ?? string.Empty,
            m.CanonicalModel?.SubModel,
            m.CanonicalModel?.EngineCC,
            m.CanonicalModel?.Make?.Name ?? string.Empty,
            m.IsAutoSuggested
        )).ToList();

        return new GetVehicleModelMappingsResult(dtos, total, request.Page, request.PageSize);
    }
}
