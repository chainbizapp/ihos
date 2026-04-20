using QuotationEntity = Ihos.Domain.Entities.Quotation;

namespace Ihos.Application.Common.Interfaces;

public interface IQuotationRepository
{
    Task<QuotationEntity?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<(IReadOnlyList<QuotationEntity> Items, int TotalCount)> GetPagedAsync(
        Guid? createdBy,
        int page,
        int pageSize,
        CancellationToken ct = default);
    Task AddAsync(QuotationEntity quotation, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
