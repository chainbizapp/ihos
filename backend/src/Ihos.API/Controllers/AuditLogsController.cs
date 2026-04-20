using Ihos.API.Authorization;
using Ihos.Application.Common.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ihos.API.Controllers;

[ApiController]
[Route("api/audit-logs")]
[Authorize(Policy = AuthorizationPolicies.RequireAdmin)]
public class AuditLogsController : ControllerBase
{
    private readonly IAuditLogRepository _repo;

    public AuditLogsController(IAuditLogRepository repo) => _repo = repo;

    /// <summary>
    /// Paginated audit log, filterable by actionType and date range.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] string? actionType = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        CancellationToken ct = default)
    {
        pageSize = Math.Clamp(pageSize, 1, 100);
        page = Math.Max(1, page);

        var toInclusive = to.HasValue ? to.Value.Date.AddDays(1).AddTicks(-1) : (DateTime?)null;

        var items = await _repo.GetPagedAsync(
            page, pageSize, actionType, from, toInclusive, ct);

        // For totalCount we fetch one extra page to detect overflow (simple approach)
        var totalCount = await _repo.CountAsync(actionType, from, toInclusive, ct);

        return Ok(new
        {
            items,
            totalCount,
            page,
            pageSize
        });
    }
}
