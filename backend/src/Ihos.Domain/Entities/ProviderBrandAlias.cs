using Ihos.Domain.Common;
using Ihos.Domain.Enums;

namespace Ihos.Domain.Entities;

/// <summary>
/// Crosswalk row mapping a provider's raw brand string to a canonical <see cref="VehicleMake"/>.
/// Lets each insurer call a brand whatever they like (MTI "ISUZ", Allianz code "16",
/// "โตโยต้า") while the system resolves all of them to one canonical make.
///
/// Seeded automatically by the fuzzy resolver and editable from the admin UI. Rows from
/// <see cref="AliasSource.AiGuess"/> stay <see cref="IsVerified"/> = false until a human
/// confirms them, so a risky guess never silently affects live pricing.
/// </summary>
public class ProviderBrandAlias : BaseEntity
{
    /// <summary>Provider short-code: "MTI", "VIRIYAH", "ALA", …</summary>
    public string ProviderCode { get; set; } = string.Empty;

    /// <summary>The exact string the provider sends, e.g. "ISUZ", "16", "โตโยต้า".</summary>
    public string RawValue { get; set; } = string.Empty;

    /// <summary>Resolved canonical make. Null while <see cref="Source"/> = Pending.</summary>
    public Guid? CanonicalMakeId { get; set; }

    public AliasSource Source { get; set; } = AliasSource.Pending;

    /// <summary>0–100. For fuzzy/guess rows, derived from edit distance. Null for human/pending.</summary>
    public int? Confidence { get; set; }

    /// <summary>
    /// When false, the alias is NOT used for live matching — only human-verified (or
    /// high-confidence auto) rows resolve quotes. Guesses wait here until confirmed.
    /// </summary>
    public bool IsVerified { get; set; } = false;

    /// <summary>Last user who created/edited/verified this row (audit).</summary>
    public Guid? UpdatedBy { get; set; }

    public VehicleMake? CanonicalMake { get; set; }
}
