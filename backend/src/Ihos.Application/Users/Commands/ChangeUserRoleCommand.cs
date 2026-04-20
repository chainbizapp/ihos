using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;

namespace Ihos.Application.Users.Commands;

public record ChangeUserRoleCommand(Guid UserId, UserRole NewRole) : IRequest;

public class ChangeUserRoleCommandHandler : IRequestHandler<ChangeUserRoleCommand>
{
    private readonly IUserRepository _users;
    private readonly IAuditLogRepository _audit;
    private readonly ICurrentUserService _currentUser;

    public ChangeUserRoleCommandHandler(
        IUserRepository users,
        IAuditLogRepository audit,
        ICurrentUserService currentUser)
    {
        _users = users;
        _audit = audit;
        _currentUser = currentUser;
    }

    public async Task Handle(ChangeUserRoleCommand request, CancellationToken ct)
    {
        var user = await _users.GetByIdAsync(request.UserId, ct)
            ?? throw new KeyNotFoundException("User not found.");

        var oldRole = user.Role;
        user.Role = request.NewRole;
        await _users.SaveChangesAsync(ct);

        await _audit.AddAsync(new AuditLog
        {
            ActorId = _currentUser.UserId,
            ActionType = "RoleChanged",
            EntityType = "User",
            EntityId = user.Id,
            Outcome = "Success",
            Metadata = $"{{\"from\":\"{oldRole}\",\"to\":\"{request.NewRole}\"}}"
        }, ct);
    }
}
