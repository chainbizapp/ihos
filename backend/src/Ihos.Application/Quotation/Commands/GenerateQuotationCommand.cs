using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;

namespace Ihos.Application.Quotation.Commands;

public record GenerateQuotationCommand(
    Guid PlanId,
    string CustomerName,
    string? VehicleRegistration,
    int VehicleYear
) : IRequest<GenerateQuotationResult>;

public record GenerateQuotationResult(
    Guid QuotationId,
    byte[] PdfBytes
);

public class GenerateQuotationCommandHandler : IRequestHandler<GenerateQuotationCommand, GenerateQuotationResult>
{
    private readonly IInsurancePlanRepository _plans;
    private readonly IQuotationRepository _quotations;
    private readonly IJasperReportsClient _jasper;
    private readonly ICurrentUserService _currentUser;

    public GenerateQuotationCommandHandler(
        IInsurancePlanRepository plans,
        IQuotationRepository quotations,
        IJasperReportsClient jasper,
        ICurrentUserService currentUser)
    {
        _plans = plans;
        _quotations = quotations;
        _jasper = jasper;
        _currentUser = currentUser;
    }

    public async Task<GenerateQuotationResult> Handle(GenerateQuotationCommand request, CancellationToken ct)
    {
        var plan = await _plans.GetByIdAsync(request.PlanId, ct)
            ?? throw new KeyNotFoundException($"Plan {request.PlanId} not found or not published.");

        if (!plan.IsPublished)
            throw new InvalidOperationException("Cannot generate a quotation for an unpublished plan.");

        var generatedAt = DateTime.UtcNow;
        var validUntil = generatedAt.AddDays(30);

        var quotation = new Domain.Entities.Quotation
        {
            PlanId = plan.Id,
            CustomerName = request.CustomerName,
            VehicleRegistration = request.VehicleRegistration,
            VehicleMake = plan.VehicleModel?.Make?.Name ?? string.Empty,
            VehicleModelName = plan.VehicleModel?.Name ?? string.Empty,
            VehicleYear = request.VehicleYear,
            PremiumAtGeneration = plan.PremiumTotal,
            GeneratedAt = generatedAt,
            CreatedBy = _currentUser.UserId
        };

        await _quotations.AddAsync(quotation, ct);
        await _quotations.SaveChangesAsync(ct);

        // The JasperReports template connects directly to the DB.
        // param1 = quotation UUID; the report runs its own SQL query.
        var parameters = new Dictionary<string, string>
        {
            ["srcFile"] = "quotation",
            ["param1"] = quotation.Id.ToString()
        };

        var pdfBytes = await _jasper.GenerateQuotationPdfAsync(parameters, ct);

        return new GenerateQuotationResult(quotation.Id, pdfBytes);
    }
}
