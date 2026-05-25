using Ihos.Domain.Entities;

namespace Ihos.Application.Providers;

/// <summary>
/// Canonical per-provider response inside an aggregated search. The aggregator never throws —
/// errors are first-class results with Status != Success and an optional ErrorMessage.
/// </summary>
public sealed record ProviderQuoteResult
{
    public required string CompanyShortCode { get; init; }
    public required string CompanyDisplayName { get; init; }
    public required ProviderQuoteStatus Status { get; init; }

    /// <summary>True when the plans came from cache after the upstream call failed/skipped.</summary>
    public bool IsStale { get; init; }

    public IReadOnlyList<InsurancePlan> Plans { get; init; } = Array.Empty<InsurancePlan>();

    public string? ErrorCode { get; init; }

    /// <summary>Short, sanitized message for UI. Full detail stays in server logs.</summary>
    public string? ErrorMessage { get; init; }

    public long ProviderLatencyMs { get; init; }

    public static ProviderQuoteResult Success(
        string shortCode,
        string displayName,
        IReadOnlyList<InsurancePlan> plans,
        long latencyMs,
        bool isStale = false) => new()
        {
            CompanyShortCode = shortCode,
            CompanyDisplayName = displayName,
            Status = plans.Count == 0 ? ProviderQuoteStatus.NoMatch : ProviderQuoteStatus.Success,
            Plans = plans,
            IsStale = isStale,
            ProviderLatencyMs = latencyMs,
        };

    public static ProviderQuoteResult Failure(
        string shortCode,
        string displayName,
        ProviderQuoteStatus status,
        string errorMessage,
        long latencyMs,
        string? errorCode = null) => new()
        {
            CompanyShortCode = shortCode,
            CompanyDisplayName = displayName,
            Status = status,
            ErrorMessage = errorMessage,
            ErrorCode = errorCode,
            ProviderLatencyMs = latencyMs,
        };
}
