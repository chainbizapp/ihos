using System.Net.Http.Json;

namespace Ihos.Infrastructure.Providers.Viriyah;

/// <summary>
/// Shared helper for building Viriyah quote requests. All Viriyah motor endpoints share the
/// same per-request header set; centralizing it here keeps CMI and VMI adapters DRY.
/// </summary>
internal static class ViriyahQuoteRequestBuilder
{
    public static HttpRequestMessage Build(
        string path,
        object body,
        string bearerToken,
        ViriyahOptions options)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, path);
        req.Headers.TryAddWithoutValidation("sourceTransID", $"ihos-{Guid.NewGuid()}");
        req.Headers.TryAddWithoutValidation("clientID", options.ClientId);
        req.Headers.TryAddWithoutValidation("clientSecret", options.ClientSecret);
        req.Headers.TryAddWithoutValidation("requestTime",
            DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss"));
        req.Headers.TryAddWithoutValidation("Authorization", $"Bearer {bearerToken}");
        req.Headers.TryAddWithoutValidation("languagePreference", "TH");
        req.Content = JsonContent.Create(body);
        return req;
    }
}
