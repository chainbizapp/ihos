namespace Ihos.Domain.Enums;

/// <summary>
/// Identifies what initiated a vehicle-master sync run.
/// </summary>
public enum SyncTriggerType
{
    /// <summary>Background service fired the sync on its daily schedule.</summary>
    Scheduled = 0,

    /// <summary>An admin user triggered the sync from the UI.</summary>
    Manual = 1,
}
