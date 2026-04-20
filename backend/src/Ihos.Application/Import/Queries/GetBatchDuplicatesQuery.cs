using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;

namespace Ihos.Application.Import.Queries;

public record GetBatchDuplicatesQuery(Guid BatchId, int Limit = 30) : IRequest<GetBatchDuplicatesResult>;

public record DuplicateGroupDto(
    int Count,
    int FirstRowNumber,
    string RepairType,
    string MinYear,
    string MaxYear,
    string SumInsured,
    string ExternalPackageId,
    IReadOnlyList<string> VehicleModels,
    IReadOnlyList<int> DuplicateRows
);

public record GetBatchDuplicatesResult(int TotalDuplicateRecords, IReadOnlyList<DuplicateGroupDto> Groups);

public class GetBatchDuplicatesQueryHandler : IRequestHandler<GetBatchDuplicatesQuery, GetBatchDuplicatesResult>
{
    private readonly IImportRecordRepository _records;

    public GetBatchDuplicatesQueryHandler(IImportRecordRepository records) => _records = records;

    public async Task<GetBatchDuplicatesResult> Handle(GetBatchDuplicatesQuery request, CancellationToken ct)
    {
        var groups = await _records.GetDuplicateGroupsAsync(request.BatchId, request.Limit, ct);

        var dtos = groups.Select(g => new DuplicateGroupDto(
            g.Count, g.FirstRowNumber, g.RepairType, g.MinYear, g.MaxYear,
            g.SumInsured, g.ExternalPackageId, g.VehicleModels, g.DuplicateRows
        )).ToList();

        // Total duplicate records = sum of (count - 1) per group (each group keeps 1 canonical row)
        var totalDuplicates = groups.Sum(g => g.Count - 1);

        return new GetBatchDuplicatesResult(totalDuplicates, dtos);
    }
}
