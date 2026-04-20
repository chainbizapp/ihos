using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;

namespace Ihos.Application.Users.Commands;

public record DeactivateUserCommand(Guid UserId) : IRequest;

public class DeactivateUserCommandHandler : IRequestHandler<DeactivateUserCommand>
{
    private readonly IUserRepository _users;
    private readonly IAuditLogRepository _audit;
    private readonly ICurrentUserService _currentUser;

    public DeactivateUserCommandHandler(
        IUserRepository users,
        IAuditLogRepository audit,
        ICurrentUserService currentUser)
    {
        _users = users;
        _audit = audit;
        _currentUser = currentUser;
    }

    public async Task Handle(DeactivateUserCommand request, CancellationToken ct)
    {
        var user = await _users.GetByIdAsync(request.UserId, ct)
            ?? throw new KeyNotFoundException("User not found.");

        user.Status = UserStatus.Inactive;
        await _users.SaveChangesAsync(ct);

        await _audit.AddAsync(new AuditLog
        {
            ActorId = _currentUser.UserId,
            ActionType = "UserDeactivated",
            EntityType = "User",
            EntityId = user.Id,
            Outcome = "Success"
        }, ct);
    }
}
