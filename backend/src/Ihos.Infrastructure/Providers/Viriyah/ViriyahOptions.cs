namespace Ihos.Infrastructure.Providers.Viriyah;

/// <summary>
/// Viriyah Insurance provider configuration. Bound from <c>Providers:Viriyah</c>.
/// ⚠️ The password contains a backslash and special characters — must be stored verbatim
/// (single-quoted in shells / user-secrets). Do NOT escape-interpret.
/// </summary>
public sealed class ViriyahOptions
{
    public const string SectionName = "Providers:Viriyah";

    /// <summary>e.g. <c>https://uat-api.viriyah.co.th/uat/gw</c></summary>
    public string BaseUrl { get; set; } = string.Empty;

    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;

    /// <summary>Verbatim password — may contain backslash, braces, special chars.</summary>
    public string Password { get; set; } = string.Empty;

    public string AgentCode { get; set; } = string.Empty;
}
