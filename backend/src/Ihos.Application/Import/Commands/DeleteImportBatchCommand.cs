using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;

namespace Ihos.Application.Import.Commands;

public record DeleteImportBatchCommand(Guid BatchId, string? Reason = null) : IRequest<DeleteImportBatchResult>;

public record DeleteImportBatchResult(bool Success, string? Error = null);

public class DeleteImportBatchCommandHandler : IRequestHandler<DeleteImportBatchCommand, DeleteImportBatchResult>
{
    private readonly IImportBatchRepository _batches;
    private readonly IAuditLogRepository _audit;
    private readonly ICurrentUserService _currentUser;

    public DeleteImportBatchCommandHandler(
        IImportBatchRepository batches,
        IAuditLogRepository audit,
        ICurrentUserService currentUser)
    {
        _batches     = batches;
        _audit       = audit;
        _currentUser = currentUser;
    }

    public async Task<DeleteImportBatchResult> Handle(DeleteImportBatchCommand request, CancellationToken ct)
    {
        var batch = await _batches.GetByIdAsync(request.BatchId, ct);
        if (batch == null)
            return new DeleteImportBatchResult(false, "Batch not found.");

        if (batch.Status == ImportBatchStatus.Processing)
            return new DeleteImportBatchResult(false, "Cannot delete a batch that is still processing.");

        var userId = _currentUser.UserId;

        batch.IsDeleted      = true;
        batch.DeletedBy      = userId;
        batch.DeletedAt      = DateTime.UtcNow;
        batch.DeletionReason = request.Reason;

        await _audit.AddAsync(new AuditLog
        {
            ActorId    = userId,
            ActionType = "ImportBatchDeleted",
            EntityType = "ImportBatch",
            EntityId   = batch.Id,
            Outcome    = "Success",
            Metadata   = $"{{\"companyId\":\"{batch.CompanyId}\",\"fileName\":\"{batch.SourceFileName}\",\"status\":\"{batch.Status}\",\"reason\":\"{request.Reason ?? ""}\"}}"
        }, ct);

        await _batches.SaveChangesAsync(ct);

        return new DeleteImportBatchResult(true);
    }
}
