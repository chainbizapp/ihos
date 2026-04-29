using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Ihos.Infrastructure.Repositories;

public class CustomerRepository : ICustomerRepository
{
    private readonly ApplicationDbContext _db;

    public CustomerRepository(ApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<Customer>> SearchByNameAsync(
        string q, Guid userId, int limit = 10, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(q)) return [];

        var pattern = q.Trim().ToLower();

        return await _db.Customers
            .Where(c => !c.IsDeleted
                     && c.CreatedBy == userId
                     && c.FullName.ToLower().Contains(pattern))
            .OrderBy(c => c.FullName)
            .Take(limit)
            .ToListAsync(ct);
    }

    public async Task UpsertAsync(Domain.Entities.Customer incoming, CancellationToken ct = default)
    {
        var existing = await _db.Customers.FirstOrDefaultAsync(c =>
            c.FullName             == incoming.FullName &&
            c.Phone                == incoming.Phone    &&
            c.VehicleRegistration  == incoming.VehicleRegistration &&
            c.CreatedBy            == incoming.CreatedBy &&
            !c.IsDeleted, ct);

        if (existing is null)
        {
            await _db.Customers.AddAsync(incoming, ct);
        }
        else
        {
            // Update mutable fields to the latest values
            existing.Email              = incoming.Email;
            existing.LicenseNumber      = incoming.LicenseNumber;
            existing.VehicleYear        = incoming.VehicleYear;
            existing.PreviousInsurer    = incoming.PreviousInsurer;
            existing.PreviousExpiryDate = incoming.PreviousExpiryDate;
        }
    }

    public Task SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
