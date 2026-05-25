namespace Ihos.Infrastructure.Providers.Mti;

/// <summary>
/// MTI (Muang Thai Insurance) provider configuration. Bound from
/// configuration section <c>Providers:Mti</c> (typically via user-secrets in dev,
/// environment variables / Key Vault in production).
/// </summary>
public sealed class MtiOptions
{
    public const string SectionName = "Providers:Mti";

    /// <summary>e.g. <c>https://api-uat.muangthaiinsurance.com/MtiRestService/api</c></summary>
    public string BaseUrl { get; set; } = string.Empty;

    /// <summary>Value for the <c>apikey</c> request header.</summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>Pre-encoded value for the <c>Authorization</c> header, e.g. <c>Basic SVNIQFRFU1Q6VEVTVA==</c>.</summary>
    public string BasicAuth { get; set; } = string.Empty;

    /// <summary>Partner code (e.g. ISH). Some MTI endpoints accept this for tagging.</summary>
    public string PartnerCode { get; set; } = "ISH";

    /// <summary>Agent code provided by MTI.</summary>
    public string AgentCode { get; set; } = string.Empty;

    /// <summary>Distribution channel (e.g. B02). Reserved for future endpoints.</summary>
    public string DChannel { get; set; } = "B02";
}
