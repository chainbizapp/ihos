using Ihos.Domain.Entities;

namespace Ihos.Application.Common.Interfaces;

public interface ICustomerRepository
{
    /// <summary>Returns up to <paramref name="limit"/> customers whose name contains <paramref name="q"/>, belonging to the given user.</summary>
    Task<IReadOnlyList<Domain.Entities.Customer>> SearchByNameAsync(string q, Guid userId, int limit = 10, CancellationToken ct = default);

    /// <summary>Inserts or updates the customer matched by (FullName, Phone, CreatedBy), refreshing mutable fields.</summary>
    Task UpsertAsync(Domain.Entities.Customer customer, CancellationToken ct = default);

    Task SaveChangesAsync(CancellationToken ct = default);
}
