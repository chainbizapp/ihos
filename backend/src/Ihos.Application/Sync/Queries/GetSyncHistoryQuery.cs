using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;
using Ihos.Domain.Enums;

namespace Ihos.Application.Sync.Queries;

/// <summary>
/// Paginated history of vehicle-master sync runs across all companies. Most recent first.
/// </summary>
public record GetSyncHistoryQuery(int Page = 1, int PageSize = 20)
    : IRequest<GetSyncHistoryResult>;

public record GetSyncHistoryResult(
    IReadOnlyList<SyncHistoryRowDto> Items,
    int TotalCount,
    int Page,
    int PageSize);

public record SyncHistoryRowDto(
    Guid Id,
    string CompanyShortCode,
    string CompanyDisplayName,
    string Status,
    string Trigger,
    Guid? TriggeredByUserId,
    string? TriggeredByEmail,
    DateTime StartedAtUtc,
    DateTime? CompletedAtUtc,
    int InsertedCount,
    int UpdatedCount,
    int DeactivatedCount,
    int ErrorCount,
    long? DurationMs,
    string? ErrorMessage);

public class GetSyncHistoryQueryHandler
    : IRequestHandler<GetSyncHistoryQuery, GetSyncHistoryResult>
{
    private readonly IVehicleSyncLogReader _logs;

    public GetSyncHistoryQueryHandler(IVehicleSyncLogReader logs) => _logs = logs;

    public Task<GetSyncHistoryResult> Handle(GetSyncHistoryQuery request, CancellationToken ct)
    {
        var page = Math.Max(1, request.Page);
        var size = Math.Clamp(request.PageSize, 1, 100);
        return _logs.GetHistoryAsync(page, size, ct);
    }
}
