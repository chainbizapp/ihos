using Ihos.Application.Common.Interfaces;
using Ihos.Application.Import.Services;
using Ihos.Application.Mediator;
using Ihos.Domain.Enums;

namespace Ihos.Application.Import.Commands;

public record ReResolveBatchMappingsCommand(Guid BatchId) : IRequest<ReResolveBatchMappingsResult>;

public record ReResolveBatchMappingsResult(bool Success, int ResolvedCount, int StillPending, string? Error = null);

public class ReResolveBatchMappingsCommandHandler
    : IRequestHandler<ReResolveBatchMappingsCommand, ReResolveBatchMappingsResult>
{
    private readonly IImportRecordRepository _records;
    private readonly IImportBatchRepository  _batches;
    private readonly MappingResolverService  _resolver;
    private readonly ICurrentUserService     _currentUser;

    public ReResolveBatchMappingsCommandHandler(
        IImportRecordRepository records,
        IImportBatchRepository  batches,
        MappingResolverService  resolver,
        ICurrentUserService     currentUser)
    {
        _records     = records;
        _batches     = batches;
        _resolver    = resolver;
        _currentUser = currentUser;
    }

    public async Task<ReResolveBatchMappingsResult> Handle(
        ReResolveBatchMappingsCommand request, CancellationToken ct)
    {
        var batch = await _batches.GetByIdAsync(request.BatchId, ct);
        if (batch == null)
            return new ReResolveBatchMappingsResult(false, 0, 0, "Batch not found.");

        if (batch.Status != ImportBatchStatus.PendingReview)
            return new ReResolveBatchMappingsResult(false, 0, 0, "Batch is not in PendingReview status.");

        var pendingRecords = await _records.GetPendingMappingByBatchAsync(request.BatchId, ct);
        if (pendingRecords.Count == 0)
            return new ReResolveBatchMappingsResult(true, 0, 0);

        // Pre-load all mappings once for the whole batch.
        // AllowAutoSuggest = false: re-resolve uses only confirmed existing mappings;
        // fuzzy auto-suggestion is reserved for initial import and "Auto Map All".
        var ctx = await _resolver.CreateContextAsync(
            batch.CompanyId, _currentUser.UserId ?? Guid.Empty, ct,
            allowAutoSuggest: false);

        int resolvedCount = 0;
        int stillPending  = 0;

        foreach (var record in pendingRecords)
        {
            // Re-parse raw data to get the raw vehicle/plan type keys
            var rawData = System.Text.Json.JsonSerializer
                .Deserialize<Dictionary<string, string>>(record.RawData)
                ?? [];

            rawData.TryGetValue("vehicle_model", out var rawVehicle);
            rawData.TryGetValue("plan_type",    out var rawPlan);

            if (string.IsNullOrEmpty(rawVehicle) || string.IsNullOrEmpty(rawPlan))
            {
                stillPending++;
                continue;
            }

            var resolution = _resolver.Resolve(ctx, rawVehicle, rawPlan);

            record.VehicleModelMappingId = resolution.VehicleModelMappingId;
            record.PlanTypeMappingId     = resolution.PlanTypeMappingId;
            record.MappingStatus         = resolution.MappingStatus;

            if (resolution.MappingStatus == ImportMappingStatus.Resolved)
                resolvedCount++;
            else
                stillPending++;
        }

        // Flush any new auto-suggestions + save all record updates
        await _resolver.FlushAutoSuggestionsAsync(ctx, ct);

        await _records.SaveChangesAsync(ct);
        await _batches.RecalculateCountersAsync(batch.Id, ct);

        return new ReResolveBatchMappingsResult(true, resolvedCount, stillPending);
    }
}
