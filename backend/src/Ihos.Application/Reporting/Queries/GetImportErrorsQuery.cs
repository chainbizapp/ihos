using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;

namespace Ihos.Application.Reporting.Queries;

public record GetImportErrorsQuery(
    Guid? CompanyId,
    DateTime From,
    DateTime To,
    int Page = 1,
    int PageSize = 20
) : IRequest<ImportErrorsResult>;

public record ImportErrorsResult(
    IReadOnlyList<ImportErrorBatchDto> Items,
    int TotalCount,
    int Page,
    int PageSize
);

public record ImportErrorBatchDto(
    Guid BatchId,
    string CompanyName,
    string SourceFileName,
    DateTime UploadedAt,
    string Status,
    int TotalRows,
    int ResolvedRows,
    int PendingRows,
    int ApprovedRows,
    int RejectedRows
);

public class GetImportErrorsQueryHandler
    : IRequestHandler<GetImportErrorsQuery, ImportErrorsResult>
{
    private readonly IReportingRepository _reporting;

    public GetImportErrorsQueryHandler(IReportingRepository reporting) => _reporting = reporting;

    public async Task<ImportErrorsResult> Handle(
        GetImportErrorsQuery request, CancellationToken ct)
    {
        var from = request.From.Date;
        var to = request.To.Date.AddDays(1).AddTicks(-1);
        var pageSize = Math.Min(request.PageSize, 50);

        var (rows, total) = await _reporting.GetImportBatchSummariesAsync(
            request.CompanyId, from, to, request.Page, pageSize, ct);

        var items = rows.Select(r => new ImportErrorBatchDto(
            r.BatchId, r.CompanyName, r.SourceFileName, r.UploadedAt,
            r.Status, r.TotalRows, r.ResolvedRows, r.PendingRows,
            r.ApprovedRows, r.RejectedRows
        )).ToList();

        return new ImportErrorsResult(items, total, request.Page, pageSize);
    }
}
