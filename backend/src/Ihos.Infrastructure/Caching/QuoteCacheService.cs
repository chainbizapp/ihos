using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace Ihos.Infrastructure.Caching;

/// <summary>
/// Stale-while-revalidate wrapper around <see cref="IDistributedCache"/>.
/// Returns a fresh-or-stale cached value with an <c>IsStale</c> flag and, on stale hits,
/// triggers a fire-and-forget background refresh. On a hard miss, falls through to the factory.
///
/// Defaults from research.md §3: fresh TTL = 15 min, stale TTL = 24 h.
/// </summary>
public sealed class QuoteCacheService
{
    public static readonly TimeSpan FreshTtl = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan StaleTtl = TimeSpan.FromHours(24);

    private readonly IDistributedCache _cache;
    private readonly ILogger<QuoteCacheService> _logger;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public QuoteCacheService(IDistributedCache cache, ILogger<QuoteCacheService> logger)
    {
        _cache = cache;
        _logger = logger;
    }

    /// <summary>
    /// Retrieves a value with SWR semantics.
    ///
    /// Flow:
    /// <list type="number">
    ///   <item>Cache hit + fresh → return (value, isStale=false).</item>
    ///   <item>Cache hit + stale → fire-and-forget refresh, return (value, isStale=true).</item>
    ///   <item>Cache miss → call factory; on success cache + return (value, false); on failure
    ///         propagate the exception so the caller can decide (provider adapters convert this
    ///         to a Failed/Timeout ProviderQuoteResult).</item>
    /// </list>
    /// </summary>
    public async Task<CacheLookupResult<T>> GetOrCallAsync<T>(
        string key,
        Func<CancellationToken, Task<T>> factory,
        CancellationToken cancellationToken) where T : class
    {
        var envelope = await TryReadAsync<T>(key, cancellationToken);
        if (envelope is not null)
        {
            var ageSeconds = (DateTime.UtcNow - envelope.WrittenAtUtc).TotalSeconds;
            if (ageSeconds <= FreshTtl.TotalSeconds)
            {
                return new CacheLookupResult<T>(envelope.Value, IsStale: false, CameFromCache: true);
            }

            // Stale-but-usable: schedule background refresh, return stale immediately.
            _ = Task.Run(async () =>
            {
                try
                {
                    using var bgCts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
                    var fresh = await factory(bgCts.Token);
                    await WriteAsync(key, fresh, bgCts.Token);
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex,
                        "Background SWR refresh failed for key {Key} — stale entry retained", key);
                }
            }, CancellationToken.None);

            return new CacheLookupResult<T>(envelope.Value, IsStale: true, CameFromCache: true);
        }

        // Hard miss — call factory synchronously, cache result.
        var value = await factory(cancellationToken);
        await WriteAsync(key, value, cancellationToken);
        return new CacheLookupResult<T>(value, IsStale: false, CameFromCache: false);
    }

    /// <summary>
    /// Reads a stale-fallback entry if any exists, regardless of age (used when the live call
    /// just failed and the caller wants to return cached data instead of an error).
    /// </summary>
    public async Task<T?> TryGetStaleAsync<T>(string key, CancellationToken cancellationToken)
        where T : class
    {
        var envelope = await TryReadAsync<T>(key, cancellationToken);
        return envelope?.Value;
    }

    private async Task<CacheEnvelope<T>?> TryReadAsync<T>(string key, CancellationToken ct)
        where T : class
    {
        try
        {
            var bytes = await _cache.GetAsync(key, ct);
            if (bytes is null || bytes.Length == 0) return null;
            return JsonSerializer.Deserialize<CacheEnvelope<T>>(bytes, JsonOpts);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Cache read failed for {Key}", key);
            return null;
        }
    }

    private async Task WriteAsync<T>(string key, T value, CancellationToken ct) where T : class
    {
        try
        {
            var envelope = new CacheEnvelope<T>(value, DateTime.UtcNow);
            var bytes = JsonSerializer.SerializeToUtf8Bytes(envelope, JsonOpts);
            await _cache.SetAsync(key, bytes, new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = StaleTtl,
            }, ct);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Cache write failed for {Key}", key);
        }
    }

    private sealed record CacheEnvelope<T>(T Value, DateTime WrittenAtUtc);
}

public sealed record CacheLookupResult<T>(T Value, bool IsStale, bool CameFromCache);
