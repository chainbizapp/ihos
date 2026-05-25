using System.Diagnostics;
using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;
using Ihos.Application.Providers;
using Ihos.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Ihos.Application.Search.Queries;

/// <summary>
/// Aggregated multi-provider search: fans out to every active provider in parallel,
/// applies per-provider 3 s timeout (via Polly resilience pipeline), and never throws —
/// partial failure is a first-class result type per provider. Feature 002.
/// </summary>
public record SearchPlansAggregatedQuery(
    Guid VehicleModelId,
    int RegistrationYear,
    PlanType PlanType,
    RepairType RepairType,
    decimal SumInsured = 0,
    decimal Deductible = 0,
    string? DriverAgeBand = null,
    string? UsageType = null,
    string? RegionGroup = null
) : IRequest<SearchPlansAggregatedResult>;

public record SearchPlansAggregatedResult(
    string RequestId,
    long ElapsedMs,
    IReadOnlyList<ProviderSearchResultDto> Results);

public record ProviderSearchResultDto(
    string CompanyShortCode,
    string CompanyDisplayName,
    string Status,
    bool IsStale,
    long ProviderLatencyMs,
    IReadOnlyList<InsurancePlanSummaryDto> Plans,
    string? ErrorCode,
    string? ErrorMessage);

public class SearchPlansAggregatedQueryHandler
    : IRequestHandler<SearchPlansAggregatedQuery, SearchPlansAggregatedResult>
{
    private readonly IInsuranceCompanyRepository _companies;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SearchPlansAggregatedQueryHandler> _logger;

    public SearchPlansAggregatedQueryHandler(
        IInsuranceCompanyRepository companies,
        IServiceScopeFactory scopeFactory,
        ILogger<SearchPlansAggregatedQueryHandler> logger)
    {
        _companies = companies;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task<SearchPlansAggregatedResult> Handle(
        SearchPlansAggregatedQuery request, CancellationToken ct)
    {
        var requestId = Guid.NewGuid().ToString("N");
        var sw = Stopwatch.StartNew();

        // Resolve company list ONCE in the outer scope (cheap DB read).
        var companies = await _companies.GetAllActiveAsync(ct);

        var providerRequest = new ProviderQuoteRequest(
            VehicleModelId: request.VehicleModelId,
            RegistrationYear: request.RegistrationYear,
            PlanType: request.PlanType,
            RepairType: request.RepairType,
            SumInsured: request.SumInsured,
            Deductible: request.Deductible,
            DriverAgeBand: request.DriverAgeBand,
            UsageType: request.UsageType,
            RegionGroup: request.RegionGroup,
            RequestId: requestId);

        // Fan out in parallel. Each provider runs in its OWN DI scope so it gets a fresh
        // DbContext — required because EF Core's DbContext is not thread-safe and the
        // parent scope's instance would collide across concurrent calls.
        var tasks = companies
            .Select(c => InvokeProviderInScopeAsync(c.ShortCode, providerRequest, ct))
            .ToArray();
        var results = await Task.WhenAll(tasks);

        sw.Stop();

        var dtos = results.Select(MapToDto).ToList();

        _logger.LogInformation(
            "Aggregated search {RequestId} completed in {Elapsed}ms — {ProviderCount} providers, " +
            "{SuccessCount} success",
            requestId, sw.ElapsedMilliseconds, dtos.Count,
            dtos.Count(d => d.Status == nameof(ProviderQuoteStatus.Success)));

        return new SearchPlansAggregatedResult(requestId, sw.ElapsedMilliseconds, dtos);
    }

    /// <summary>
    /// Creates a fresh DI scope, resolves the right provider for the given short-code
    /// (API-source or Import fallback), and invokes it. Each scope gets its own DbContext,
    /// repositories, and provider instance — safe for parallel execution.
    /// </summary>
    private async Task<ProviderQuoteResult> InvokeProviderInScopeAsync(
        string shortCode,
        ProviderQuoteRequest request,
        CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        try
        {
            var registry = scope.ServiceProvider.GetRequiredService<IProviderRegistry>();
            var providers = await registry.GetActiveQuoteProvidersAsync(ct);
            var match = providers.FirstOrDefault(p =>
                string.Equals(p.Company.ShortCode, shortCode, StringComparison.OrdinalIgnoreCase));

            if (match is null)
            {
                return ProviderQuoteResult.Failure(
                    shortCode, shortCode, ProviderQuoteStatus.Failed,
                    "No provider registered for this short-code", 0);
            }

            return await match.Provider.GetQuoteAsync(request, ct);
        }
        catch (Exception ex)
        {
            // Adapters should never throw, but guard at the scope boundary anyway.
            _logger.LogWarning(ex, "Provider {ShortCode} threw unexpectedly", shortCode);
            return ProviderQuoteResult.Failure(
                shortCode, shortCode, ProviderQuoteStatus.Failed, ex.Message, 0);
        }
    }

    private static ProviderSearchResultDto MapToDto(ProviderQuoteResult r)
    {
        var planDtos = r.Plans.Select(p => new InsurancePlanSummaryDto(
            p.Id,
            p.Company?.Name ?? r.CompanyDisplayName,
            p.Company?.ShortCode ?? r.CompanyShortCode,
            p.PlanType.ToString(),
            p.RepairType.ToString(),
            p.VehicleModel?.Name ?? string.Empty,
            p.VehicleModel?.Make?.Name ?? string.Empty,
            p.VehicleModel?.SubModel,
            p.VehicleModel?.EngineCC,
            p.VehicleModel?.GearType,
            p.RegistrationYear,
            p.SumInsured,
            p.PremiumTotal,
            p.ExcessAmount,
            p.CoverageDetails,
            p.Remarks,
            RegionGroup: string.IsNullOrEmpty(p.RegionGroup) ? null : p.RegionGroup,
            TpbiPerPerson: p.TpbiPerPerson,
            TpbiPerAccident: p.TpbiPerAccident,
            Tppd: p.Tppd,
            FireTheft: p.FireTheft,
            PersonalAccident: p.PersonalAccident,
            PassengerAccident: p.PassengerAccident,
            MedicalExpenses: p.MedicalExpenses,
            BailBond: p.BailBond
        )).ToList();

        return new ProviderSearchResultDto(
            CompanyShortCode: r.CompanyShortCode,
            CompanyDisplayName: r.CompanyDisplayName,
            Status: r.Status.ToString(),
            IsStale: r.IsStale,
            ProviderLatencyMs: r.ProviderLatencyMs,
            Plans: planDtos,
            ErrorCode: r.ErrorCode,
            ErrorMessage: r.ErrorMessage);
    }
}
