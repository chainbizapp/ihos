using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;

namespace Ihos.Application.Quotation.Queries;

public record GetQuotationsQuery(
    int Page = 1,
    int PageSize = 20
) : IRequest<GetQuotationsResult>;

public record QuotationSummaryDto(
    Guid Id,
    string CustomerName,
    string? VehicleRegistration,
    string VehicleMake,
    string VehicleModelName,
    int VehicleYear,
    string CompanyName,
    string PlanType,
    decimal PremiumAtGeneration,
    DateTime GeneratedAt,
    Guid CreatedBy
);

public record GetQuotationsResult(
    IReadOnlyList<QuotationSummaryDto> Items,
    int TotalCount,
    int Page,
    int PageSize
);

public class GetQuotationsQueryHandler : IRequestHandler<GetQuotationsQuery, GetQuotationsResult>
{
    private readonly IQuotationRepository _quotations;
    private readonly ICurrentUserService _currentUser;

    public GetQuotationsQueryHandler(IQuotationRepository quotations, ICurrentUserService currentUser)
    {
        _quotations = quotations;
        _currentUser = currentUser;
    }

    public async Task<GetQuotationsResult> Handle(GetQuotationsQuery request, CancellationToken ct)
    {
        var pageSize = Math.Min(request.PageSize, 50);

        var (items, total) = await _quotations.GetPagedAsync(
            _currentUser.UserId,
            request.Page,
            pageSize,
            ct);

        var dtos = items.Select(q => new QuotationSummaryDto(
            q.Id,
            q.CustomerName,
            q.VehicleRegistration,
            q.VehicleMake,
            q.VehicleModelName,
            q.VehicleYear,
            q.Plan?.Company?.Name ?? string.Empty,
            q.Plan?.PlanType.ToString() ?? string.Empty,
            q.PremiumAtGeneration,
            q.GeneratedAt,
            q.CreatedBy ?? Guid.Empty
        )).ToList();

        return new GetQuotationsResult(dtos, total, request.Page, pageSize);
    }
}
