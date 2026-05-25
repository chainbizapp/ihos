using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace Ihos.Application.Providers;

/// <summary>
/// Default <see cref="IProviderRegistry"/> implementation.
///
/// Resolution rules:
/// <list type="bullet">
///   <item><c>DataSource = Api</c> → match a DI-registered <see cref="IInsurerQuoteProvider"/>
///         by <c>ShortCode</c>. Warn + skip when no adapter is registered.</item>
///   <item><c>DataSource = Import</c> → construct an <see cref="ImportQuoteProvider"/> on the fly
///         bound to that specific company (no per-company DI registration needed).</item>
/// </list>
///
/// This keeps Search and Sync ignorant of provider concretions — adding a new API provider
/// means one new adapter class + DI registration. Adding a new Import provider means one new
/// InsuranceCompany row (Constitution Principle IX — Scalability).
/// </summary>
public sealed class ProviderRegistry : IProviderRegistry
{
    private readonly IInsuranceCompanyRepository _companies;
    private readonly IInsurancePlanRepository _plans;
    private readonly IEnumerable<IInsurerQuoteProvider> _quoteProviders;
    private readonly IEnumerable<IVehicleMasterSyncer> _masterSyncers;
    private readonly ILogger<ProviderRegistry> _logger;

    public ProviderRegistry(
        IInsuranceCompanyRepository companies,
        IInsurancePlanRepository plans,
        IEnumerable<IInsurerQuoteProvider> quoteProviders,
        IEnumerable<IVehicleMasterSyncer> masterSyncers,
        ILogger<ProviderRegistry> logger)
    {
        _companies = companies;
        _plans = plans;
        _quoteProviders = quoteProviders;
        _masterSyncers = masterSyncers;
        _logger = logger;
    }

    public async Task<IReadOnlyList<ActiveQuoteProvider>> GetActiveQuoteProvidersAsync(
        CancellationToken cancellationToken)
    {
        var companies = await _companies.GetAllActiveAsync(cancellationToken);
        var byCode = _quoteProviders
            .GroupBy(p => p.ShortCode, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var results = new List<ActiveQuoteProvider>(companies.Count);
        foreach (var company in companies)
        {
            if (byCode.TryGetValue(company.ShortCode, out var provider))
            {
                results.Add(new ActiveQuoteProvider(company, provider));
            }
            else if (company.DataSource == DataSourceType.Import)
            {
                // Implicit Import fallback — read pre-loaded plans from DB.
                results.Add(new ActiveQuoteProvider(
                    company, new ImportQuoteProvider(company, _plans)));
            }
            else
            {
                _logger.LogWarning(
                    "API-sourced InsuranceCompany {ShortCode} has no IInsurerQuoteProvider " +
                    "registered — skipping",
                    company.ShortCode);
            }
        }
        return results;
    }

    public async Task<ActiveMasterSyncer?> GetMasterSyncerAsync(
        Guid companyId, CancellationToken cancellationToken)
    {
        var company = await _companies.GetByIdAsync(companyId, cancellationToken);
        if (company is null || !company.IsActive || company.DataSource != DataSourceType.Api)
            return null;

        var syncer = _masterSyncers.FirstOrDefault(s =>
            string.Equals(s.ShortCode, company.ShortCode, StringComparison.OrdinalIgnoreCase));

        if (syncer is null)
        {
            _logger.LogWarning(
                "Company {ShortCode} is API-sourced but has no IVehicleMasterSyncer registered",
                company.ShortCode);
            return null;
        }

        return new ActiveMasterSyncer(company, syncer);
    }

    public async Task<IReadOnlyList<ActiveMasterSyncer>> GetActiveMasterSyncersAsync(
        CancellationToken cancellationToken)
    {
        var companies = await _companies.GetAllActiveAsync(cancellationToken);
        var byCode = _masterSyncers
            .GroupBy(s => s.ShortCode, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var results = new List<ActiveMasterSyncer>();
        foreach (var company in companies.Where(c => c.DataSource == DataSourceType.Api))
        {
            if (byCode.TryGetValue(company.ShortCode, out var syncer))
            {
                results.Add(new ActiveMasterSyncer(company, syncer));
            }
            else
            {
                _logger.LogWarning(
                    "API-sourced company {ShortCode} has no IVehicleMasterSyncer registered",
                    company.ShortCode);
            }
        }
        return results;
    }
}
