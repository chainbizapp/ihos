namespace Ihos.Application.Providers;

/// <summary>
/// Per-provider quoting interface. Implementations live in Ihos.Infrastructure/Providers/{Vendor}
/// and are resolved via <see cref="IProviderRegistry"/> keyed by InsuranceCompany.ShortCode.
/// </summary>
/// <remarks>
/// Implementations MUST:
/// <list type="bullet">
///   <item>Never throw — convert all failures to <see cref="ProviderQuoteResult"/> with the
///         appropriate <see cref="ProviderQuoteStatus"/>.</item>
///   <item>Honor the supplied <see cref="CancellationToken"/> (the search aggregator may cancel).</item>
///   <item>Apply per-call resilience (timeout, breaker) — typically via the
///         <c>IHttpClientFactory</c> resilience handler wired in DI.</item>
/// </list>
/// </remarks>
public interface IInsurerQuoteProvider
{
    /// <summary>Matches <c>InsuranceCompany.ShortCode</c>. Used as the DI registration key.</summary>
    string ShortCode { get; }

    Task<ProviderQuoteResult> GetQuoteAsync(
        ProviderQuoteRequest request,
        CancellationToken cancellationToken);
}
