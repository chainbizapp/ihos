using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;

namespace Ihos.Application.Users.Commands;

public record InviteUserCommand(string Email, string FullName, UserRole Role) : IRequest<InviteUserResult>;

public record InviteUserResult(Guid Id, string Email, string Status);

public class InviteUserCommandHandler : IRequestHandler<InviteUserCommand, InviteUserResult>
{
    private readonly IUserRepository _users;
    private readonly IJwtTokenService _jwt;
    private readonly IEmailService _email;
    private readonly IAuditLogRepository _audit;
    private readonly ICurrentUserService _currentUser;
    private readonly IAppSettings _appSettings;

    public InviteUserCommandHandler(
        IUserRepository users,
        IJwtTokenService jwt,
        IEmailService email,
        IAuditLogRepository audit,
        ICurrentUserService currentUser,
        IAppSettings appSettings)
    {
        _users = users;
        _jwt = jwt;
        _email = email;
        _audit = audit;
        _currentUser = currentUser;
        _appSettings = appSettings;
    }

    public async Task<InviteUserResult> Handle(InviteUserCommand request, CancellationToken ct)
    {
        var existing = await _users.GetByEmailAsync(request.Email, ct);
        if (existing != null)
            throw new InvalidOperationException("Email is already registered.");

        var plainToken = Guid.NewGuid().ToString("N");
        var tokenHash = _jwt.HashToken(plainToken);

        var user = new User
        {
            Email = request.Email.ToLower(),
            FullName = request.FullName,
            Role = request.Role,
            Status = UserStatus.PendingInvite,
            InviteTokenHash = tokenHash,
            InviteExpiresAt = DateTime.UtcNow.AddHours(48),
            CreatedBy = _currentUser.UserId
        };

        await _users.AddAsync(user, ct);
        await _users.SaveChangesAsync(ct);

        var inviteLink = $"{_appSettings.BaseUrl}/auth/accept-invite?token={plainToken}";
        await _email.SendInviteAsync(user.Email, user.FullName, inviteLink, ct);

        await _audit.AddAsync(new AuditLog
        {
            ActorId = _currentUser.UserId,
            ActionType = "UserInvited",
            EntityType = "User",
            EntityId = user.Id,
            Outcome = "Success",
            Metadata = $"{{\"role\":\"{request.Role}\",\"email\":\"{request.Email}\"}}"
        }, ct);

        return new InviteUserResult(user.Id, user.Email, user.Status.ToString());
    }
}
