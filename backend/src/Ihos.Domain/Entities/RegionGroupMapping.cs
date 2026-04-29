using Ihos.Domain.Enums;

namespace Ihos.Domain.Entities;

/// <summary>
/// Maps a company-specific RegionGroup code to one or more standard ThaiRegion values.
/// One row per (company, regionGroup, region) — so UPC can have 5 rows covering all
/// non-Bangkok / non-Northeast regions.
/// </summary>
public class RegionGroupMapping
{
    public int Id { get; set; }

    /// <summary>Matches InsuranceCompany.ShortCode (e.g. "ALLIANZ").</summary>
    public string CompanyShortCode { get; set; } = string.Empty;

    /// <summary>Company-specific region code (e.g. "BKK", "NE", "UPC").</summary>
    public string RegionGroup { get; set; } = string.Empty;

    /// <summary>The Thai region this mapping applies to.</summary>
    public ThaiRegion ThaiRegion { get; set; }
}
