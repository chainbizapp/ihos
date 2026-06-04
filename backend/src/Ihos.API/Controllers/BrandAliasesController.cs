using Ihos.API.Authorization;
using Ihos.Application.Brands.Commands;
using Ihos.Application.Brands.Queries;
using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ihos.API.Controllers;

/// <summary>
/// Admin management of provider brand aliases (feature 003). Senior Staff minimum — aliases
/// affect how provider catalogues resolve to canonical makes, so the same authority bar as
/// the sync admin applies.
/// </summary>
[ApiController]
[Route("api/mappings/brand-aliases")]
[Authorize(Policy = AuthorizationPolicies.RequireSeniorStaff)]
public class BrandAliasesController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ICurrentUserService _currentUser;

    public BrandAliasesController(IMediator mediator, ICurrentUserService currentUser)
    {
        _mediator = mediator;
        _currentUser = currentUser;
    }

    /// <summary>List aliases, optionally filtered by provider / verification state.</summary>
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? provider = null,
        [FromQuery] bool? verifiedOnly = null,
        CancellationToken ct = default)
    {
        var result = await _mediator.Send(new GetBrandAliasesQuery(provider, verifiedOnly), ct);
        return Ok(result);
    }

    public record UpsertRequest(string ProviderCode, string RawValue, Guid? CanonicalMakeId);

    /// <summary>Create a new alias.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertRequest req, CancellationToken ct)
    {
        try
        {
            var id = await _mediator.Send(new UpsertBrandAliasCommand(
                null, req.ProviderCode, req.RawValue, req.CanonicalMakeId, _currentUser.UserId), ct);
            return Ok(new { id });
        }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    /// <summary>Edit an existing alias (raw value / canonical make).</summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertRequest req, CancellationToken ct)
    {
        try
        {
            await _mediator.Send(new UpsertBrandAliasCommand(
                id, req.ProviderCode, req.RawValue, req.CanonicalMakeId, _currentUser.UserId), ct);
            return Ok(new { id });
        }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    /// <summary>One-click approve an AI guess → verified (starts resolving live).</summary>
    [HttpPost("{id:guid}/verify")]
    public async Task<IActionResult> Verify(Guid id, CancellationToken ct)
    {
        try
        {
            var ok = await _mediator.Send(new VerifyBrandAliasCommand(id, _currentUser.UserId), ct);
            return ok ? Ok() : NotFound();
        }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    /// <summary>Soft-delete an alias.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var ok = await _mediator.Send(new DeleteBrandAliasCommand(id, _currentUser.UserId), ct);
        return ok ? Ok() : NotFound();
    }
}
