using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;

namespace Ihos.Application.Quotation.Commands;

public record GenerateQuotationCommand(
    IReadOnlyList<Guid> PlanIds,   // 1–3 plans; first is primary
    string CustomerName,
    string? VehicleRegistration,
    int VehicleYear,
    // Driver info (optional extras for customer record)
    string? Phone = null,
    string? Email = null,
    string? LicenseNumber = null,
    string? PreviousInsurer = null,
    string? PreviousExpiryDate = null   // ISO date string yyyy-MM-dd
) : IRequest<GenerateQuotationResult>;

public record GenerateQuotationResult(
    Guid QuotationId,
    byte[] PdfBytes
);

public class GenerateQuotationCommandHandler : IRequestHandler<GenerateQuotationCommand, GenerateQuotationResult>
{
    private readonly IInsurancePlanRepository _plans;
    private readonly IQuotationRepository _quotations;
    private readonly ICustomerRepository _customers;
    private readonly IJasperReportsClient _jasper;
    private readonly ICurrentUserService _currentUser;

    public GenerateQuotationCommandHandler(
        IInsurancePlanRepository plans,
        IQuotationRepository quotations,
        ICustomerRepository customers,
        IJasperReportsClient jasper,
        ICurrentUserService currentUser)
    {
        _plans = plans;
        _quotations = quotations;
        _customers = customers;
        _jasper = jasper;
        _currentUser = currentUser;
    }

    public async Task<GenerateQuotationResult> Handle(GenerateQuotationCommand request, CancellationToken ct)
    {
        // Load all requested plans (up to 3)
        var plan1 = await _plans.GetByIdAsync(request.PlanIds[0], ct)
            ?? throw new KeyNotFoundException($"Plan {request.PlanIds[0]} not found or not published.");

        if (!plan1.IsPublished)
            throw new InvalidOperationException("Cannot generate a quotation for an unpublished plan.");

        Domain.Entities.InsurancePlan? plan2 = null;
        Domain.Entities.InsurancePlan? plan3 = null;

        if (request.PlanIds.Count >= 2)
        {
            plan2 = await _plans.GetByIdAsync(request.PlanIds[1], ct)
                ?? throw new KeyNotFoundException($"Plan {request.PlanIds[1]} not found.");
            if (!plan2.IsPublished)
                throw new InvalidOperationException($"Plan {request.PlanIds[1]} is not published.");
        }

        if (request.PlanIds.Count >= 3)
        {
            plan3 = await _plans.GetByIdAsync(request.PlanIds[2], ct)
                ?? throw new KeyNotFoundException($"Plan {request.PlanIds[2]} not found.");
            if (!plan3.IsPublished)
                throw new InvalidOperationException($"Plan {request.PlanIds[2]} is not published.");
        }

        var generatedAt = DateTime.UtcNow;

        var quotation = new Domain.Entities.Quotation
        {
            PlanId  = plan1.Id,
            PlanId2 = plan2?.Id,
            PlanId3 = plan3?.Id,
            CustomerName        = request.CustomerName,
            VehicleRegistration = request.VehicleRegistration,
            VehicleMake         = plan1.VehicleModel?.Make?.Name ?? string.Empty,
            VehicleModelName    = plan1.VehicleModel?.Name ?? string.Empty,
            VehicleYear         = request.VehicleYear,
            PremiumAtGeneration  = plan1.PremiumTotal,
            PremiumAtGeneration2 = plan2?.PremiumTotal,
            PremiumAtGeneration3 = plan3?.PremiumTotal,
            GeneratedAt = generatedAt,
            CreatedBy   = _currentUser.UserId
        };

        await _quotations.AddAsync(quotation, ct);
        await _quotations.SaveChangesAsync(ct);

        // Upsert customer record for auto-suggest on future quotations
        if (!string.IsNullOrWhiteSpace(request.Phone))
        {
            DateOnly? expiryDate = null;
            if (DateOnly.TryParse(request.PreviousExpiryDate, out var d)) expiryDate = d;

            var customer = new Domain.Entities.Customer
            {
                FullName              = request.CustomerName,
                Phone                 = request.Phone,
                Email                 = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email,
                LicenseNumber         = string.IsNullOrWhiteSpace(request.LicenseNumber) ? null : request.LicenseNumber,
                VehicleRegistration   = string.IsNullOrWhiteSpace(request.VehicleRegistration) ? null : request.VehicleRegistration,
                VehicleYear           = request.VehicleYear > 0 ? request.VehicleYear : null,
                PreviousInsurer       = string.IsNullOrWhiteSpace(request.PreviousInsurer) ? null : request.PreviousInsurer,
                PreviousExpiryDate    = expiryDate,
                CreatedBy             = _currentUser.UserId
            };

            await _customers.UpsertAsync(customer, ct);
            await _customers.SaveChangesAsync(ct);
        }

        // The JasperReports template connects directly to the DB.
        // param1 = quotation UUID; the report runs its own SQL query.
        var parameters = new Dictionary<string, string>
        {
            ["srcFile"] = "quotation",
            ["param1"]  = quotation.Id.ToString()
        };

        var pdfBytes = await _jasper.GenerateQuotationPdfAsync(parameters, ct);

        return new GenerateQuotationResult(quotation.Id, pdfBytes);
    }
}
