using Ihos.Application.Providers;
using Ihos.Application.Sync;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Ihos.Infrastructure.Sync;

/// <summary>
/// Default <see cref="ISyncOrchestrator"/> implementation. Persists a Running
/// <see cref="VehicleSyncLog"/> row, fires the matching <see cref="IVehicleMasterSyncer"/>
/// in a background DI scope, and updates the same row with the final outcome. The Running
/// row is rejected if another Running row exists for the same company (concurrency guard).
/// </summary>
public sealed class SyncOrchestrator : ISyncOrchestrator
{
    /// <summary>
    /// Hard wall-clock cap per sync run. If the underlying
    /// <see cref="Ihos.Application.Providers.IVehicleMasterSyncer"/> doesn't return within
    /// this window we cancel and mark the row Failed — prevents Running rows from blocking
    /// future syncs when a provider hangs (e.g., MTI UAT rate-limited and 100+ sequential
    /// HTTP calls accumulating Polly timeouts).
    /// </summary>
    public static readonly TimeSpan SyncTimeoutCap = TimeSpan.FromMinutes(3);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SyncOrchestrator> _logger;

    public SyncOrchestrator(IServiceScopeFactory scopeFactory, ILogger<SyncOrchestrator> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task<Guid> StartAsync(
        string shortCode,
        SyncTriggerType trigger,
        Guid? actorUserId,
        CancellationToken cancellationToken)
    {
        Guid syncLogId;
        Guid companyId;

        // ── Phase 1: synchronously insert the Running row in the caller's scope ──────
        await using (var setupScope = _scopeFactory.CreateAsyncScope())
        {
            var setupDb = setupScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var company = await setupDb.InsuranceCompanies
                .FirstOrDefaultAsync(c => c.ShortCode == shortCode && !c.IsDeleted, cancellationToken)
                ?? throw new InvalidOperationException(
                    $"No InsuranceCompany row with ShortCode='{shortCode}'.");
            companyId = company.Id;

            var alreadyRunning = await setupDb.VehicleSyncLogs
                .AnyAsync(l => l.CompanyId == company.Id
                            && l.Status == SyncStatus.Running
                            && !l.IsDeleted, cancellationToken);
            if (alreadyRunning)
                throw new InvalidOperationException(
                    $"A sync is already running for {shortCode}. Wait for it to finish.");

            var log = new VehicleSyncLog
            {
                CompanyId = company.Id,
                Trigger = trigger,
                TriggeredByUserId = actorUserId,
                StartedAtUtc = DateTime.UtcNow,
                Status = SyncStatus.Running,
                CreatedBy = actorUserId,
            };
            setupDb.VehicleSyncLogs.Add(log);
            await setupDb.SaveChangesAsync(cancellationToken);
            syncLogId = log.Id;
        }

        // ── Phase 2: fire the sync in a detached background scope ──────────────────
        // We deliberately don't await the task — the HTTP request returns once the Running
        // row is persisted. Status polling happens via GetSyncStatusQuery.
        _ = Task.Run(() => RunInBackgroundAsync(shortCode, syncLogId, companyId),
            CancellationToken.None);

        return syncLogId;
    }

    private async Task RunInBackgroundAsync(string shortCode, Guid syncLogId, Guid companyId)
    {
        // Build an independent scope so the DbContext + syncer instances live as long as
        // the sync run, not the originating HTTP request.
        await using var scope = _scopeFactory.CreateAsyncScope();
        var sp = scope.ServiceProvider;
        var db = sp.GetRequiredService<ApplicationDbContext>();
        var log = await db.VehicleSyncLogs.FirstOrDefaultAsync(l => l.Id == syncLogId);
        if (log is null)
        {
            _logger.LogWarning("Background sync started but VehicleSyncLog {Id} was not found",
                syncLogId);
            return;
        }

        // Wall-clock cap — defends against hangs in provider HTTP calls. Some HTTP libraries
        // ignore CancellationToken once the TCP socket is mid-read, so cooperatively-cancelled
        // tokens are not sufficient. We use Task.WhenAny against a Task.Delay: when the delay
        // wins, the syncer is abandoned (it keeps running in the background until GC/process
        // exit) and the audit row gets a terminal Failed status so it doesn't block the next
        // sync. OrphanSyncRecoveryService cleans any genuinely-leaked rows at next startup.
        using var cts = new CancellationTokenSource(SyncTimeoutCap);

        try
        {
            var syncer = sp.GetServices<IVehicleMasterSyncer>()
                .FirstOrDefault(s => string.Equals(s.ShortCode, shortCode,
                    StringComparison.OrdinalIgnoreCase));
            if (syncer is null)
            {
                log.Status = SyncStatus.Failed;
                log.CompletedAtUtc = DateTime.UtcNow;
                log.ErrorMessage = $"No IVehicleMasterSyncer registered for '{shortCode}'.";
                log.DurationMs = (long)(log.CompletedAtUtc.Value - log.StartedAtUtc).TotalMilliseconds;
                await db.SaveChangesAsync();
                return;
            }

            var syncerTask = syncer.SyncAsync(log.Trigger, log.TriggeredByUserId, cts.Token);
            var capTask = Task.Delay(SyncTimeoutCap, CancellationToken.None);
            var winner = await Task.WhenAny(syncerTask, capTask);

            if (winner == capTask)
            {
                // Hard timeout — request cancellation (best-effort) and don't await the syncer.
                cts.Cancel();
                _logger.LogWarning(
                    "Sync {SyncLogId} for {ShortCode} exceeded {Cap} wall-clock cap — abandoning",
                    syncLogId, shortCode, SyncTimeoutCap);
                await MarkLogFailedAsync(db, syncLogId,
                    $"Sync exceeded {SyncTimeoutCap.TotalMinutes:0} min hard cap. " +
                    "Provider likely hung — check upstream availability.");
                return;
            }

            // Syncer finished within cap — observe its result.
            var outcome = await syncerTask;

            log.Status = outcome.Status;
            log.InsertedCount = outcome.InsertedCount;
            log.UpdatedCount = outcome.UpdatedCount;
            log.DeactivatedCount = outcome.DeactivatedCount;
            log.ErrorCount = outcome.ErrorCount;
            log.ErrorMessage = outcome.ErrorMessage;
            log.DurationMs = outcome.DurationMs;
            log.CompletedAtUtc = DateTime.UtcNow;
            await db.SaveChangesAsync();

            _logger.LogInformation(
                "Sync {SyncLogId} for {ShortCode} finished: status={Status} inserted={Inserted} updated={Updated}",
                syncLogId, shortCode, outcome.Status, outcome.InsertedCount, outcome.UpdatedCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Sync {SyncLogId} for {ShortCode} threw", syncLogId, shortCode);
            await MarkLogFailedAsync(db, syncLogId,
                ex.Message.Length > 1900 ? ex.Message[..1900] : ex.Message);
        }
    }

    /// <summary>
    /// Writes a terminal Failed status onto the sync log row. Critically, this discards any
    /// pending tracked changes on the DbContext first — when the syncer failed mid-flight
    /// (e.g., DB constraint violation on bulk insert), the context still holds the broken
    /// pending entities and a naive SaveChanges would re-attempt those inserts and fail
    /// for the same reason, leaving the row stuck Running.
    /// </summary>
    private async Task MarkLogFailedAsync(
        ApplicationDbContext db, Guid syncLogId, string errorMessage)
    {
        try
        {
            db.ChangeTracker.Clear();
            var fresh = await db.VehicleSyncLogs.FirstOrDefaultAsync(l => l.Id == syncLogId);
            if (fresh is null) return;

            fresh.Status = SyncStatus.Failed;
            fresh.CompletedAtUtc = DateTime.UtcNow;
            fresh.ErrorMessage = errorMessage;
            fresh.DurationMs = (long)(fresh.CompletedAtUtc.Value - fresh.StartedAtUtc).TotalMilliseconds;
            await db.SaveChangesAsync();
        }
        catch (Exception saveEx)
        {
            _logger.LogError(saveEx,
                "Failed to persist sync failure for {SyncLogId} — row will remain Running until next process restart picks it up via OrphanSyncRecoveryService",
                syncLogId);
        }
    }
}
