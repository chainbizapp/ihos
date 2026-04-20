using Ihos.Application.Quotation.Commands;
using Ihos.Application.Quotation.Queries;
using Ihos.Application.Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ihos.API.Controllers;

[ApiController]
[Route("api/quotations")]
[Authorize]
public class QuotationsController : ControllerBase
{
    private readonly IMediator _mediator;

    public QuotationsController(IMediator mediator) => _mediator = mediator;

    /// <summary>
    /// Generate a new PDF quotation for a selected plan.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Generate([FromBody] GenerateQuotationRequest request, CancellationToken ct)
    {
        if (request.PlanId == Guid.Empty)
            return BadRequest(new { error = "planId is required." });

        if (string.IsNullOrWhiteSpace(request.CustomerName))
            return BadRequest(new { error = "customerName is required." });

        if (request.VehicleYear < 1900 || request.VehicleYear > DateTime.UtcNow.Year)
            return BadRequest(new { error = "vehicleYear is invalid." });

        try
        {
            var result = await _mediator.Send(
                new GenerateQuotationCommand(request.PlanId, request.CustomerName, request.VehicleRegistration, request.VehicleYear), ct);

            return Ok(new { quotationId = result.QuotationId });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Download a previously generated PDF quotation.
    /// </summary>
    [HttpGet("{id:guid}/pdf")]
    public async Task<IActionResult> GetPdf(Guid id, CancellationToken ct)
    {
        try
        {
            var result = await _mediator.Send(new GetQuotationPdfQuery(id), ct);
            if (result == null) return NotFound();

            return File(result.PdfBytes, "application/pdf", result.FileName);
        }
        catch (HttpRequestException)
        {
            return StatusCode(502, new { error = "PDF generation service is unavailable. Please try again shortly." });
        }
    }

    /// <summary>
    /// List quotations for the current user (paginated).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetHistory(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await _mediator.Send(new GetQuotationsQuery(page, Math.Min(pageSize, 50)), ct);
        return Ok(result);
    }
}

public record GenerateQuotationRequest(
    Guid PlanId,
    string CustomerName,
    string? VehicleRegistration,
    int VehicleYear
);
