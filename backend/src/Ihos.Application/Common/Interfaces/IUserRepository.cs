using Ihos.Domain.Entities;
using Ihos.Domain.Enums;

namespace Ihos.Application.Common.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<User?> GetByEmailAsync(string email, CancellationToken ct = default);
    Task<User?> GetByInviteTokenHashAsync(string tokenHash, CancellationToken ct = default);
    Task<(IReadOnlyList<User> Items, int TotalCount)> GetPagedAsync(
        int page, int pageSize,
        UserStatus? status = null,
        UserRole? role = null,
        CancellationToken ct = default);
    Task<IReadOnlyList<User>> GetPendingApprovalsAsync(CancellationToken ct = default);
    Task AddAsync(User user, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
