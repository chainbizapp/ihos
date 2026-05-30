using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;
using Ihos.Domain.Enums;

namespace Ihos.Application.Sync.Queries;

/// <summary>
/// Returns the current sync state for every active InsuranceCompany — the latest
/// VehicleSyncLog row (if any) plus whether a Running row currently exists. Used to
/// render the Admin Sync UI page.
/// </summary>
public record GetSyncStatusQuery() : IRequest<IReadOnlyList<ProviderSyncStatusDto>>;

public record ProviderSyncStatusDto(
    Guid CompanyId,
    string CompanyShortCode,
    string CompanyDisplayName,
    string DataSource,           // "Import" | "Api"
    Guid? LatestSyncLogId,
    string? LatestStatus,        // null when no run yet
    string? LatestTrigger,
    DateTime? LatestStartedAtUtc,
    DateTime? LatestCompletedAtUtc,
    int LatestInsertedCount,
    int LatestUpdatedCount,
    int LatestDeactivatedCount,
    int LatestErrorCount,
    long? LatestDurationMs,
    string? LatestErrorMessage,
    bool IsRunning);

public class GetSyncStatusQueryHandler
    : IRequestHandler<GetSyncStatusQuery, IReadOnlyList<ProviderSyncStatusDto>>
{
    private readonly IInsuranceCompanyRepository _companies;
    private readonly IVehicleSyncLogReader _logs;

    public GetSyncStatusQueryHandler(
        IInsuranceCompanyRepository companies,
        IVehicleSyncLogReader logs)
    {
        _companies = companies;
        _logs = logs;
    }

    public async Task<IReadOnlyList<ProviderSyncStatusDto>> Handle(
        GetSyncStatusQuery request, CancellationToken ct)
    {
        var companies = await _companies.GetAllActiveAsync(ct);
        var latest = await _logs.GetLatestPerCompanyAsync(ct);

        return companies
            .OrderBy(c => c.ShortCode, StringComparer.Ordinal)
            .Select(c =>
            {
                latest.TryGetValue(c.Id, out var row);
                return new ProviderSyncStatusDto(
                    CompanyId: c.Id,
                    CompanyShortCode: c.ShortCode,
                    CompanyDisplayName: c.Name,
                    DataSource: c.DataSource.ToString(),
                    LatestSyncLogId: row?.Id,
                    LatestStatus: row?.Status.ToString(),
                    LatestTrigger: row?.Trigger.ToString(),
                    LatestStartedAtUtc: row?.StartedAtUtc,
                    LatestCompletedAtUtc: row?.CompletedAtUtc,
                    LatestInsertedCount: row?.InsertedCount ?? 0,
                    LatestUpdatedCount: row?.UpdatedCount ?? 0,
                    LatestDeactivatedCount: row?.DeactivatedCount ?? 0,
                    LatestErrorCount: row?.ErrorCount ?? 0,
                    LatestDurationMs: row?.DurationMs,
                    LatestErrorMessage: row?.ErrorMessage,
                    IsRunning: row?.Status == SyncStatus.Running);
            })
            .ToList();
    }
}
