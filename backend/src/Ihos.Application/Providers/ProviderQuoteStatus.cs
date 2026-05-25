namespace Ihos.Application.Providers;

/// <summary>
/// Per-provider outcome of a quote request inside an aggregated search.
/// Maps 1:1 to UI states (Success → render plans; Timeout/BreakerOpen/Failed → "unavailable" badge;
/// NoMatch → "no plans available from {provider}").
/// </summary>
public enum ProviderQuoteStatus
{
    /// <summary>Provider returned ≥ 1 plan.</summary>
    Success = 0,

    /// <summary>Provider responded but has no plan for this request.</summary>
    NoMatch = 1,

    /// <summary>Provider exceeded the per-call timeout budget.</summary>
    Timeout = 2,

    /// <summary>Circuit breaker is open — provider call was short-circuited.</summary>
    BreakerOpen = 3,

    /// <summary>Other error (HTTP non-2xx, deserialize error, etc.).</summary>
    Failed = 4,
}
