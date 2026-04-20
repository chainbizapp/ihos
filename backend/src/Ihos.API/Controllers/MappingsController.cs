using Ihos.API.Authorization;
using Ihos.Application.Mapping.Commands;
using Ihos.Application.Mapping.Queries;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ihos.API.Controllers;

[ApiController]
[Route("api/mappings")]
[Authorize(Policy = AuthorizationPolicies.RequireSeniorStaff)]
public class MappingsController : ControllerBase
{
    private readonly IMediator _mediator;

    public MappingsController(IMediator mediator) => _mediator = mediator;

    // ─── Vehicle Model Mappings ───────────────────────────────────────────────

    [HttpGet("vehicle-models")]
    public async Task<IActionResult> GetVehicleModelMappings(
        [FromQuery] Guid? companyId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var result = await _mediator.Send(
            new GetVehicleModelMappingsQuery(companyId, page, pageSize), ct);
        return Ok(result);
    }

    [HttpPost("vehicle-models")]
    public async Task<IActionResult> CreateVehicleModelMapping(
        [FromBody] CreateVehicleModelMappingRequest body,
        CancellationToken ct)
    {
        var id = await _mediator.Send(
            new CreateVehicleModelMappingCommand(body.CompanyId, body.RawName, body.CanonicalModelId), ct);
        return CreatedAtAction(nameof(GetVehicleModelMappings), new { id }, new { id });
    }

    [HttpPut("vehicle-models/{id:guid}")]
    public async Task<IActionResult> UpdateVehicleModelMapping(
        Guid id,
        [FromBody] UpdateVehicleModelMappingRequest body,
        CancellationToken ct)
    {
        var success = await _mediator.Send(new UpdateVehicleModelMappingCommand(id, body.CanonicalModelId), ct);
        if (!success) return NotFound();
        return NoContent();
    }

    // ─── Plan Type Mappings ───────────────────────────────────────────────────

    [HttpGet("plan-types")]
    public async Task<IActionResult> GetPlanTypeMappings(
        [FromQuery] Guid? companyId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var result = await _mediator.Send(
            new GetPlanTypeMappingsQuery(companyId, page, pageSize), ct);
        return Ok(result);
    }

    [HttpPost("plan-types")]
    public async Task<IActionResult> CreatePlanTypeMapping(
        [FromBody] CreatePlanTypeMappingRequest body,
        CancellationToken ct)
    {
        var id = await _mediator.Send(
            new CreatePlanTypeMappingCommand(body.CompanyId, body.RawName, body.CanonicalPlanType), ct);
        return CreatedAtAction(nameof(GetPlanTypeMappings), new { id }, new { id });
    }

    [HttpPut("plan-types/{id:guid}")]
    public async Task<IActionResult> UpdatePlanTypeMapping(
        Guid id,
        [FromBody] UpdatePlanTypeMappingRequest body,
        CancellationToken ct)
    {
        var success = await _mediator.Send(new UpdatePlanTypeMappingCommand(id, body.CanonicalPlanType), ct);
        if (!success) return NotFound();
        return NoContent();
    }
}

public record CreateVehicleModelMappingRequest(Guid CompanyId, string RawName, Guid CanonicalModelId);
public record UpdateVehicleModelMappingRequest(Guid CanonicalModelId);
public record CreatePlanTypeMappingRequest(Guid CompanyId, string RawName, PlanType CanonicalPlanType);
public record UpdatePlanTypeMappingRequest(PlanType CanonicalPlanType);
