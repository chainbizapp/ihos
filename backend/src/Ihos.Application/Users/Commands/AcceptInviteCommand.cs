using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;

namespace Ihos.Application.Users.Commands;

public record AcceptInviteCommand(string Token, string Password, string ConfirmPassword) : IRequest<AcceptInviteResult>;

public record AcceptInviteResult(string AccessToken, string RefreshToken);

public class AcceptInviteCommandHandler : IRequestHandler<AcceptInviteCommand, AcceptInviteResult>
{
    private readonly IUserRepository _users;
    private readonly IRefreshTokenRepository _refreshTokens;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenService _jwt;
    private readonly IAuditLogRepository _audit;

    public AcceptInviteCommandHandler(
        IUserRepository users,
        IRefreshTokenRepository refreshTokens,
        IPasswordHasher hasher,
        IJwtTokenService jwt,
        IAuditLogRepository audit)
    {
        _users = users;
        _refreshTokens = refreshTokens;
        _hasher = hasher;
        _jwt = jwt;
        _audit = audit;
    }

    public async Task<AcceptInviteResult> Handle(AcceptInviteCommand request, CancellationToken ct)
    {
        if (request.Password != request.ConfirmPassword)
            throw new ArgumentException("Passwords do not match.");

        var tokenHash = _jwt.HashToken(request.Token);
        var user = await _users.GetByInviteTokenHashAsync(tokenHash, ct);

        if (user == null || user.Status != UserStatus.PendingInvite)
            throw new ArgumentException("Invalid or already used invite token.");

        if (user.InviteExpiresAt < DateTime.UtcNow)
            throw new ArgumentException("Invite token has expired.");

        user.PasswordHash = _hasher.Hash(request.Password);
        user.InviteTokenHash = null;
        user.InviteExpiresAt = null;
        user.Status = UserStatus.Active;

        await _users.SaveChangesAsync(ct);

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
            ActionType = "InviteAccepted",
            EntityType = "User",
            EntityId = user.Id,
            Outcome = "Success"
        }, ct);

        return new AcceptInviteResult(accessToken, plain);
    }
}
