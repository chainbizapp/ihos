using System.Diagnostics;
using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;

namespace Ihos.Application.Providers;

/// <summary>
/// IInsurerQuoteProvider implementation for companies with <c>DataSource = Import</c>
/// (Excel/CSV import path — e.g. Allianz today). Reads pre-imported <see cref="InsurancePlan"/>
/// rows from the local DB; never calls an external service, so it is exempt from the resilience
/// pipeline.
///
/// One instance is registered per Import-source company (keyed by <see cref="ShortCode"/>)
/// so the same uniform <see cref="IInsurerQuoteProvider"/> contract works across import + API.
/// </summary>
public sealed class ImportQuoteProvider : IInsurerQuoteProvider
{
    private readonly IInsurancePlanRepository _plans;
    private readonly InsuranceCompany _company;

    public ImportQuoteProvider(InsuranceCompany company, IInsurancePlanRepository plans)
    {
        _company = company;
        _plans = plans;
    }

    public string ShortCode => _company.ShortCode;

    public async Task<ProviderQuoteResult> GetQuoteAsync(
        ProviderQuoteRequest request,
        CancellationToken cancellationToken)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            var (items, _) = await _plans.SearchAsync(
                vehicleModelIds: new[] { request.VehicleModelId },
                registrationYear: request.RegistrationYear,
                planType: request.PlanType,
                repairType: request.RepairType,
                companyId: _company.Id,
                excessMin: null,
                excessMax: null,
                sort: "premium_asc",
                page: 1,
                pageSize: 50,
                province: null,
                ct: cancellationToken);

            sw.Stop();
            return ProviderQuoteResult.Success(
                _company.ShortCode, _company.Name, items, sw.ElapsedMilliseconds);
        }
        catch (OperationCanceledException)
        {
            sw.Stop();
            return ProviderQuoteResult.Failure(
                _company.ShortCode, _company.Name,
                ProviderQuoteStatus.Timeout, "Cancelled", sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            sw.Stop();
            return ProviderQuoteResult.Failure(
                _company.ShortCode, _company.Name,
                ProviderQuoteStatus.Failed, ex.Message, sw.ElapsedMilliseconds);
        }
    }
}
