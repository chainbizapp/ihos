using Ihos.Domain.Enums;

namespace Ihos.Application.Providers;

/// <summary>
/// Result of a single vehicle-master sync run, ready to be persisted into <c>VehicleSyncLog</c>.
/// </summary>
public sealed record SyncOutcome(
    SyncStatus Status,
    int InsertedCount,
    int UpdatedCount,
    int DeactivatedCount,
    int ErrorCount,
    long DurationMs,
    string? ErrorMessage = null);
