using Microsoft.Extensions.Logging;
using Polly;
using Polly.CircuitBreaker;
using Polly.Retry;
using Polly.Timeout;

namespace Ihos.Infrastructure.Resilience;

/// <summary>
/// Builds per-provider resilience pipelines. Each provider gets its own pipeline instance so
/// circuit-breaker state is isolated — one provider's outage cannot trip another's breaker.
/// Pipeline composition (outer → inner): Timeout(3s) → CircuitBreaker → Retry(once, transient only).
///
/// Tuning is taken from research.md §2:
///   - Timeout per attempt: 3 s (Spec SC-002 aggregated 3 s budget).
///   - Breaker: 50% failure ratio over 30 s sampling window, min 5 calls, 60 s break duration.
///   - Retry: at most 1 attempt, 200 ms back-off, only on transient failures.
/// </summary>
public sealed class PollyPolicyFactory
{
    private readonly ILoggerFactory _loggerFactory;

    public PollyPolicyFactory(ILoggerFactory loggerFactory)
    {
        _loggerFactory = loggerFactory;
    }

    /// <summary>
    /// Builds the resilience pipeline for a provider's outbound quote call. The provider key
    /// is used only for logging and metrics — the pipeline does not coordinate across providers.
    /// </summary>
    public ResiliencePipeline<HttpResponseMessage> BuildQuotePipeline(string providerKey)
    {
        var log = _loggerFactory.CreateLogger($"Resilience.{providerKey}");

        return new ResiliencePipelineBuilder<HttpResponseMessage>()
            .AddTimeout(new TimeoutStrategyOptions
            {
                Timeout = TimeSpan.FromSeconds(3),
                OnTimeout = args =>
                {
                    log.LogWarning("Provider {Provider} timed out after {Timeout}s",
                        providerKey, args.Timeout.TotalSeconds);
                    return ValueTask.CompletedTask;
                },
            })
            .AddCircuitBreaker(new CircuitBreakerStrategyOptions<HttpResponseMessage>
            {
                FailureRatio = 0.5,
                SamplingDuration = TimeSpan.FromSeconds(30),
                MinimumThroughput = 5,
                BreakDuration = TimeSpan.FromSeconds(60),
                ShouldHandle = new PredicateBuilder<HttpResponseMessage>()
                    .Handle<HttpRequestException>()
                    .Handle<TimeoutRejectedException>()
                    .HandleResult(r => (int)r.StatusCode >= 500),
                OnOpened = args =>
                {
                    log.LogWarning("Circuit breaker OPEN for {Provider} (break {Break}s)",
                        providerKey, args.BreakDuration.TotalSeconds);
                    return ValueTask.CompletedTask;
                },
                OnClosed = _ =>
                {
                    log.LogInformation("Circuit breaker CLOSED for {Provider}", providerKey);
                    return ValueTask.CompletedTask;
                },
            })
            .AddRetry(new RetryStrategyOptions<HttpResponseMessage>
            {
                MaxRetryAttempts = 1,
                Delay = TimeSpan.FromMilliseconds(200),
                BackoffType = DelayBackoffType.Constant,
                ShouldHandle = new PredicateBuilder<HttpResponseMessage>()
                    .Handle<HttpRequestException>()
                    .Handle<TimeoutRejectedException>()
                    .HandleResult(r => (int)r.StatusCode >= 500),
                OnRetry = args =>
                {
                    log.LogInformation("Retry attempt {Attempt} for {Provider}",
                        args.AttemptNumber + 1, providerKey);
                    return ValueTask.CompletedTask;
                },
            })
            .Build();
    }
}
