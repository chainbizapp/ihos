using Ihos.Domain.Entities;

namespace Ihos.Application.Common.Interfaces;

public interface IJwtTokenService
{
    string GenerateAccessToken(User user);
    (string PlainToken, string TokenHash) GenerateRefreshToken();
    string HashToken(string token);
}
