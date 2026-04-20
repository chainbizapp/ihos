using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Application.Mediator;

namespace Ihos.Application.Auth.Commands;

public record RefreshTokenCommand(string RefreshToken) : IRequest<RefreshTokenResult>;

public record RefreshTokenResult(string AccessToken, string NewRefreshToken);

public class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, RefreshTokenResult>
{
    private readonly IRefreshTokenRepository _refreshTokens;
    private readonly IJwtTokenService _jwt;

    public RefreshTokenCommandHandler(IRefreshTokenRepository refreshTokens, IJwtTokenService jwt)
    {
        _refreshTokens = refreshTokens;
        _jwt = jwt;
    }

    public async Task<RefreshTokenResult> Handle(RefreshTokenCommand request, CancellationToken ct)
    {
        var tokenHash = _jwt.HashToken(request.RefreshToken);
        var stored = await _refreshTokens.GetByTokenHashAsync(tokenHash, ct);

        if (stored == null || !stored.IsActive)
            throw new UnauthorizedAccessException("Refresh token is invalid or expired.");

        stored.RevokedAt = DateTime.UtcNow;

        var (plain, hash) = _jwt.GenerateRefreshToken();
        await _refreshTokens.AddAsync(new RefreshToken
        {
            UserId = stored.UserId,
            TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        }, ct);
        await _refreshTokens.SaveChangesAsync(ct);

        var accessToken = _jwt.GenerateAccessToken(stored.User);
        return new RefreshTokenResult(accessToken, plain);
    }
}
