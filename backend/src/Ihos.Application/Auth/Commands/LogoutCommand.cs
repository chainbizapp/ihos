using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Application.Mediator;

namespace Ihos.Application.Auth.Commands;

public record LogoutCommand(string RefreshToken) : IRequest;

public class LogoutCommandHandler : IRequestHandler<LogoutCommand>
{
    private readonly IRefreshTokenRepository _refreshTokens;
    private readonly IJwtTokenService _jwt;
    private readonly IAuditLogRepository _audit;
    private readonly ICurrentUserService _currentUser;

    public LogoutCommandHandler(
        IRefreshTokenRepository refreshTokens,
        IJwtTokenService jwt,
        IAuditLogRepository audit,
        ICurrentUserService currentUser)
    {
        _refreshTokens = refreshTokens;
        _jwt = jwt;
        _audit = audit;
        _currentUser = currentUser;
    }

    public async Task Handle(LogoutCommand request, CancellationToken ct)
    {
        var tokenHash = _jwt.HashToken(request.RefreshToken);
        var stored = await _refreshTokens.GetByTokenHashAsync(tokenHash, ct);
        if (stored is { RevokedAt: null })
        {
            stored.RevokedAt = DateTime.UtcNow;
            await _refreshTokens.SaveChangesAsync(ct);
        }

        await _audit.AddAsync(new AuditLog
        {
            ActorId = _currentUser.UserId,
            ActionType = "UserLogout",
            EntityType = "User",
            EntityId = _currentUser.UserId,
            Outcome = "Success"
        }, ct);
    }
}
