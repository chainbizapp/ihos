using Microsoft.Extensions.Options;

namespace Ihos.Infrastructure.Providers.Mti;

/// <summary>
/// Typed HTTP client for the MTI Rest Service. Default headers (<c>apikey</c>,
/// <c>Authorization</c>) are set once at construction so individual call sites stay clean.
/// Use via <see cref="HttpClient"/> property — resilience policy is applied on the
/// underlying HttpClient by <c>AddResilienceHandler</c> in DI registration.
/// </summary>
public sealed class MtiHttpClient
{
    public HttpClient HttpClient { get; }
    public MtiOptions Options { get; }

    public MtiHttpClient(HttpClient httpClient, IOptions<MtiOptions> options)
    {
        Options = options.Value;
        HttpClient = httpClient;

        if (!string.IsNullOrWhiteSpace(Options.BaseUrl))
            HttpClient.BaseAddress = new Uri(Options.BaseUrl.TrimEnd('/') + "/");

        if (!string.IsNullOrWhiteSpace(Options.ApiKey))
            HttpClient.DefaultRequestHeaders.TryAddWithoutValidation("apikey", Options.ApiKey);

        if (!string.IsNullOrWhiteSpace(Options.BasicAuth))
            HttpClient.DefaultRequestHeaders.TryAddWithoutValidation(
                "Authorization", Options.BasicAuth);
    }
}
