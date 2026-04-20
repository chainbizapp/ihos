using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;

namespace Ihos.Application.Auth.Commands;

public record LoginCommand(string Email, string Password) : IRequest<LoginResult>;

public record LoginResult(string AccessToken, int ExpiresIn, UserDto User);

public record UserDto(Guid Id, string Email, string FullName, string Role);

public class LoginCommandHandler : IRequestHandler<LoginCommand, LoginResult>
{
    private readonly IUserRepository _users;
    private readonly IRefreshTokenRepository _refreshTokens;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenService _jwt;
    private readonly IAuditLogRepository _audit;
    private readonly ICurrentUserService _currentUser;

    public LoginCommandHandler(
        IUserRepository users,
        IRefreshTokenRepository refreshTokens,
        IPasswordHasher hasher,
        IJwtTokenService jwt,
        IAuditLogRepository audit,
        ICurrentUserService currentUser)
    {
        _users = users;
        _refreshTokens = refreshTokens;
        _hasher = hasher;
        _jwt = jwt;
        _audit = audit;
        _currentUser = currentUser;
    }

    public async Task<LoginResult> Handle(LoginCommand request, CancellationToken ct)
    {
        var user = await _users.GetByEmailAsync(request.Email, ct);

        if (user == null || user.PasswordHash == null || !_hasher.Verify(request.Password, user.PasswordHash))
        {
            await _audit.AddAsync(new AuditLog
            {
                ActionType = "UserLogin",
                Outcome = "Failure",
                Metadata = $"{{\"email\":\"{request.Email}\",\"reason\":\"InvalidCredentials\"}}"
            }, ct);
            throw new UnauthorizedAccessException("Invalid email or password.");
        }

        if (user.Status is UserStatus.Inactive or UserStatus.PendingInvite or UserStatus.PendingApproval)
        {
            await _audit.AddAsync(new AuditLog
            {
                ActorId = user.Id,
                ActionType = "UserLogin",
                EntityType = "User",
                EntityId = user.Id,
                Outcome = "Failure",
                Metadata = $"{{\"reason\":\"AccountNotActive\",\"status\":\"{user.Status}\"}}"
            }, ct);
            throw new InvalidOperationException($"Account is {user.Status}.");
        }

        var accessToken = _jwt.GenerateAccessToken(user);
        var (plain, hash) = _jwt.GenerateRefreshToken();

        await _refreshTokens.AddAsync(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        }, ct);
        await _refreshTokens.SaveChangesAsync(ct);

        await _audit.AddAsync(new AuditLog
        {
            ActorId = user.Id,
            ActionType = "UserLogin",
            EntityType = "User",
            EntityId = user.Id,
            Outcome = "Success"
        }, ct);

        return new LoginResult(
            accessToken,
            3600,
            new UserDto(user.Id, user.Email, user.FullName, user.Role.ToString()));
    }
}
