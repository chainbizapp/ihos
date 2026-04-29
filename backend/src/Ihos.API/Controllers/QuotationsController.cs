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
    /// Generate a new PDF quotation for 1–3 selected plans.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Generate([FromBody] GenerateQuotationRequest request, CancellationToken ct)
    {
        if (request.PlanIds == null || request.PlanIds.Count == 0)
            return BadRequest(new { error = "At least one planId is required." });

        if (request.PlanIds.Count > 3)
            return BadRequest(new { error = "At most 3 plans can be included in a single quotation." });

        if (request.PlanIds.Any(id => id == Guid.Empty))
            return BadRequest(new { error = "All planIds must be valid GUIDs." });

        if (string.IsNullOrWhiteSpace(request.CustomerName))
            return BadRequest(new { error = "customerName is required." });

        if (request.VehicleYear < 1900 || request.VehicleYear > DateTime.UtcNow.Year)
            return BadRequest(new { error = "vehicleYear is invalid." });

        try
        {
            var result = await _mediator.Send(
                new GenerateQuotationCommand(
                    request.PlanIds,
                    request.CustomerName,
                    request.VehicleRegistration,
                    request.VehicleYear,
                    request.Phone,
                    request.Email,
                    request.LicenseNumber,
                    request.PreviousInsurer,
                    request.PreviousExpiryDate), ct);

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
    List<Guid> PlanIds,
    string CustomerName,
    string? VehicleRegistration,
    int VehicleYear,
    string? Phone = null,
    string? Email = null,
    string? LicenseNumber = null,
    string? PreviousInsurer = null,
    string? PreviousExpiryDate = null
);
