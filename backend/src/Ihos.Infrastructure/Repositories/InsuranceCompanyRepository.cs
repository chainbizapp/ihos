using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Ihos.Infrastructure.Repositories;

public class InsuranceCompanyRepository : IInsuranceCompanyRepository
{
    private readonly ApplicationDbContext _db;

    public InsuranceCompanyRepository(ApplicationDbContext db) => _db = db;

    public Task<InsuranceCompany?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.InsuranceCompanies.FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted, ct);

    public async Task<IReadOnlyList<InsuranceCompany>> GetAllActiveAsync(CancellationToken ct = default) =>
        await _db.InsuranceCompanies
            .Where(c => c.IsActive && !c.IsDeleted)
            .OrderBy(c => c.Name)
            .ToListAsync(ct);

    public async Task AddAsync(InsuranceCompany company, CancellationToken ct = default) =>
        await _db.InsuranceCompanies.AddAsync(company, ct);

    public Task SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);
}
