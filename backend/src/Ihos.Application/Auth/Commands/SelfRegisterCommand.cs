using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;

namespace Ihos.Application.Auth.Commands;

public record SelfRegisterCommand(string Email, string FullName, string Password) : IRequest<SelfRegisterResult>;

public record SelfRegisterResult(Guid Id, string Status);

public class SelfRegisterCommandHandler : IRequestHandler<SelfRegisterCommand, SelfRegisterResult>
{
    private readonly IUserRepository _users;
    private readonly IPasswordHasher _hasher;

    public SelfRegisterCommandHandler(IUserRepository users, IPasswordHasher hasher)
    {
        _users = users;
        _hasher = hasher;
    }

    public async Task<SelfRegisterResult> Handle(SelfRegisterCommand request, CancellationToken ct)
    {
        var existing = await _users.GetByEmailAsync(request.Email, ct);
        if (existing != null)
            throw new InvalidOperationException("Email is already registered.");

        var user = new User
        {
            Email = request.Email.ToLower(),
            FullName = request.FullName,
            PasswordHash = _hasher.Hash(request.Password),
            Role = UserRole.Staff,
            Status = UserStatus.PendingApproval
        };

        await _users.AddAsync(user, ct);
        await _users.SaveChangesAsync(ct);

        return new SelfRegisterResult(user.Id, user.Status.ToString());
    }
}
