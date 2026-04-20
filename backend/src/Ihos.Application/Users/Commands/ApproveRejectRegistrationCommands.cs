using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;

namespace Ihos.Application.Users.Commands;

public record ApproveRegistrationCommand(Guid UserId) : IRequest;

public class ApproveRegistrationCommandHandler : IRequestHandler<ApproveRegistrationCommand>
{
    private readonly IUserRepository _users;
    private readonly IAuditLogRepository _audit;
    private readonly ICurrentUserService _currentUser;

    public ApproveRegistrationCommandHandler(
        IUserRepository users,
        IAuditLogRepository audit,
        ICurrentUserService currentUser)
    {
        _users = users;
        _audit = audit;
        _currentUser = currentUser;
    }

    public async Task Handle(ApproveRegistrationCommand request, CancellationToken ct)
    {
        var user = await _users.GetByIdAsync(request.UserId, ct)
            ?? throw new KeyNotFoundException("User not found.");

        if (user.Status != UserStatus.PendingApproval)
            throw new InvalidOperationException("User is not in PendingApproval status.");

        user.Status = UserStatus.Active;
        await _users.SaveChangesAsync(ct);

        await _audit.AddAsync(new AuditLog
        {
            ActorId = _currentUser.UserId,
            ActionType = "RegistrationApproved",
            EntityType = "User",
            EntityId = user.Id,
            Outcome = "Success"
        }, ct);
    }
}

public record RejectRegistrationCommand(Guid UserId, string? Reason) : IRequest;

public class RejectRegistrationCommandHandler : IRequestHandler<RejectRegistrationCommand>
{
    private readonly IUserRepository _users;
    private readonly IAuditLogRepository _audit;
    private readonly ICurrentUserService _currentUser;

    public RejectRegistrationCommandHandler(
        IUserRepository users,
        IAuditLogRepository audit,
        ICurrentUserService currentUser)
    {
        _users = users;
        _audit = audit;
        _currentUser = currentUser;
    }

    public async Task Handle(RejectRegistrationCommand request, CancellationToken ct)
    {
        var user = await _users.GetByIdAsync(request.UserId, ct)
            ?? throw new KeyNotFoundException("User not found.");

        if (user.Status != UserStatus.PendingApproval)
            throw new InvalidOperationException("User is not in PendingApproval status.");

        user.Status = UserStatus.Rejected;
        await _users.SaveChangesAsync(ct);

        await _audit.AddAsync(new AuditLog
        {
            ActorId = _currentUser.UserId,
            ActionType = "RegistrationRejected",
            EntityType = "User",
            EntityId = user.Id,
            Outcome = "Success",
            Metadata = request.Reason != null ? $"{{\"reason\":\"{request.Reason}\"}}" : null
        }, ct);
    }
}
