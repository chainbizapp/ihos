using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;

namespace Ihos.Application.Import.Commands;

public record RejectAllUnresolvedCommand(Guid BatchId) : IRequest<RejectAllUnresolvedResult>;

public record RejectAllUnresolvedResult(bool Success, int RejectedCount, string? Error = null);

public class RejectAllUnresolvedCommandHandler
    : IRequestHandler<RejectAllUnresolvedCommand, RejectAllUnresolvedResult>
{
    private readonly IImportRecordRepository _records;
    private readonly IImportBatchRepository  _batches;
    private readonly IAuditLogRepository     _audit;
    private readonly ICurrentUserService     _currentUser;

    public RejectAllUnresolvedCommandHandler(
        IImportRecordRepository records,
        IImportBatchRepository  batches,
        IAuditLogRepository     audit,
        ICurrentUserService     currentUser)
    {
        _records     = records;
        _batches     = batches;
        _audit       = audit;
        _currentUser = currentUser;
    }

    public async Task<RejectAllUnresolvedResult> Handle(
        RejectAllUnresolvedCommand request, CancellationToken ct)
    {
        var batch = await _batches.GetByIdAsync(request.BatchId, ct);
        if (batch == null)
            return new RejectAllUnresolvedResult(false, 0, "Batch not found.");

        if (batch.Status != ImportBatchStatus.PendingReview)
            return new RejectAllUnresolvedResult(false, 0, "Batch is not in PendingReview status.");

        var now    = DateTime.UtcNow;
        var userId = _currentUser.UserId;

        // Single UPDATE: reject all records currently in 'Pending' review status
        var rejectedCount = await _records.BulkRejectAllPendingAsync(
            request.BatchId, userId, now, "Rejected in bulk by user.", ct);

        if (rejectedCount == 0)
            return new RejectAllUnresolvedResult(true, 0);

        await _batches.RecalculateCountersAsync(batch.Id, ct);

        await _audit.AddAsync(new AuditLog
        {
            ActorId    = userId,
            ActionType = "ImportBatchRejectAllUnresolved",
            EntityType = "ImportBatch",
            EntityId   = request.BatchId,
            Outcome    = "Success",
            Metadata   = $"{{\"rejectedCount\":{rejectedCount}}}"
        }, ct);

        return new RejectAllUnresolvedResult(true, rejectedCount);
    }
}
