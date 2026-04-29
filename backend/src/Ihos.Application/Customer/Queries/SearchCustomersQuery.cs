using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;

namespace Ihos.Application.Customer.Queries;

public record CustomerSuggestionDto(
    Guid Id,
    string FullName,
    string Phone,
    string? Email,
    string? LicenseNumber,
    string? VehicleRegistration,
    int? VehicleYear,
    string? PreviousInsurer,
    string? PreviousExpiryDate);

public record SearchCustomersQuery(string Q) : IRequest<IReadOnlyList<CustomerSuggestionDto>>;

public class SearchCustomersQueryHandler : IRequestHandler<SearchCustomersQuery, IReadOnlyList<CustomerSuggestionDto>>
{
    private readonly ICustomerRepository _customers;
    private readonly ICurrentUserService _currentUser;

    public SearchCustomersQueryHandler(ICustomerRepository customers, ICurrentUserService currentUser)
    {
        _customers = customers;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<CustomerSuggestionDto>> Handle(SearchCustomersQuery request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Q) || _currentUser.UserId == null || _currentUser.UserId == Guid.Empty)
            return [];

        var list = await _customers.SearchByNameAsync(request.Q, _currentUser.UserId!.Value, 20, ct);

        return list.Select(c => new CustomerSuggestionDto(
            c.Id,
            c.FullName,
            c.Phone,
            c.Email,
            c.LicenseNumber,
            c.VehicleRegistration,
            c.VehicleYear,
            c.PreviousInsurer,
            c.PreviousExpiryDate?.ToString("yyyy-MM-dd")
        )).ToList();
    }
}
