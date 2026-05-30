using Ihos.Domain.Enums;
using Ihos.Infrastructure.Persistence;
using Ihos.Infrastructure.Sync;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Ihos.Infrastructure.BackgroundServices;

/// <summary>
/// Runs once at startup and marks any <c>VehicleSyncLog</c> rows still in
/// <see cref="SyncStatus.Running"/> as Failed with a "process restarted" message.
///
/// Why this exists: when the API process crashes (or is killed) mid-sync, the in-flight
/// background task dies without ever writing the final status — so the row would sit
/// Running forever and block all future syncs via the orchestrator's concurrency guard.
/// At startup we know nothing is actually running, so any leftover Running row is, by
/// definition, an orphan from a previous process.
///
/// Note: this writes to the audit log (Constitution Principle IV — Traceability). We do
/// NOT delete the row — we update its terminal status so the history remains intact and
/// the user can see "this run was interrupted".
/// </summary>
public sealed class OrphanSyncRecoveryService : IHostedService
{
    /// <summary>
    /// Only recover rows that have been Running longer than this. Avoids racing with a
    /// real in-flight sync that started just before this service ran (rare in practice
    /// because IHostedServices start before user traffic, but cheap insurance).
    /// </summary>
    public static readonly TimeSpan MinAge = TimeSpan.FromMinutes(1);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OrphanSyncRecoveryService> _logger;

    public OrphanSyncRecoveryService(
        IServiceScopeFactory scopeFactory,
        ILogger<OrphanSyncRecoveryService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var cutoff = DateTime.UtcNow - MinAge;
            var orphans = await db.VehicleSyncLogs
                .Where(l => l.Status == SyncStatus.Running
                         && l.StartedAtUtc < cutoff
                         && !l.IsDeleted)
                .ToListAsync(cancellationToken);

            if (orphans.Count == 0)
            {
                _logger.LogInformation("OrphanSyncRecovery: no leftover Running rows");
                return;
            }

            foreach (var row in orphans)
            {
                row.Status = SyncStatus.Failed;
                row.CompletedAtUtc = DateTime.UtcNow;
                row.DurationMs = (long)(DateTime.UtcNow - row.StartedAtUtc).TotalMilliseconds;
                row.ErrorMessage =
                    "Process restarted before sync completed — marked Failed by " +
                    "OrphanSyncRecoveryService.";
            }
            await db.SaveChangesAsync(cancellationToken);

            _logger.LogWarning(
                "OrphanSyncRecovery: marked {Count} orphan Running rows as Failed",
                orphans.Count);
        }
        catch (Exception ex)
        {
            // Never block app startup on this recovery — log and move on. Worst case:
            // an admin manually resolves the row via SQL.
            _logger.LogError(ex, "OrphanSyncRecovery failed during startup");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
