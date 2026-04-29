using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;

namespace Ihos.Application.Import.Commands;

public record ApproveAllResolvedCommand(Guid BatchId) : IRequest<ApproveAllResolvedResult>;

public record ApproveAllResolvedResult(bool Success, int ApprovedCount, string? Error = null);

public class ApproveAllResolvedCommandHandler
    : IRequestHandler<ApproveAllResolvedCommand, ApproveAllResolvedResult>
{
    private readonly IImportRecordRepository _records;
    private readonly IImportBatchRepository  _batches;
    private readonly IAuditLogRepository     _audit;
    private readonly ICurrentUserService     _currentUser;

    public ApproveAllResolvedCommandHandler(
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

    public async Task<ApproveAllResolvedResult> Handle(
        ApproveAllResolvedCommand request, CancellationToken ct)
    {
        var batch = await _batches.GetByIdAsync(request.BatchId, ct);
        if (batch == null)
            return new ApproveAllResolvedResult(false, 0, "Batch not found.");

        if (batch.Status != ImportBatchStatus.PendingReview)
            return new ApproveAllResolvedResult(false, 0, "Batch is not in PendingReview status.");

        var now    = DateTime.UtcNow;
        var userId = _currentUser.UserId;

        // Single UPDATE statement — no row-by-row loop
        var approvedCount = await _records.BulkApproveResolvedAsync(request.BatchId, userId, now, ct);
        if (approvedCount == 0)
            return new ApproveAllResolvedResult(true, 0);

        await _batches.RecalculateCountersAsync(batch.Id, ct);

        await _audit.AddAsync(new AuditLog
        {
            ActorId    = userId,
            ActionType = "ImportBatchApproveAllResolved",
            EntityType = "ImportBatch",
            EntityId   = request.BatchId,
            Outcome    = "Success",
            Metadata   = $"{{\"approvedCount\":{approvedCount}}}"
        }, ct);

        return new ApproveAllResolvedResult(true, approvedCount);
    }
}
