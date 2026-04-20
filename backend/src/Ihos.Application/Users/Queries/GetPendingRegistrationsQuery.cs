using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;

namespace Ihos.Application.Users.Queries;

public record GetPendingRegistrationsQuery : IRequest<IReadOnlyList<UserListItem>>;

public class GetPendingRegistrationsQueryHandler : IRequestHandler<GetPendingRegistrationsQuery, IReadOnlyList<UserListItem>>
{
    private readonly IUserRepository _users;

    public GetPendingRegistrationsQueryHandler(IUserRepository users) => _users = users;

    public async Task<IReadOnlyList<UserListItem>> Handle(GetPendingRegistrationsQuery request, CancellationToken ct)
    {
        var users = await _users.GetPendingApprovalsAsync(ct);
        return users.Select(u => new UserListItem(
            u.Id, u.Email, u.FullName, u.Role.ToString(), u.Status.ToString(), u.CreatedAt
        )).ToList();
    }
}
