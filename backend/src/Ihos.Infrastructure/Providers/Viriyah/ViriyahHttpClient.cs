using Microsoft.Extensions.Options;

namespace Ihos.Infrastructure.Providers.Viriyah;

/// <summary>
/// Typed HTTP client for Viriyah quote endpoints. Per-request headers (clientID, clientSecret,
/// sourceTransID, requestTime, Authorization Bearer) are set by the adapter call sites because
/// the Bearer token rotates every hour — see <see cref="ViriyahTokenCache"/>.
/// </summary>
public sealed class ViriyahHttpClient
{
    public HttpClient HttpClient { get; }
    public ViriyahOptions Options { get; }

    public ViriyahHttpClient(HttpClient httpClient, IOptions<ViriyahOptions> options)
    {
        Options = options.Value;
        HttpClient = httpClient;
        if (!string.IsNullOrWhiteSpace(Options.BaseUrl))
            HttpClient.BaseAddress = new Uri(Options.BaseUrl.TrimEnd('/') + "/");
    }
}
