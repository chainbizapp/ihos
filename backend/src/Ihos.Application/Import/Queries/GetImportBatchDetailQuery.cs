using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;

namespace Ihos.Application.Import.Queries;

public record GetImportBatchDetailQuery(
    Guid BatchId,
    int RecordPage = 1,
    int RecordPageSize = 50,
    bool IssuesOnly = false
) : IRequest<GetImportBatchDetailResult?>;

public record ImportRecordDto(
    Guid Id,
    int RowNumber,
    string RawData,
    Guid? VehicleModelMappingId,
    string? ResolvedVehicleMake,
    string? ResolvedVehicleModel,
    Guid? PlanTypeMappingId,
    string? ResolvedPlanType,
    string MappingStatus,
    string ReviewStatus,
    Guid? ReviewedBy,
    DateTime? ReviewedAt,
    string? RejectionReason
);

public record GetImportBatchDetailResult(
    Guid Id,
    Guid CompanyId,
    string CompanyName,
    string SourceFileName,
    Guid UploadedBy,
    DateTime UploadedAt,
    string Status,
    int TotalRows,
    int ResolvedRows,
    int PendingRows,
    int ApprovedRows,
    int RejectedRows,
    IReadOnlyList<ImportRecordDto> Records,
    int RecordsTotalCount,
    int RecordsPage,
    int RecordsPageSize
);

public class GetImportBatchDetailQueryHandler : IRequestHandler<GetImportBatchDetailQuery, GetImportBatchDetailResult?>
{
    private readonly IImportBatchRepository _batches;
    private readonly IImportRecordRepository _records;

    public GetImportBatchDetailQueryHandler(IImportBatchRepository batches, IImportRecordRepository records)
    {
        _batches = batches;
        _records = records;
    }

    public async Task<GetImportBatchDetailResult?> Handle(GetImportBatchDetailQuery request, CancellationToken ct)
    {
        var batch = await _batches.GetByIdAsync(request.BatchId, ct);
        if (batch == null) return null;

        var (recordItems, recordTotal) = await _records.GetByBatchAsync(
            request.BatchId, request.RecordPage, request.RecordPageSize, request.IssuesOnly, ct);

        var recordDtos = recordItems.Select(r => new ImportRecordDto(
            r.Id, r.RowNumber, r.RawData,
            r.VehicleModelMappingId,
            r.VehicleModelMapping?.CanonicalModel?.Make?.Name,
            r.VehicleModelMapping?.CanonicalModel?.Name,
            r.PlanTypeMappingId,
            r.PlanTypeMapping?.CanonicalPlanType.ToString(),
            r.MappingStatus.ToString(),
            r.ReviewStatus.ToString(),
            r.ReviewedBy, r.ReviewedAt, r.RejectionReason
        )).ToList();

        return new GetImportBatchDetailResult(
            batch.Id, batch.CompanyId, batch.Company.Name,
            batch.SourceFileName, batch.UploadedBy, batch.UploadedAt,
            batch.Status.ToString(), batch.TotalRows, batch.ResolvedRows,
            batch.PendingRows, batch.ApprovedRows, batch.RejectedRows,
            recordDtos, recordTotal, request.RecordPage, request.RecordPageSize
        );
    }
}
