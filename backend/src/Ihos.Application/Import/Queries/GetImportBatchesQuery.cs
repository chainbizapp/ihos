using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;

namespace Ihos.Application.Import.Queries;

public record GetImportBatchesQuery(
    int Page = 1,
    int PageSize = 20,
    Guid? CompanyId = null,
    ImportBatchStatus? Status = null,
    DateTime? FromDate = null,
    DateTime? ToDate = null
) : IRequest<GetImportBatchesResult>;

public record ImportBatchSummaryDto(
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
    int RejectedRows
);

public record GetImportBatchesResult(
    IReadOnlyList<ImportBatchSummaryDto> Items,
    int TotalCount,
    int Page,
    int PageSize
);

public class GetImportBatchesQueryHandler : IRequestHandler<GetImportBatchesQuery, GetImportBatchesResult>
{
    private readonly IImportBatchRepository _batches;

    public GetImportBatchesQueryHandler(IImportBatchRepository batches) => _batches = batches;

    public async Task<GetImportBatchesResult> Handle(GetImportBatchesQuery request, CancellationToken ct)
    {
        var (items, total) = await _batches.GetPagedAsync(
            request.Page, request.PageSize,
            request.CompanyId, request.Status,
            request.FromDate, request.ToDate, ct);

        var dtos = items.Select(b => new ImportBatchSummaryDto(
            b.Id, b.CompanyId, b.Company.Name,
            b.SourceFileName, b.UploadedBy, b.UploadedAt,
            b.Status.ToString(), b.TotalRows, b.ResolvedRows,
            b.PendingRows, b.ApprovedRows, b.RejectedRows
        )).ToList();

        return new GetImportBatchesResult(dtos, total, request.Page, request.PageSize);
    }
}
