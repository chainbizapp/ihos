using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;
using Ihos.Application.Providers;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Ihos.Application.Sync.Commands;

/// <summary>
/// Triggers a manual vehicle-master sync for a single API-source provider.
/// The handler kicks off the sync in a background scope so the HTTP caller doesn't wait for
/// the (potentially multi-minute) sync to finish — it returns the new VehicleSyncLog id
/// immediately so the UI can poll status via <c>GetSyncStatusQuery</c>.
/// </summary>
public record TriggerVehicleSyncCommand(
    Guid CompanyId,
    Guid? ActorUserId
) : IRequest<TriggerVehicleSyncResult>;

public record TriggerVehicleSyncResult(Guid SyncLogId, string CompanyShortCode);

public class TriggerVehicleSyncCommandHandler
    : IRequestHandler<TriggerVehicleSyncCommand, TriggerVehicleSyncResult>
{
    private readonly IInsuranceCompanyRepository _companies;
    private readonly ISyncOrchestrator _orchestrator;

    public TriggerVehicleSyncCommandHandler(
        IInsuranceCompanyRepository companies,
        ISyncOrchestrator orchestrator)
    {
        _companies = companies;
        _orchestrator = orchestrator;
    }

    public async Task<TriggerVehicleSyncResult> Handle(
        TriggerVehicleSyncCommand request, CancellationToken ct)
    {
        var company = (await _companies.GetAllActiveAsync(ct))
            .FirstOrDefault(c => c.Id == request.CompanyId);
        if (company is null)
            throw new InvalidOperationException("Company not found.");

        if (company.DataSource != DataSourceType.Api)
            throw new InvalidOperationException(
                "Sync is only supported for API-source providers. " +
                $"Company '{company.ShortCode}' has DataSource={company.DataSource}.");

        var syncLogId = await _orchestrator.StartAsync(
            company.ShortCode, SyncTriggerType.Manual, request.ActorUserId, ct);

        return new TriggerVehicleSyncResult(syncLogId, company.ShortCode);
    }
}
