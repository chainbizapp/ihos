using Ihos.Domain.Common;
using Ihos.Domain.Enums;

namespace Ihos.Domain.Entities;

public class User : BaseEntity
{
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? PasswordHash { get; set; }
    public UserRole Role { get; set; }
    public UserStatus Status { get; set; } = UserStatus.PendingInvite;
    public string? InviteTokenHash { get; set; }
    public DateTime? InviteExpiresAt { get; set; }

    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
