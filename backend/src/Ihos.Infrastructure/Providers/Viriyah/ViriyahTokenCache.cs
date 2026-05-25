using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Ihos.Infrastructure.Providers.Viriyah;

/// <summary>
/// Singleton cache for the Viriyah OAuth-style access token. Token TTL = 3600 s; we refresh
/// at least 60 s before expiry to absorb clock skew. Concurrent quote requests during an
/// expiry window are serialized via <see cref="SemaphoreSlim"/> so we never trigger a
/// refresh storm.
/// </summary>
public sealed class ViriyahTokenCache
{
    private static readonly TimeSpan RefreshLeadTime = TimeSpan.FromSeconds(60);
    private readonly SemaphoreSlim _gate = new(1, 1);
    private string? _token;
    private DateTime _expiresAtUtc = DateTime.MinValue;

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ViriyahOptions _options;
    private readonly ILogger<ViriyahTokenCache> _logger;

    public const string TokenHttpClientName = "viriyah-token";

    public ViriyahTokenCache(
        IHttpClientFactory httpClientFactory,
        IOptions<ViriyahOptions> options,
        ILogger<ViriyahTokenCache> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<string> GetTokenAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        if (_token is not null && now < _expiresAtUtc - RefreshLeadTime)
            return _token;

        await _gate.WaitAsync(cancellationToken);
        try
        {
            // Re-check after acquiring the semaphore in case another caller refreshed.
            now = DateTime.UtcNow;
            if (_token is not null && now < _expiresAtUtc - RefreshLeadTime)
                return _token;

            var (token, expiresIn) = await AcquireTokenAsync(cancellationToken);
            _token = token;
            _expiresAtUtc = DateTime.UtcNow.AddSeconds(expiresIn);
            _logger.LogInformation("Viriyah token refreshed (expires in {Seconds}s)", expiresIn);
            return token;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>Forces the next call to refresh — used when the upstream returns 401.</summary>
    public void Invalidate()
    {
        _token = null;
        _expiresAtUtc = DateTime.MinValue;
    }

    private async Task<(string Token, int ExpiresInSeconds)> AcquireTokenAsync(
        CancellationToken cancellationToken)
    {
        var http = _httpClientFactory.CreateClient(TokenHttpClientName);
        if (http.BaseAddress is null && !string.IsNullOrWhiteSpace(_options.BaseUrl))
            http.BaseAddress = new Uri(_options.BaseUrl.TrimEnd('/') + "/");

        using var req = new HttpRequestMessage(
            HttpMethod.Post, "api/authen/token/v1/generate");

        // Viriyah uses request headers (not the JSON body) for credentials.
        // ⚠️ Password is sent verbatim — DO NOT escape-encode (Viriyah quirks with backslashes).
        req.Headers.TryAddWithoutValidation("sourceTransID", $"ihos-{Guid.NewGuid()}");
        req.Headers.TryAddWithoutValidation("clientID", _options.ClientId);
        req.Headers.TryAddWithoutValidation("clientSecret", _options.ClientSecret);
        req.Headers.TryAddWithoutValidation("userName", _options.UserName);
        req.Headers.TryAddWithoutValidation("passWord", _options.Password);
        req.Headers.TryAddWithoutValidation("requestTime",
            DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss"));
        req.Headers.TryAddWithoutValidation("grantType", "password");
        req.Headers.TryAddWithoutValidation("scope", "profile");
        req.Headers.TryAddWithoutValidation("languagePreference", "TH");

        // Empty JSON body — credentials go in the headers.
        req.Content = JsonContent.Create(new { });

        using var resp = await http.SendAsync(req, cancellationToken);
        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException(
                $"Viriyah token endpoint returned HTTP {(int)resp.StatusCode}: " +
                (body.Length > 300 ? body[..300] : body));
        }

        var token = await resp.Content.ReadFromJsonAsync<ViriyahTokenResponse>(cancellationToken)
            ?? throw new InvalidOperationException("Viriyah token response was empty");

        if (string.IsNullOrWhiteSpace(token.AccessToken))
            throw new InvalidOperationException(
                "Viriyah token response did not contain access_token");

        // Default to 3600 s if expires_in isn't supplied.
        var expiresIn = token.ExpiresIn > 0 ? token.ExpiresIn : 3600;
        return (token.AccessToken, expiresIn);
    }

    private sealed record ViriyahTokenResponse(
        [property: JsonPropertyName("access_token")] string AccessToken,
        [property: JsonPropertyName("expires_in")] int ExpiresIn,
        [property: JsonPropertyName("token_type")] string? TokenType);
}
