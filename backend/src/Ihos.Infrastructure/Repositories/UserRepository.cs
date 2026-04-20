using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Ihos.Infrastructure.Repositories;

public class UserRepository : IUserRepository
{
    private readonly ApplicationDbContext _db;

    public UserRepository(ApplicationDbContext db) => _db = db;

    public Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.Users.FirstOrDefaultAsync(u => u.Id == id && !u.IsDeleted, ct);

    public Task<User?> GetByEmailAsync(string email, CancellationToken ct = default) =>
        _db.Users.FirstOrDefaultAsync(u => u.Email == email.ToLower() && !u.IsDeleted, ct);

    public Task<User?> GetByInviteTokenHashAsync(string tokenHash, CancellationToken ct = default) =>
        _db.Users.FirstOrDefaultAsync(u => u.InviteTokenHash == tokenHash && !u.IsDeleted, ct);

    public async Task<(IReadOnlyList<User> Items, int TotalCount)> GetPagedAsync(
        int page, int pageSize,
        UserStatus? status = null,
        UserRole? role = null,
        CancellationToken ct = default)
    {
        var query = _db.Users.Where(u => !u.IsDeleted);
        if (status.HasValue) query = query.Where(u => u.Status == status.Value);
        if (role.HasValue) query = query.Where(u => u.Role == role.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(u => u.FullName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public Task<IReadOnlyList<User>> GetPendingApprovalsAsync(CancellationToken ct = default) =>
        _db.Users
            .Where(u => u.Status == UserStatus.PendingApproval && !u.IsDeleted)
            .OrderBy(u => u.CreatedAt)
            .ToListAsync(ct)
            .ContinueWith<IReadOnlyList<User>>(t => t.Result, ct);

    public async Task AddAsync(User user, CancellationToken ct = default) =>
        await _db.Users.AddAsync(user, ct);

    public Task SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
