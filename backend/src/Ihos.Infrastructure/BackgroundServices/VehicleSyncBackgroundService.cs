using System.Globalization;
using Ihos.Application.Sync;
using Ihos.Domain.Enums;
using Ihos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Ihos.Infrastructure.BackgroundServices;

/// <summary>
/// Daily vehicle-master sync. At local <c>SyncScheduleOptions.DailyAtLocal</c>, iterates
/// every active <see cref="InsuranceCompany"/> with <c>DataSource = Api</c> and invokes
/// the same <see cref="ISyncOrchestrator"/> that the Admin UI uses — so the audit row in
/// <c>VehicleSyncLog</c> looks identical except for <c>Trigger = Scheduled</c>.
/// </summary>
public sealed class VehicleSyncBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<VehicleSyncBackgroundService> _logger;
    private readonly IOptionsMonitor<SyncScheduleOptions> _options;

    public VehicleSyncBackgroundService(
        IServiceScopeFactory scopeFactory,
        IOptionsMonitor<SyncScheduleOptions> options,
        ILogger<VehicleSyncBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("VehicleSyncBackgroundService starting (DailyAtLocal={Time})",
            _options.CurrentValue.DailyAtLocal);

        while (!stoppingToken.IsCancellationRequested)
        {
            var opts = _options.CurrentValue;
            if (opts.Disabled)
            {
                _logger.LogInformation("Scheduled sync disabled by configuration");
                await SafeDelay(TimeSpan.FromHours(1), stoppingToken);
                continue;
            }

            var delay = ComputeDelayUntilNextRun(opts.DailyAtLocal);
            _logger.LogInformation("Next scheduled sync in {Delay} (at {Target} local)",
                delay, DateTime.Now + delay);

            await SafeDelay(delay, stoppingToken);
            if (stoppingToken.IsCancellationRequested) break;

            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Scheduled sync iteration failed");
            }
        }
    }

    /// <summary>
    /// Fires <see cref="ISyncOrchestrator.StartAsync"/> for every active company whose
    /// <c>DataSource = Api</c>. Failures are logged per-company and never abort the loop.
    /// </summary>
    private async Task RunOnceAsync(CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var orchestrator = scope.ServiceProvider.GetRequiredService<ISyncOrchestrator>();

        var companies = await db.InsuranceCompanies
            .Where(c => c.IsActive && !c.IsDeleted && c.DataSource == DataSourceType.Api)
            .Select(c => new { c.Id, c.ShortCode })
            .ToListAsync(ct);

        _logger.LogInformation("Scheduled sync starting for {Count} API-source companies",
            companies.Count);

        foreach (var c in companies)
        {
            try
            {
                await orchestrator.StartAsync(c.ShortCode,
                    SyncTriggerType.Scheduled, actorUserId: null, ct);
                _logger.LogInformation("Started scheduled sync for {ShortCode}", c.ShortCode);
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("already running",
                StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Skipping {ShortCode}: previous run still in progress",
                    c.ShortCode);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to start scheduled sync for {ShortCode}",
                    c.ShortCode);
            }
        }
    }

    /// <summary>
    /// Returns the delay until the next occurrence of <paramref name="dailyAtLocal"/>
    /// (e.g. <c>"02:00"</c>) in local time. If today's slot has already passed, schedules
    /// for tomorrow.
    /// </summary>
    internal static TimeSpan ComputeDelayUntilNextRun(string dailyAtLocal)
    {
        if (!TimeSpan.TryParseExact(dailyAtLocal, "hh\\:mm",
                CultureInfo.InvariantCulture, out var time))
            time = TimeSpan.FromHours(2); // fallback 02:00

        var now = DateTime.Now;
        var target = now.Date + time;
        if (target <= now) target = target.AddDays(1);
        return target - now;
    }

    private static async Task SafeDelay(TimeSpan delay, CancellationToken ct)
    {
        try { await Task.Delay(delay, ct); }
        catch (OperationCanceledException) { /* shutdown */ }
    }
}
