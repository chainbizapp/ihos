using ClosedXML.Excel;
using Ihos.Application.Common.Interfaces;
using Ihos.Application.Reporting.Queries;

namespace Ihos.Infrastructure.Reporting;

public class ReportExportService
{
    private readonly IJasperReportsClient _jasper;

    public ReportExportService(IJasperReportsClient jasper) => _jasper = jasper;

    // ── PDF exports via Spring Boot JasperReports service ──────────────────

    public Task<byte[]> ExportUsageStatisticsPdfAsync(
        UsageStatisticsResult data, CancellationToken ct = default)
    {
        var parameters = new Dictionary<string, string>
        {
            ["srcFile"] = "usage_statistics",
            ["param1"] = data.From.ToString("yyyy-MM-dd"),
            ["param2"] = data.To.ToString("yyyy-MM-dd"),
            ["param3"] = data.Granularity
        };
        return _jasper.GenerateQuotationPdfAsync(parameters, ct);
    }

    public Task<byte[]> ExportTopVehicleModelsPdfAsync(
        TopVehicleModelsResult data, CancellationToken ct = default)
    {
        var parameters = new Dictionary<string, string>
        {
            ["srcFile"] = "top_vehicle_models",
            ["param1"] = data.From.ToString("yyyy-MM-dd"),
            ["param2"] = data.To.ToString("yyyy-MM-dd")
        };
        return _jasper.GenerateQuotationPdfAsync(parameters, ct);
    }

    public Task<byte[]> ExportImportErrorsPdfAsync(
        ImportErrorsResult data, Guid? companyId, DateTime from, DateTime to,
        CancellationToken ct = default)
    {
        var parameters = new Dictionary<string, string>
        {
            ["srcFile"] = "import_errors",
            ["param1"] = from.ToString("yyyy-MM-dd"),
            ["param2"] = to.ToString("yyyy-MM-dd"),
            ["param3"] = companyId?.ToString() ?? string.Empty
        };
        return _jasper.GenerateQuotationPdfAsync(parameters, ct);
    }

    // ── Excel exports via ClosedXML ─────────────────────────────────────────

    public byte[] ExportUsageStatisticsExcel(UsageStatisticsResult data)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Usage Statistics");

        ws.Cell(1, 1).Value = "Usage Statistics Report";
        ws.Cell(1, 1).Style.Font.Bold = true;
        ws.Cell(1, 1).Style.Font.FontSize = 14;
        ws.Cell(2, 1).Value = $"Period: {data.From:dd MMM yyyy} – {data.To:dd MMM yyyy} ({data.Granularity})";
        ws.Cell(3, 1).Value = $"Total Quotations: {data.TotalQuotations}";

        ws.Cell(5, 1).Value = "Period Start";
        ws.Cell(5, 2).Value = "Quotation Count";
        ws.Row(5).Style.Font.Bold = true;

        int row = 6;
        foreach (var bucket in data.Buckets)
        {
            ws.Cell(row, 1).Value = bucket.PeriodStart.ToString("yyyy-MM-dd");
            ws.Cell(row, 2).Value = bucket.QuotationCount;
            row++;
        }

        ws.Columns().AdjustToContents();
        using var stream = new MemoryStream();
        wb.SaveAs(stream);
        return stream.ToArray();
    }

    public byte[] ExportTopVehicleModelsExcel(TopVehicleModelsResult data)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Top Vehicle Models");

        ws.Cell(1, 1).Value = "Top Vehicle Models Report";
        ws.Cell(1, 1).Style.Font.Bold = true;
        ws.Cell(1, 1).Style.Font.FontSize = 14;
        ws.Cell(2, 1).Value = $"Period: {data.From:dd MMM yyyy} – {data.To:dd MMM yyyy}";

        ws.Cell(4, 1).Value = "Rank";
        ws.Cell(4, 2).Value = "Make";
        ws.Cell(4, 3).Value = "Model";
        ws.Cell(4, 4).Value = "Quotation Count";
        ws.Row(4).Style.Font.Bold = true;

        int row = 5;
        foreach (var item in data.Items)
        {
            ws.Cell(row, 1).Value = item.Rank;
            ws.Cell(row, 2).Value = item.VehicleMake;
            ws.Cell(row, 3).Value = item.VehicleModel;
            ws.Cell(row, 4).Value = item.QuotationCount;
            row++;
        }

        ws.Columns().AdjustToContents();
        using var stream = new MemoryStream();
        wb.SaveAs(stream);
        return stream.ToArray();
    }

    public byte[] ExportImportErrorsExcel(ImportErrorsResult data)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Import Errors");

        ws.Cell(1, 1).Value = "Import Errors Report";
        ws.Cell(1, 1).Style.Font.Bold = true;
        ws.Cell(1, 1).Style.Font.FontSize = 14;

        ws.Cell(3, 1).Value = "Company";
        ws.Cell(3, 2).Value = "File Name";
        ws.Cell(3, 3).Value = "Uploaded At";
        ws.Cell(3, 4).Value = "Status";
        ws.Cell(3, 5).Value = "Total";
        ws.Cell(3, 6).Value = "Resolved";
        ws.Cell(3, 7).Value = "Pending";
        ws.Cell(3, 8).Value = "Approved";
        ws.Cell(3, 9).Value = "Rejected";
        ws.Row(3).Style.Font.Bold = true;

        int row = 4;
        foreach (var item in data.Items)
        {
            ws.Cell(row, 1).Value = item.CompanyName;
            ws.Cell(row, 2).Value = item.SourceFileName;
            ws.Cell(row, 3).Value = item.UploadedAt.ToString("yyyy-MM-dd HH:mm");
            ws.Cell(row, 4).Value = item.Status;
            ws.Cell(row, 5).Value = item.TotalRows;
            ws.Cell(row, 6).Value = item.ResolvedRows;
            ws.Cell(row, 7).Value = item.PendingRows;
            ws.Cell(row, 8).Value = item.ApprovedRows;
            ws.Cell(row, 9).Value = item.RejectedRows;
            row++;
        }

        ws.Columns().AdjustToContents();
        using var stream = new MemoryStream();
        wb.SaveAs(stream);
        return stream.ToArray();
    }
}
