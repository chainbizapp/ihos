namespace Ihos.Domain.Enums;

/// <summary>
/// Where a <see cref="Entities.ProviderBrandAlias"/> entry came from — drives trust level
/// and whether it needs human verification before being used for live matching.
/// </summary>
public enum AliasSource
{
    /// <summary>High-confidence automatic match (fuzzy distance ≤ 1 on a long name).</summary>
    AiFuzzy = 0,

    /// <summary>Lower-confidence automatic guess — flagged for human review before use.</summary>
    AiGuess = 1,

    /// <summary>Created or confirmed by a human via the admin UI — highest trust.</summary>
    Human = 2,

    /// <summary>No canonical match found yet — pending manual resolution.</summary>
    Pending = 3,
}
