using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;

namespace Ihos.Application.Import.Commands;

public record RejectImportRecordCommand(Guid RecordId, string? Reason = null) : IRequest<RejectImportRecordResult>;

public record RejectImportRecordResult(bool Success, string? Error = null);

public class RejectImportRecordCommandHandler : IRequestHandler<RejectImportRecordCommand, RejectImportRecordResult>
{
    private readonly IImportRecordRepository _records;
    private readonly IImportBatchRepository _batches;
    private readonly IAuditLogRepository _audit;
    private readonly ICurrentUserService _currentUser;

    public RejectImportRecordCommandHandler(
        IImportRecordRepository records,
        IImportBatchRepository batches,
        IAuditLogRepository audit,
        ICurrentUserService currentUser)
    {
        _records = records;
        _batches = batches;
        _audit = audit;
        _currentUser = currentUser;
    }

    public async Task<RejectImportRecordResult> Handle(RejectImportRecordCommand request, CancellationToken ct)
    {
        var record = await _records.GetByIdAsync(request.RecordId, ct);
        if (record == null)
            return new RejectImportRecordResult(false, "Record not found.");

        if (record.ReviewStatus != ImportReviewStatus.Pending)
            return new RejectImportRecordResult(false, $"Record is already {record.ReviewStatus}.");

        record.ReviewStatus = ImportReviewStatus.Rejected;
        record.ReviewedBy = _currentUser.UserId;
        record.ReviewedAt = DateTime.UtcNow;
        record.RejectionReason = request.Reason;

        // Update batch counts
        var batch = await _batches.GetByIdAsync(record.BatchId, ct);
        if (batch != null)
        {
            batch.RejectedRows++;
        }

        await _records.SaveChangesAsync(ct);

        await _audit.AddAsync(new AuditLog
        {
            ActorId = _currentUser.UserId,
            ActionType = "ImportRecordRejected",
            EntityType = "ImportRecord",
            EntityId = record.Id,
            Outcome = "Success",
            Metadata = $"{{\"batchId\":\"{record.BatchId}\",\"reason\":\"{request.Reason?.Replace("\"", "\\\"")}\"}}"
        }, ct);

        return new RejectImportRecordResult(true);
    }
}
