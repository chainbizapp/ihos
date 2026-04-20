using Ihos.Application.Common.Interfaces;
using Ihos.Application.Import.Adapters;
using Ihos.Application.Import.Services;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;
using System.Text.Json;

namespace Ihos.Application.Import.Commands;

public record UploadImportFileCommand(
    Guid CompanyId,
    string FileName,
    Stream FileStream,
    /// <summary>
    /// Caller-supplied user ID. When set, the handler uses this instead of
    /// ICurrentUserService (needed for background-task execution where
    /// HttpContext is no longer available).
    /// </summary>
    Guid? UploadedBy = null,
    /// <summary>
    /// When set, the handler reports progress to ImportJobService so the
    /// frontend polling endpoint can return estimated completion time.
    /// </summary>
    Guid? JobId = null
) : IRequest<UploadImportFileResult>;

public record ParseErrorDto(int Row, string Column, string Reason);

public record UploadImportFileResult
{
    public bool Success { get; init; }
    public Guid? BatchId { get; init; }
    public string? SourceFileName { get; init; }
    public int TotalRows { get; init; }
    public int ResolvedRows { get; init; }
    public int PendingRows { get; init; }
    public IReadOnlyList<ParseErrorDto> ParseErrors { get; init; } = [];
}

public class UploadImportFileCommandHandler : IRequestHandler<UploadImportFileCommand, UploadImportFileResult>
{
    private readonly IImportBatchRepository _batches;
    private readonly IImportRecordRepository _records;
    private readonly IInsuranceCompanyRepository _companies;
    private readonly MappingResolverService _mappingResolver;
    private readonly IAuditLogRepository _audit;
    private readonly ICurrentUserService _currentUser;
    private readonly ICompanyAdapterRegistry _adapterRegistry;
    private readonly ImportJobService _jobs;

    public UploadImportFileCommandHandler(
        IImportBatchRepository batches,
        IImportRecordRepository records,
        IInsuranceCompanyRepository companies,
        MappingResolverService mappingResolver,
        IAuditLogRepository audit,
        ICurrentUserService currentUser,
        ICompanyAdapterRegistry adapterRegistry,
        ImportJobService jobs)
    {
        _batches = batches;
        _records = records;
        _companies = companies;
        _mappingResolver = mappingResolver;
        _audit = audit;
        _currentUser = currentUser;
        _adapterRegistry = adapterRegistry;
        _jobs = jobs;
    }

    public async Task<UploadImportFileResult> Handle(UploadImportFileCommand request, CancellationToken ct)
    {
        var company = await _companies.GetByIdAsync(request.CompanyId, ct)
            ?? throw new InvalidOperationException($"Insurance company {request.CompanyId} not found.");

        // Resolve company-specific adapter — no adapter means no integration yet
        var adapter = _adapterRegistry.GetAdapter(request.CompanyId);
        if (adapter == null)
        {
            return new UploadImportFileResult
            {
                Success = false,
                ParseErrors =
                [
                    new ParseErrorDto(0, "Company",
                        $"No import adapter is configured for '{company.Name}'. " +
                        "Please contact support to request integration for this company.")
                ]
            };
        }

        var parseResult = await adapter.ParseAsync(request.FileStream, request.FileName, ct);

        if (!parseResult.Success)
        {
            return new UploadImportFileResult
            {
                Success = false,
                ParseErrors = parseResult.Errors
                    .Select(e => new ParseErrorDto(e.Row, e.Column, e.Reason))
                    .ToList()
            };
        }

        var storagePath = $"imports/{company.ShortCode}/{DateTime.UtcNow:yyyyMMdd}/{Guid.NewGuid()}/{request.FileName}";

        // Use caller-supplied userId (background tasks) or fall back to HttpContext user.
        var userId     = request.UploadedBy ?? _currentUser.UserId;
        var batch = new ImportBatch
        {
            CompanyId      = request.CompanyId,
            SourceFileName = request.FileName,
            SourceFilePath = storagePath,
            UploadedBy     = userId ?? Guid.Empty,
            UploadedAt     = DateTime.UtcNow,
            Status         = ImportBatchStatus.Processing,
            TotalRows      = parseResult.Rows.Count,
            CreatedBy      = userId
        };

        await _batches.AddAsync(batch, ct);
        await _batches.SaveChangesAsync(ct);

        // Register batchId → jobId so batch-list progress polling works immediately
        if (request.JobId.HasValue)
            _jobs.SetBatchId(request.JobId.Value, batch.Id);

        int total = parseResult.Rows.Count;

        if (request.JobId.HasValue)
            _jobs.UpdateProgress(request.JobId.Value, "Resolving mappings...", 0, total);

        // ── Phase 1: Pre-load all mappings (zero per-row DB queries) ───────────
        var ctx = await _mappingResolver.CreateContextAsync(
            request.CompanyId, userId ?? Guid.Empty, ct);

        // Resolve each UNIQUE (vehicleModel, planType) pair once.
        // Levenshtein only runs per distinct raw name — not per row.
        // MappingResolverContext is NOT thread-safe (it accumulates auto-suggestions),
        // so this pass is single-threaded and fast because most raw names repeat.
        var uniquePairs = parseResult.Rows
            .Select(r => (Vehicle: r.RawVehicleModel, Plan: r.RawPlanType))
            .Distinct()
            .ToList();

        var resolutionCache = new Dictionary<(string, string), MappingResolution>(uniquePairs.Count);
        foreach (var (vehicle, plan) in uniquePairs)
            resolutionCache[(vehicle, plan)] = _mappingResolver.Resolve(ctx, vehicle, plan);

        // Persist any auto-suggested mappings before inserting records
        await _mappingResolver.FlushAutoSuggestionsAsync(ctx, ct);

        if (request.JobId.HasValue)
            _jobs.UpdateProgress(request.JobId.Value, "Building records...", 0, total);

        // ── Phase 2: Parallel record construction (CPU-bound: JSON serialisation) ──
        // Now that resolutionCache is read-only, it is safe to access from multiple threads.
        var importRecords = new ImportRecord[total];
        int resolvedAtomic = 0;
        int pendingAtomic  = 0;

        Parallel.For(0, total, i =>
        {
            var row        = parseResult.Rows[i];
            var resolution = resolutionCache[(row.RawVehicleModel, row.RawPlanType)];

            importRecords[i] = new ImportRecord
            {
                BatchId               = batch.Id,
                RowNumber             = i + 1,
                RawData               = JsonSerializer.Serialize(row.ToRawData()),
                VehicleModelMappingId = resolution.VehicleModelMappingId,
                PlanTypeMappingId     = resolution.PlanTypeMappingId,
                MappingStatus         = resolution.MappingStatus,
                ReviewStatus          = ImportReviewStatus.Pending,
                CreatedBy             = userId
            };

            if (resolution.MappingStatus == ImportMappingStatus.Resolved)
                Interlocked.Increment(ref resolvedAtomic);
            else
                Interlocked.Increment(ref pendingAtomic);
        });

        int resolved = resolvedAtomic;
        int pending  = pendingAtomic;

        if (request.JobId.HasValue)
            _jobs.UpdateProgress(request.JobId.Value, "Saving records...", 0, total);

        // ── Phase 3: Single PostgreSQL COPY — one round trip for all rows ───────
        await _records.BulkInsertAsync(importRecords, ct);

        batch.Status       = ImportBatchStatus.PendingReview;
        batch.ResolvedRows = resolved;
        batch.PendingRows  = pending;

        await _batches.SaveChangesAsync(ct);

        await _audit.AddAsync(new AuditLog
        {
            ActorId    = userId,
            ActionType = "ImportBatchCreated",
            EntityType = "ImportBatch",
            EntityId   = batch.Id,
            Outcome    = "Success",
            Metadata   = $"{{\"companyId\":\"{request.CompanyId}\",\"fileName\":\"{request.FileName}\",\"totalRows\":{parseResult.Rows.Count},\"adapter\":\"{adapter.CompanyName}\"}}"
        }, ct);

        return new UploadImportFileResult
        {
            Success        = true,
            BatchId        = batch.Id,
            SourceFileName = request.FileName,
            TotalRows      = batch.TotalRows,
            ResolvedRows   = resolved,
            PendingRows    = pending
        };
    }
}
