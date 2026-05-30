namespace Ihos.Infrastructure.BackgroundServices;

/// <summary>
/// Configuration for the daily vehicle-master sync. Bound from
/// <c>Providers:SyncSchedule</c>.
/// </summary>
public sealed class SyncScheduleOptions
{
    public const string SectionName = "Providers:SyncSchedule";

    /// <summary>Local-time hour:minute string (24h), e.g. <c>"02:00"</c>. Default: 02:00.</summary>
    public string DailyAtLocal { get; set; } = "02:00";

    /// <summary>Disable scheduled execution entirely (manual triggers still work).</summary>
    public bool Disabled { get; set; } = false;
}
