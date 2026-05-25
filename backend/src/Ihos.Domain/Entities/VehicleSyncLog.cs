using Ihos.Domain.Common;
using Ihos.Domain.Enums;

namespace Ihos.Domain.Entities;

/// <summary>
/// Immutable-after-completion audit row for a vehicle-master sync run.
/// One row is inserted (Status=Running) when a sync starts and updated once on completion.
/// Per Constitution Principle IV (Traceability) and Principle V (no destructive operations).
/// </summary>
public class VehicleSyncLog : BaseEntity
{
    public Guid CompanyId { get; set; }
    public InsuranceCompany? Company { get; set; }

    public SyncTriggerType Trigger { get; set; }

    /// <summary>NULL for Scheduled runs; user id for Manual triggers.</summary>
    public Guid? TriggeredByUserId { get; set; }

    public DateTime StartedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }

    public SyncStatus Status { get; set; }

    public int InsertedCount { get; set; }
    public int UpdatedCount { get; set; }
    public int DeactivatedCount { get; set; }
    public int ErrorCount { get; set; }

    /// <summary>Truncated to 2000 chars; full detail goes to Serilog.</summary>
    public string? ErrorMessage { get; set; }

    public long? DurationMs { get; set; }
}
