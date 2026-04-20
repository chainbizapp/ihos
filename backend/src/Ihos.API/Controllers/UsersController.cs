using Ihos.API.Authorization;
using Ihos.Application.Users.Commands;
using Ihos.Application.Users.Queries;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ihos.API.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IMediator _mediator;

    public UsersController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    [Authorize(Policy = AuthorizationPolicies.RequireManager)]
    public async Task<IActionResult> GetUsers(
        [FromQuery] string? status,
        [FromQuery] string? role,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        UserStatus? statusEnum = Enum.TryParse<UserStatus>(status, true, out var s) ? s : null;
        UserRole? roleEnum = Enum.TryParse<UserRole>(role, true, out var r) ? r : null;

        var result = await _mediator.Send(new GetUsersQuery(page, pageSize, statusEnum, roleEnum), ct);
        return Ok(result);
    }

    [HttpPost("invite")]
    [Authorize(Policy = AuthorizationPolicies.RequireManager)]
    public async Task<IActionResult> InviteUser([FromBody] InviteUserRequest request, CancellationToken ct)
    {
        if (!Enum.TryParse<UserRole>(request.Role, true, out var role))
            return BadRequest(new { error = "InvalidRole" });

        var result = await _mediator.Send(new InviteUserCommand(request.Email, request.FullName, role), ct);
        return CreatedAtAction(nameof(GetUsers), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}/role")]
    [Authorize(Policy = AuthorizationPolicies.RequireAdmin)]
    public async Task<IActionResult> ChangeRole(Guid id, [FromBody] ChangeRoleRequest request, CancellationToken ct)
    {
        if (!Enum.TryParse<UserRole>(request.Role, true, out var role))
            return BadRequest(new { error = "InvalidRole" });

        await _mediator.Send(new ChangeUserRoleCommand(id, role), ct);
        return Ok();
    }

    [HttpPut("{id:guid}/status")]
    [Authorize(Policy = AuthorizationPolicies.RequireAdmin)]
    public async Task<IActionResult> ChangeStatus(Guid id, [FromBody] ChangeStatusRequest request, CancellationToken ct)
    {
        if (string.Equals(request.Status, "Inactive", StringComparison.OrdinalIgnoreCase))
        {
            await _mediator.Send(new DeactivateUserCommand(id), ct);
            return Ok();
        }
        return BadRequest(new { error = "Only deactivation is supported via this endpoint." });
    }

    [HttpGet("registrations/pending")]
    [Authorize(Policy = AuthorizationPolicies.RequireManager)]
    public async Task<IActionResult> GetPendingRegistrations(CancellationToken ct)
    {
        var result = await _mediator.Send(new GetPendingRegistrationsQuery(), ct);
        return Ok(result);
    }

    [HttpPut("registrations/{id:guid}/approve")]
    [Authorize(Policy = AuthorizationPolicies.RequireManager)]
    public async Task<IActionResult> ApproveRegistration(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new ApproveRegistrationCommand(id), ct);
        return Ok();
    }

    [HttpPut("registrations/{id:guid}/reject")]
    [Authorize(Policy = AuthorizationPolicies.RequireManager)]
    public async Task<IActionResult> RejectRegistration(Guid id, [FromBody] RejectRegistrationRequest? request, CancellationToken ct)
    {
        await _mediator.Send(new RejectRegistrationCommand(id, request?.Reason), ct);
        return Ok();
    }
}

public record InviteUserRequest(string Email, string FullName, string Role);
public record ChangeRoleRequest(string Role);
public record ChangeStatusRequest(string Status);
public record RejectRegistrationRequest(string? Reason);
