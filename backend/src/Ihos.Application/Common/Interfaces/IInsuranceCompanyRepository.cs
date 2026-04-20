using Ihos.Domain.Entities;

namespace Ihos.Application.Common.Interfaces;

public interface IInsuranceCompanyRepository
{
    Task<InsuranceCompany?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<InsuranceCompany>> GetAllActiveAsync(CancellationToken ct = default);
    Task AddAsync(InsuranceCompany company, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
