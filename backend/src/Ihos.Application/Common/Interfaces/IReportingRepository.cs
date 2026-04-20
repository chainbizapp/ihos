namespace Ihos.Application.Common.Interfaces;

public interface IReportingRepository
{
    Task<IReadOnlyList<DateTime>> GetQuotationDatesAsync(
        DateTime from, DateTime to, CancellationToken ct = default);

    Task<IReadOnlyList<(string Make, string ModelName, int Count)>> GetTopVehicleModelsAsync(
        DateTime from, DateTime to, int topN, CancellationToken ct = default);

    Task<(IReadOnlyList<ImportBatchRow> Items, int TotalCount)> GetImportBatchSummariesAsync(
        Guid? companyId, DateTime from, DateTime to,
        int page, int pageSize, CancellationToken ct = default);
}

public record ImportBatchRow(
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
