namespace Ihos.Domain.Enums;

/// <summary>
/// Identifies how an InsuranceCompany's plan data and vehicle master data enter the system.
/// </summary>
public enum DataSourceType
{
    /// <summary>
    /// Plans and vehicles are loaded from Excel/CSV files (legacy path; e.g. Allianz).
    /// </summary>
    Import = 0,

    /// <summary>
    /// Plans are quoted live via the provider's API and vehicle master is synced periodically
    /// (e.g. MTI, Viriyah).
    /// </summary>
    Api = 1,
}
