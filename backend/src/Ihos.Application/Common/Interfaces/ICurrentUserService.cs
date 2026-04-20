namespace Ihos.Application.Common.Interfaces;

public interface ICurrentUserService
{
    Guid? UserId { get; }
    string? Role { get; }
    string? FullName { get; }
    bool IsAuthenticated { get; }
}
