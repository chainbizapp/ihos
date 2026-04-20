using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;

namespace Ihos.Application.Users.Queries;

public record GetUsersQuery(
    int Page = 1,
    int PageSize = 20,
    UserStatus? Status = null,
    UserRole? Role = null) : IRequest<GetUsersResult>;

public record GetUsersResult(IReadOnlyList<UserListItem> Items, int TotalCount, int Page, int PageSize);

public record UserListItem(Guid Id, string Email, string FullName, string Role, string Status, DateTime CreatedAt);

public class GetUsersQueryHandler : IRequestHandler<GetUsersQuery, GetUsersResult>
{
    private readonly IUserRepository _users;

    public GetUsersQueryHandler(IUserRepository users) => _users = users;

    public async Task<GetUsersResult> Handle(GetUsersQuery request, CancellationToken ct)
    {
        var (items, total) = await _users.GetPagedAsync(
            request.Page, request.PageSize,
            request.Status, request.Role, ct);

        var dtos = items.Select(u => new UserListItem(
            u.Id, u.Email, u.FullName, u.Role.ToString(), u.Status.ToString(), u.CreatedAt
        )).ToList();

        return new GetUsersResult(dtos, total, request.Page, request.PageSize);
    }
}
