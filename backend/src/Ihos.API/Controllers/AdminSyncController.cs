using Ihos.API.Authorization;
using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;
using Ihos.Application.Sync.Commands;
using Ihos.Application.Sync.Queries;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ihos.API.Controllers;

/// <summary>
/// Admin endpoints for triggering and monitoring vehicle-master sync runs. Senior Staff
/// minimum (feature 002 Phase 5 US3). Sync runs in the background — the trigger returns
/// the syncLogId immediately and the UI polls /status.
/// </summary>
[ApiController]
[Route("api/admin/sync")]
[Authorize(Policy = AuthorizationPolicies.RequireSeniorStaff)]
public class AdminSyncController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ICurrentUserService _currentUser;

    public AdminSyncController(IMediator mediator, ICurrentUserService currentUser)
    {
        _mediator = mediator;
        _currentUser = currentUser;
    }

    /// <summary>
    /// Triggers a vehicle-master sync for one API-source company. Returns 202 + syncLogId
    /// while the sync runs in the background. Returns 409 if a sync is already running.
    /// </summary>
    [HttpPost("vehicle-master/{companyId:guid}")]
    public async Task<IActionResult> Trigger(Guid companyId, CancellationToken ct)
    {
        try
        {
            var result = await _mediator.Send(
                new TriggerVehicleSyncCommand(companyId, _currentUser.UserId), ct);
            return Accepted(new
            {
                syncLogId = result.SyncLogId,
                companyShortCode = result.CompanyShortCode,
                message = "Sync started. Poll /api/admin/sync/status for progress.",
            });
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("already running",
            StringComparison.OrdinalIgnoreCase))
        {
            return Conflict(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Current sync state for every active company (one row per company — the latest
    /// VehicleSyncLog plus a Running flag).
    /// </summary>
    [HttpGet("status")]
    public async Task<IActionResult> Status(CancellationToken ct)
    {
        var status = await _mediator.Send(new GetSyncStatusQuery(), ct);
        return Ok(status);
    }

    /// <summary>Paginated audit log of all sync runs, newest first.</summary>
    [HttpGet("history")]
    public async Task<IActionResult> History(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var history = await _mediator.Send(new GetSyncHistoryQuery(page, pageSize), ct);
        return Ok(history);
    }
}
