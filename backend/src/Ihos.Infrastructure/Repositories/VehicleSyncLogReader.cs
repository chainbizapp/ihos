using Ihos.Application.Common.Interfaces;
using Ihos.Application.Sync.Queries;
using Ihos.Domain.Entities;
using Ihos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Ihos.Infrastructure.Repositories;

public sealed class VehicleSyncLogReader : IVehicleSyncLogReader
{
    private readonly ApplicationDbContext _db;
    public VehicleSyncLogReader(ApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyDictionary<Guid, VehicleSyncLog>> GetLatestPerCompanyAsync(
        CancellationToken ct)
    {
        // Group by CompanyId, take the row with the largest StartedAtUtc per group. Using a
        // window function (ROW_NUMBER) under the hood via Linq-Subquery for portability.
        var latestIds = await _db.VehicleSyncLogs
            .Where(l => !l.IsDeleted)
            .GroupBy(l => l.CompanyId)
            .Select(g => g.OrderByDescending(x => x.StartedAtUtc).Select(x => x.Id).First())
            .ToListAsync(ct);

        var rows = await _db.VehicleSyncLogs
            .Where(l => latestIds.Contains(l.Id))
            .AsNoTracking()
            .ToListAsync(ct);

        return rows.ToDictionary(r => r.CompanyId);
    }

    public async Task<GetSyncHistoryResult> GetHistoryAsync(int page, int pageSize,
        CancellationToken ct)
    {
        var baseQuery = _db.VehicleSyncLogs
            .Where(l => !l.IsDeleted)
            .OrderByDescending(l => l.StartedAtUtc);

        var total = await baseQuery.CountAsync(ct);

        var rows = await baseQuery
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new
            {
                l.Id,
                l.CompanyId,
                CompanyShortCode = l.Company.ShortCode,
                CompanyDisplayName = l.Company.Name,
                l.Status,
                l.Trigger,
                l.TriggeredByUserId,
                TriggeredByEmail = l.TriggeredByUserId == null
                    ? null
                    : _db.Users.Where(u => u.Id == l.TriggeredByUserId).Select(u => u.Email).FirstOrDefault(),
                l.StartedAtUtc,
                l.CompletedAtUtc,
                l.InsertedCount,
                l.UpdatedCount,
                l.DeactivatedCount,
                l.ErrorCount,
                l.DurationMs,
                l.ErrorMessage,
            })
            .ToListAsync(ct);

        var dtos = rows.Select(r => new SyncHistoryRowDto(
            r.Id, r.CompanyShortCode, r.CompanyDisplayName,
            r.Status.ToString(), r.Trigger.ToString(),
            r.TriggeredByUserId, r.TriggeredByEmail,
            r.StartedAtUtc, r.CompletedAtUtc,
            r.InsertedCount, r.UpdatedCount, r.DeactivatedCount, r.ErrorCount,
            r.DurationMs, r.ErrorMessage)).ToList();

        return new GetSyncHistoryResult(dtos, total, page, pageSize);
    }
}
