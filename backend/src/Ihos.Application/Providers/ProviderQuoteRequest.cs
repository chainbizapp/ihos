using Ihos.Domain.Enums;

namespace Ihos.Application.Providers;

/// <summary>
/// Canonical request shape passed to every IInsurerQuoteProvider. Providers translate
/// these fields to their own request format (and ignore fields they do not use).
/// </summary>
public sealed record ProviderQuoteRequest(
    Guid VehicleModelId,
    int RegistrationYear,
    PlanType PlanType,
    RepairType RepairType,
    decimal SumInsured,
    decimal Deductible,
    string? DriverAgeBand,
    string? UsageType,
    string? RegionGroup,
    /// <summary>Correlation id propagated to provider logs.</summary>
    string RequestId
);
