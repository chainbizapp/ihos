using Ihos.Application.Search.Queries;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ihos.API.Controllers;

[ApiController]
[Route("api/plans")]
[Authorize]
public class PlansController : ControllerBase
{
    private readonly IMediator _mediator;

    public PlansController(IMediator mediator) => _mediator = mediator;

    /// <summary>
    /// Search published insurance plans.
    /// </summary>
    [HttpGet("search")]
    [AllowAnonymous]
    public async Task<IActionResult> Search(
        [FromQuery] Guid vehicleModelId,
        [FromQuery] int registrationYear,
        [FromQuery] string? planType = null,
        [FromQuery] string repairType = "Garage",
        [FromQuery] Guid? companyId = null,
        [FromQuery] decimal? excessMin = null,
        [FromQuery] decimal? excessMax = null,
        [FromQuery] string sort = "price_asc",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? engineCC = null,
        [FromQuery] string? gearType = null,
        [FromQuery] bool allVariants = false,
        CancellationToken ct = default)
    {
        PlanType? pt = null;
        if (!string.IsNullOrEmpty(planType))
        {
            if (!Enum.TryParse<PlanType>(planType, true, out var parsedPt))
                return BadRequest(new { error = $"Invalid planType '{planType}'." });
            pt = parsedPt;
        }

        if (!Enum.TryParse<RepairType>(repairType, true, out var rt))
            return BadRequest(new { error = $"Invalid repairType '{repairType}'." });

        if (vehicleModelId == Guid.Empty)
            return BadRequest(new { error = "vehicleModelId is required." });

        if (registrationYear != 0 && (registrationYear < 1900 || registrationYear > DateTime.UtcNow.Year))
            return BadRequest(new { error = "registrationYear is invalid." });

        var result = await _mediator.Send(
            new SearchPlansQuery(vehicleModelId, registrationYear, pt, rt, companyId, excessMin, excessMax, sort, page, Math.Min(pageSize, 50), engineCC, gearType, allVariants), ct);


        return Ok(result);
    }

    /// <summary>
    /// Get single published plan detail.
    /// </summary>
    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPlan(Guid id, CancellationToken ct)
    {
        var result = await _mediator.Send(new GetPlanDetailQuery(id), ct);
        if (result == null) return NotFound();
        return Ok(result);
    }

    /// <summary>
    /// Get up to 3 plans side-by-side for comparison.
    /// </summary>
    [HttpGet("compare")]
    [AllowAnonymous]
    public async Task<IActionResult> Compare([FromQuery] string ids, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(ids))
            return BadRequest(new { error = "ids query parameter is required." });

        var parsedIds = ids.Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(s => Guid.TryParse(s.Trim(), out var g) ? g : (Guid?)null)
            .ToList();

        if (parsedIds.Any(g => g == null))
            return BadRequest(new { error = "One or more ids are not valid GUIDs." });

        var guidList = parsedIds.Select(g => g!.Value).Distinct().ToList();

        if (guidList.Count < 2 || guidList.Count > 3)
            return BadRequest(new { error = "Between 2 and 3 plan ids are required for comparison." });

        var result = await _mediator.Send(new GetMultiplePlansQuery(guidList), ct);
        return Ok(result);
    }
}
