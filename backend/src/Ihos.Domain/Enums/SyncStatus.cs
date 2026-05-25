namespace Ihos.Domain.Enums;

/// <summary>
/// Lifecycle state of a vehicle-master sync run.
/// </summary>
public enum SyncStatus
{
    /// <summary>Sync is in progress.</summary>
    Running = 0,

    /// <summary>Sync completed with no per-record errors.</summary>
    Succeeded = 1,

    /// <summary>Sync failed before processing any records (e.g. auth/connectivity).</summary>
    Failed = 2,

    /// <summary>Sync completed but some records failed processing.</summary>
    PartialSuccess = 3,
}
