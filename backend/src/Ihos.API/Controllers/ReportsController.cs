using Ihos.API.Authorization;
using Ihos.Application.Reporting.Queries;
using Ihos.Infrastructure.Reporting;
using Ihos.Application.Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ihos.API.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize(Policy = AuthorizationPolicies.RequireManager)]
public class ReportsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ReportExportService _exportService;

    public ReportsController(IMediator mediator, ReportExportService exportService)
    {
        _mediator = mediator;
        _exportService = exportService;
    }

    /// <summary>
    /// Usage statistics: quotations per period grouped by granularity.
    /// </summary>
    [HttpGet("usage-statistics")]
    public async Task<IActionResult> GetUsageStatistics(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] string granularity = "daily",
        CancellationToken ct = default)
    {
        if (from > to) return BadRequest(new { error = "'from' must be before 'to'." });

        var result = await _mediator.Send(new GetUsageStatisticsQuery(from, to, granularity), ct);
        return Ok(result);
    }

    /// <summary>
    /// Top vehicle models by quotation count.
    /// </summary>
    [HttpGet("top-vehicle-models")]
    public async Task<IActionResult> GetTopVehicleModels(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] int topN = 20,
        CancellationToken ct = default)
    {
        if (from > to) return BadRequest(new { error = "'from' must be before 'to'." });

        var result = await _mediator.Send(new GetTopVehicleModelsQuery(from, to, topN), ct);
        return Ok(result);
    }

    /// <summary>
    /// Import errors: batch-level counts of resolved/pending/approved/rejected rows.
    /// </summary>
    [HttpGet("import-errors")]
    public async Task<IActionResult> GetImportErrors(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] Guid? companyId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        if (from > to) return BadRequest(new { error = "'from' must be before 'to'." });

        var result = await _mediator.Send(
            new GetImportErrorsQuery(companyId, from, to, page, Math.Min(pageSize, 50)), ct);
        return Ok(result);
    }

    /// <summary>
    /// Export a report as PDF or Excel.
    /// </summary>
    [HttpGet("{reportType}/export")]
    public async Task<IActionResult> Export(
        string reportType,
        [FromQuery] string format,
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] string granularity = "daily",
        [FromQuery] Guid? companyId = null,
        CancellationToken ct = default)
    {
        if (from > to) return BadRequest(new { error = "'from' must be before 'to'." });

        var isPdf = format.Equals("pdf", StringComparison.OrdinalIgnoreCase);
        var isExcel = format.Equals("xlsx", StringComparison.OrdinalIgnoreCase)
                   || format.Equals("excel", StringComparison.OrdinalIgnoreCase);

        if (!isPdf && !isExcel)
            return BadRequest(new { error = "format must be 'pdf' or 'xlsx'." });

        try
        {
            switch (reportType.ToLower())
            {
                case "usage-statistics":
                {
                    var data = await _mediator.Send(
                        new GetUsageStatisticsQuery(from, to, granularity), ct);
                    if (isPdf)
                    {
                        var bytes = await _exportService.ExportUsageStatisticsPdfAsync(data, ct);
                        return File(bytes, "application/pdf", $"usage_statistics_{from:yyyyMMdd}_{to:yyyyMMdd}.pdf");
                    }
                    else
                    {
                        var bytes = _exportService.ExportUsageStatisticsExcel(data);
                        return File(bytes,
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            $"usage_statistics_{from:yyyyMMdd}_{to:yyyyMMdd}.xlsx");
                    }
                }

                case "top-vehicle-models":
                {
                    var data = await _mediator.Send(
                        new GetTopVehicleModelsQuery(from, to), ct);
                    if (isPdf)
                    {
                        var bytes = await _exportService.ExportTopVehicleModelsPdfAsync(data, ct);
                        return File(bytes, "application/pdf", $"top_models_{from:yyyyMMdd}_{to:yyyyMMdd}.pdf");
                    }
                    else
                    {
                        var bytes = _exportService.ExportTopVehicleModelsExcel(data);
                        return File(bytes,
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            $"top_models_{from:yyyyMMdd}_{to:yyyyMMdd}.xlsx");
                    }
                }

                case "import-errors":
                {
                    var data = await _mediator.Send(
                        new GetImportErrorsQuery(companyId, from, to, 1, 1000), ct);
                    if (isPdf)
                    {
                        var bytes = await _exportService.ExportImportErrorsPdfAsync(data, companyId, from, to, ct);
                        return File(bytes, "application/pdf", $"import_errors_{from:yyyyMMdd}_{to:yyyyMMdd}.pdf");
                    }
                    else
                    {
                        var bytes = _exportService.ExportImportErrorsExcel(data);
                        return File(bytes,
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            $"import_errors_{from:yyyyMMdd}_{to:yyyyMMdd}.xlsx");
                    }
                }

                default:
                    return BadRequest(new { error = $"Unknown report type '{reportType}'." });
            }
        }
        catch (HttpRequestException)
        {
            return StatusCode(502, new { error = "PDF generation service is unavailable." });
        }
    }
}
