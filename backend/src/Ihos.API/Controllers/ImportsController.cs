using Ihos.API.Authorization;
using Ihos.Application.Common.Interfaces;
using Ihos.Application.Import.Commands;
using Ihos.Application.Import.Queries;
using Ihos.Application.Import.Services;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ihos.API.Controllers;

[ApiController]
[Route("api/imports")]
[Authorize]
public class ImportsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ImportJobService _jobs;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ICurrentUserService _currentUser;

    public ImportsController(
        IMediator mediator,
        ImportJobService jobs,
        IServiceScopeFactory scopeFactory,
        ICurrentUserService currentUser)
    {
        _mediator     = mediator;
        _jobs         = jobs;
        _scopeFactory = scopeFactory;
        _currentUser  = currentUser;
    }

    /// <summary>
    /// Upload an Excel or CSV file.
    /// Returns 202 Accepted immediately with a jobId.
    /// The file is processed in the background; poll GET /jobs/{jobId} for status.
    /// </summary>
    [HttpPost("upload")]
    [Authorize(Policy = AuthorizationPolicies.RequireSeniorStaff)]
    [RequestSizeLimit(50 * 1024 * 1024)] // 50 MB
    public async Task<IActionResult> Upload(
        [FromForm] Guid companyId,
        IFormFile file,
        CancellationToken ct)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "No file provided." });

        // Read file bytes NOW — the IFormFile stream is disposed when the request ends.
        var fileBytes = new byte[file.Length];
        await using (var stream = file.OpenReadStream())
            await stream.ReadExactlyAsync(fileBytes, ct);

        // Capture caller identity before the request scope is torn down.
        var uploadedBy = _currentUser.UserId;
        var fileName   = file.FileName;

        var jobId = _jobs.CreateJob();

        // Fire-and-forget: run the heavy import in a background task with its own DI scope.
        _ = Task.Run(async () =>
        {
            using var scope   = _scopeFactory.CreateScope();
            var mediator      = scope.ServiceProvider.GetRequiredService<IMediator>();
            await using var ms = new MemoryStream(fileBytes);

            try
            {
                var result = await mediator.Send(
                    new UploadImportFileCommand(companyId, fileName, ms, uploadedBy, jobId));

                if (result.Success)
                    _jobs.Complete(jobId, result);
                else
                    _jobs.Fail(jobId,
                        result.ParseErrors.Count > 0
                            ? result.ParseErrors[0].Reason
                            : "File parsing failed.");
            }
            catch (Exception ex)
            {
                _jobs.Fail(jobId, ex.Message);
            }
        });

        return Accepted(new { jobId, status = "processing" });
    }

    /// <summary>
    /// Poll the status of a background import job started by POST /upload.
    /// </summary>
    [HttpGet("jobs/{jobId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.RequireSeniorStaff)]
    public IActionResult GetJobStatus(Guid jobId)
    {
        var entry = _jobs.GetJob(jobId);
        if (entry == null) return NotFound(new { error = "Job not found." });

        if (entry.Status == ImportJobStatus.Failed)
            return Ok(new { status = "failed", error = entry.Error });

        if (entry.Status == ImportJobStatus.Done)
            return Ok(new
            {
                status       = "done",
                batchId      = entry.Result!.BatchId,
                totalRows    = entry.Result.TotalRows,
                resolvedRows = entry.Result.ResolvedRows,
                pendingRows  = entry.Result.PendingRows
            });

        // Processing — compute progress and estimated finish time
        var elapsed       = (DateTimeOffset.UtcNow - entry.StartedAt).TotalSeconds;
        var processed     = entry.ProcessedRows;
        var total         = entry.TotalRows;
        double? etaSeconds = null;
        if (processed > 0 && total > 0)
        {
            var rowsPerSec = processed / elapsed;
            var remaining  = total - processed;
            etaSeconds = remaining / rowsPerSec;
        }

        return Ok(new
        {
            status         = "processing",
            stage          = entry.Stage,
            processedRows  = processed,
            totalRows      = total,
            elapsedSeconds = (int)elapsed,
            etaSeconds     = etaSeconds.HasValue ? (int)etaSeconds.Value : (int?)null
        });
    }

    /// <summary>
    /// Get live progress for a batch that is currently being processed in the background.
    /// Returns null when no in-memory job exists for this batch (already done or server restarted).
    /// </summary>
    [HttpGet("batches/{batchId:guid}/progress")]
    [Authorize(Policy = AuthorizationPolicies.RequireSeniorStaff)]
    public IActionResult GetBatchProgress(Guid batchId)
    {
        var entry = _jobs.GetJobByBatchId(batchId);
        if (entry == null)
            return Ok(new { found = false });

        var elapsed       = (DateTimeOffset.UtcNow - entry.StartedAt).TotalSeconds;
        var processed     = entry.ProcessedRows;
        var total         = entry.TotalRows;
        double? etaSeconds = null;
        if (processed > 0 && total > 0)
        {
            var rowsPerSec = processed / elapsed;
            etaSeconds     = (total - processed) / rowsPerSec;
        }

        return Ok(new
        {
            found          = true,
            status         = entry.Status.ToString().ToLower(),
            stage          = entry.Stage,
            processedRows  = processed,
            totalRows      = total,
            elapsedSeconds = (int)elapsed,
            etaSeconds     = etaSeconds.HasValue ? (int)etaSeconds.Value : (int?)null
        });
    }

    /// <summary>
    /// Get paginated list of import batches.
    /// </summary>
    [HttpGet("batches")]
    [Authorize(Policy = AuthorizationPolicies.RequireSeniorStaff)]
    public async Task<IActionResult> GetBatches(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] Guid? companyId = null,
        [FromQuery] string? status = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        CancellationToken ct = default)
    {
        ImportBatchStatus? parsedStatus = null;
        if (!string.IsNullOrEmpty(status) && Enum.TryParse<ImportBatchStatus>(status, true, out var s))
            parsedStatus = s;

        var result = await _mediator.Send(
            new GetImportBatchesQuery(page, pageSize, companyId, parsedStatus, fromDate, toDate), ct);

        return Ok(result);
    }

    /// <summary>
    /// Get a single import batch by ID.
    /// </summary>
    [HttpGet("batches/{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.RequireSeniorStaff)]
    public async Task<IActionResult> GetBatch(
        Guid id,
        [FromQuery] int recordPage = 1,
        [FromQuery] int recordPageSize = 50,
        [FromQuery] bool issuesOnly = false,
        CancellationToken ct = default)
    {
        var result = await _mediator.Send(
            new GetImportBatchDetailQuery(id, recordPage, recordPageSize, issuesOnly), ct);

        if (result == null) return NotFound();
        return Ok(result);
    }

    /// <summary>
    /// Get paginated records for a batch.
    /// </summary>
    [HttpGet("batches/{id:guid}/records")]
    [Authorize(Policy = AuthorizationPolicies.RequireSeniorStaff)]
    public async Task<IActionResult> GetBatchRecords(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] bool issuesOnly = false,
        CancellationToken ct = default)
    {
        var result = await _mediator.Send(
            new GetImportBatchDetailQuery(id, page, pageSize, issuesOnly), ct);

        if (result == null) return NotFound();

        return Ok(new
        {
            items = result.Records,
            totalCount = result.RecordsTotalCount,
            page = result.RecordsPage,
            pageSize = result.RecordsPageSize
        });
    }

    /// <summary>
    /// Returns the top duplicate record groups in a batch — records with the same effective unique key.
    /// </summary>
    [HttpGet("batches/{id:guid}/duplicates")]
    [Authorize(Policy = AuthorizationPolicies.RequireSeniorStaff)]
    public async Task<IActionResult> GetBatchDuplicates(Guid id, [FromQuery] int limit = 30, CancellationToken ct = default)
    {
        var result = await _mediator.Send(new GetBatchDuplicatesQuery(id, limit), ct);
        return Ok(result);
    }

    /// <summary>
    /// Re-run mapping resolution for all PendingMapping records in a batch (Manager+).
    /// Use this after adding new plan type or vehicle mappings.
    /// </summary>
    [HttpPost("batches/{id:guid}/re-resolve")]
    [Authorize(Policy = AuthorizationPolicies.RequireManager)]
    public async Task<IActionResult> ReResolveMappings(Guid id, CancellationToken ct)
    {
        var result = await _mediator.Send(new ReResolveBatchMappingsCommand(id), ct);
        if (!result.Success)
            return Conflict(new { error = result.Error });
        return Ok(new { resolvedCount = result.ResolvedCount, stillPending = result.StillPending });
    }

    /// <summary>
    /// Approve all Resolved+Pending records in a batch in one shot (Manager+).
    /// </summary>
    [HttpPost("batches/{id:guid}/approve-all-resolved")]
    [Authorize(Policy = AuthorizationPolicies.RequireManager)]
    public async Task<IActionResult> ApproveAllResolved(Guid id, CancellationToken ct)
    {
        var result = await _mediator.Send(new ApproveAllResolvedCommand(id), ct);
        if (!result.Success)
            return Conflict(new { error = result.Error });
        return Ok(new { approvedCount = result.ApprovedCount });
    }

    /// <summary>
    /// Approve a single import record (Manager+).
    /// </summary>
    [HttpPut("records/{recordId:guid}/approve")]
    [Authorize(Policy = AuthorizationPolicies.RequireManager)]
    public async Task<IActionResult> ApproveRecord(Guid recordId, CancellationToken ct)
    {
        var result = await _mediator.Send(new ApproveImportRecordCommand(recordId), ct);
        if (!result.Success)
            return Conflict(new { error = result.Error });
        return NoContent();
    }

    /// <summary>
    /// Reject a single import record with optional reason (Manager+).
    /// </summary>
    [HttpPut("records/{recordId:guid}/reject")]
    [Authorize(Policy = AuthorizationPolicies.RequireManager)]
    public async Task<IActionResult> RejectRecord(Guid recordId, [FromBody] RejectRecordRequest body, CancellationToken ct)
    {
        var result = await _mediator.Send(new RejectImportRecordCommand(recordId, body.Reason), ct);
        if (!result.Success)
            return Conflict(new { error = result.Error });
        return NoContent();
    }

    /// <summary>
    /// Reject all PendingMapping records in a batch in one shot (Manager+).
    /// Use this to skip unmapped vehicles and allow publish to proceed.
    /// </summary>
    [HttpPost("batches/{id:guid}/reject-all-unresolved")]
    [Authorize(Policy = AuthorizationPolicies.RequireManager)]
    public async Task<IActionResult> RejectAllUnresolved(Guid id, CancellationToken ct)
    {
        var result = await _mediator.Send(new RejectAllUnresolvedCommand(id), ct);
        if (!result.Success)
            return Conflict(new { error = result.Error });
        return Ok(new { rejectedCount = result.RejectedCount });
    }

    /// <summary>
    /// Publish an import batch — creates InsurancePlan records (Manager+).
    /// </summary>
    [HttpPost("batches/{id:guid}/publish")]
    [Authorize(Policy = AuthorizationPolicies.RequireManager)]
    public async Task<IActionResult> PublishBatch(Guid id, CancellationToken ct)
    {
        var result = await _mediator.Send(new PublishImportBatchCommand(id), ct);
        if (!result.Success)
            return Conflict(new { error = result.Error });
        return Ok(new
        {
            plansCreated = result.PlansCreated,
            plansUpdated = result.PlansUpdated,
            errorCount = result.Errors?.Count ?? 0,
            errors = result.Errors
        });
    }

    /// <summary>
    /// Soft-delete an import batch. The record is retained for audit purposes;
    /// it no longer appears in the batch list. Manager+ only.
    /// </summary>
    [HttpDelete("batches/{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.RequireManager)]
    public async Task<IActionResult> DeleteBatch(Guid id, [FromBody] DeleteBatchRequest body, CancellationToken ct)
    {
        var result = await _mediator.Send(new DeleteImportBatchCommand(id, body.Reason), ct);
        if (!result.Success)
            return Conflict(new { error = result.Error });
        return NoContent();
    }

    /// <summary>
    /// Sync a Viriyah YMM master file (db_master_car_master_v2.csv) against the vehicle
    /// database. Creates missing makes, models, and carname_code → canonical model mappings.
    /// Returns a full reconciliation report (new vs existing).
    /// Manager+ only.
    /// </summary>
    [HttpPost("vehicles/viriyah/sync")]
    [Authorize(Policy = AuthorizationPolicies.RequireManager)]
    [RequestSizeLimit(20 * 1024 * 1024)] // 20 MB
    public async Task<IActionResult> SyncViriyahVehicleMaster(
        [FromForm] Guid companyId,
        IFormFile file,
        CancellationToken ct)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "No file provided." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".csv")
            return BadRequest(new { error = "Vehicle master sync expects a .csv file." });

        await using var stream = file.OpenReadStream();
        var result = await _mediator.Send(new SyncVehicleMasterCommand(companyId, stream), ct);

        return Ok(result);
    }
}

public record RejectRecordRequest(string? Reason);
public record DeleteBatchRequest(string? Reason);
