using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;

namespace Ihos.Application.Reporting.Queries;

public record GetTopVehicleModelsQuery(
    DateTime From,
    DateTime To,
    int TopN = 20
) : IRequest<TopVehicleModelsResult>;

public record TopVehicleModelsResult(
    IReadOnlyList<VehicleModelRankDto> Items,
    DateTime From,
    DateTime To
);

public record VehicleModelRankDto(
    int Rank,
    string VehicleMake,
    string VehicleModel,
    int QuotationCount
);

public class GetTopVehicleModelsQueryHandler
    : IRequestHandler<GetTopVehicleModelsQuery, TopVehicleModelsResult>
{
    private readonly IReportingRepository _reporting;

    public GetTopVehicleModelsQueryHandler(IReportingRepository reporting) => _reporting = reporting;

    public async Task<TopVehicleModelsResult> Handle(
        GetTopVehicleModelsQuery request, CancellationToken ct)
    {
        var from = request.From.Date;
        var to = request.To.Date.AddDays(1).AddTicks(-1);

        var raw = await _reporting.GetTopVehicleModelsAsync(from, to, request.TopN, ct);

        var items = raw.Select((x, i) => new VehicleModelRankDto(
            i + 1, x.Make, x.ModelName, x.Count
        )).ToList();

        return new TopVehicleModelsResult(items, from, to);
    }
}
