using Ihos.Application.Import.Services;

namespace Ihos.Application.Import.Adapters;

/// <summary>
/// Canonical row produced by every company adapter.
/// Field names match the keys expected by PublishImportBatchCommand.
/// </summary>
public record NormalizedPlanRow(
    string RawVehicleModel,
    string RawPlanType,
    string RepairType,
    string MinYear,
    string MaxYear,
    string SumInsured,
    string PremiumTotal,
    string ExcessAmount,
    string CoverageDetails,
    /// <summary>
    /// Optional geographic region identifier (e.g. Allianz REGION_GROUP).
    /// Empty string means "no regional pricing" — treated as a unique key component.
    /// </summary>
    string RegionGroup = "",
    /// <summary>
    /// Optional company-assigned package/product ID (e.g. Allianz PACKAGE_ID).
    /// When non-empty it is included in the business unique key so that the same
    /// coverage parameters at different price tiers are stored as separate plans.
    /// </summary>
    string ExternalPackageId = "",
    // ── Structured coverage limits (empty = not provided by this company) ──
    /// <summary>TPBI per person — ความรับผิดชอบต่อคู่กรณีต่อคน</summary>
    string TpbiPerPerson = "",
    /// <summary>TPBI per accident — ต่อครั้ง</summary>
    string TpbiPerAccident = "",
    /// <summary>Third Party Property Damage — ความเสียหายต่อทรัพย์สินคู่กรณี</summary>
    string Tppd = "",
    /// <summary>Fire &amp; Theft — รถยนต์สูญหาย/ไฟไหม้</summary>
    string FireTheft = "",
    /// <summary>Driver Personal Accident — อุบัติเหตุส่วนบุคคลผู้ขับขี่</summary>
    string PersonalAccident = "",
    /// <summary>Passenger Personal Accident — อุบัติเหตุส่วนบุคคลผู้โดยสาร</summary>
    string PassengerAccident = "",
    /// <summary>Medical Expenses — ค่ารักษาพยาบาล</summary>
    string MedicalExpenses = "",
    /// <summary>Bail Bond — ประกันตัวผู้ขับขี่</summary>
    string BailBond = ""
)
{
    /// <summary>
    /// Serializes to the canonical dictionary stored in ImportRecord.RawData.
    /// </summary>
    public Dictionary<string, string> ToRawData() => new()
    {
        ["vehicle_model"]       = RawVehicleModel,
        ["plan_type"]           = RawPlanType,
        ["repair_type"]         = RepairType,
        ["min_year"]            = MinYear,
        ["max_year"]            = MaxYear,
        ["sum_insured"]         = SumInsured,
        ["premium_total"]       = PremiumTotal,
        ["excess_amount"]       = ExcessAmount,
        ["coverage_details"]    = CoverageDetails,
        ["region_group"]        = RegionGroup,
        ["external_package_id"] = ExternalPackageId,
        ["tpbi_per_person"]     = TpbiPerPerson,
        ["tpbi_per_accident"]   = TpbiPerAccident,
        ["tppd"]                = Tppd,
        ["fire_theft"]          = FireTheft,
        ["personal_accident"]   = PersonalAccident,
        ["passenger_accident"]  = PassengerAccident,
        ["medical_expenses"]    = MedicalExpenses,
        ["bail_bond"]           = BailBond
    };
}

public record AdapterParseResult
{
    public bool Success { get; init; }
    public IReadOnlyList<ParseError> Errors { get; init; } = [];
    public IReadOnlyList<NormalizedPlanRow> Rows { get; init; } = [];

    public static AdapterParseResult Ok(IReadOnlyList<NormalizedPlanRow> rows) =>
        new() { Success = true, Rows = rows };

    public static AdapterParseResult Fail(IReadOnlyList<ParseError> errors) =>
        new() { Success = false, Errors = errors };

    public static AdapterParseResult Fail(string reason) =>
        Fail([new ParseError(0, "File", reason)]);
}

/// <summary>
/// Parses one insurance company's proprietary file format into canonical plan rows.
/// Implement one adapter per company. Register in DI and the registry resolves it by CompanyId.
/// </summary>
public interface ICompanyImportAdapter
{
    /// <summary>The company this adapter handles.</summary>
    Guid CompanyId { get; }

    /// <summary>Human-readable name for logging/error messages.</summary>
    string CompanyName { get; }

    /// <summary>File extensions this adapter accepts, e.g. [".xlsx", ".xls"].</summary>
    IReadOnlyList<string> SupportedExtensions { get; }

    /// <summary>Parse the file stream and return normalized plan rows.</summary>
    Task<AdapterParseResult> ParseAsync(Stream stream, string fileName, CancellationToken ct = default);
}

/// <summary>
/// Resolves the correct adapter for a given company.
/// Returns null when no adapter has been registered — callers should reject
/// the upload and ask the customer to request a new adapter.
/// </summary>
public interface ICompanyAdapterRegistry
{
    ICompanyImportAdapter? GetAdapter(Guid companyId);
    IReadOnlyList<ICompanyImportAdapter> GetAll();
}
