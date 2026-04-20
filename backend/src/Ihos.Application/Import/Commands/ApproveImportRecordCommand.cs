using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;

namespace Ihos.Application.Import.Commands;

public record ApproveImportRecordCommand(Guid RecordId) : IRequest<ApproveImportRecordResult>;

public record ApproveImportRecordResult(bool Success, string? Error = null);

public class ApproveImportRecordCommandHandler : IRequestHandler<ApproveImportRecordCommand, ApproveImportRecordResult>
{
    private readonly IImportRecordRepository _records;
    private readonly IImportBatchRepository _batches;
    private readonly IAuditLogRepository _audit;
    private readonly ICurrentUserService _currentUser;

    public ApproveImportRecordCommandHandler(
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

    public async Task<ApproveImportRecordResult> Handle(ApproveImportRecordCommand request, CancellationToken ct)
    {
        var record = await _records.GetByIdAsync(request.RecordId, ct);
        if (record == null)
            return new ApproveImportRecordResult(false, "Record not found.");

        if (record.MappingStatus == ImportMappingStatus.PendingMapping)
            return new ApproveImportRecordResult(false, "Cannot approve a record with unresolved mappings.");

        if (record.ReviewStatus != ImportReviewStatus.Pending)
            return new ApproveImportRecordResult(false, $"Record is already {record.ReviewStatus}.");

        record.ReviewStatus = ImportReviewStatus.Approved;
        record.ReviewedBy = _currentUser.UserId;
        record.ReviewedAt = DateTime.UtcNow;

        // Update batch counts
        var batch = await _batches.GetByIdAsync(record.BatchId, ct);
        if (batch != null)
        {
            batch.ApprovedRows++;
        }

        await _records.SaveChangesAsync(ct);

        await _audit.AddAsync(new AuditLog
        {
            ActorId = _currentUser.UserId,
            ActionType = "ImportRecordApproved",
            EntityType = "ImportRecord",
            EntityId = record.Id,
            Outcome = "Success",
            Metadata = $"{{\"batchId\":\"{record.BatchId}\"}}"
        }, ct);

        return new ApproveImportRecordResult(true);
    }
}
