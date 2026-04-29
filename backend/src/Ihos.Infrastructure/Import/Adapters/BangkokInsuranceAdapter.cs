namespace Ihos.Infrastructure.Import.Adapters;

/// <summary>
/// Adapter for Bangkok Insurance (BKI).
/// Expected Excel layout uses Thai column headers with optional English aliases.
/// </summary>
public sealed class BangkokInsuranceAdapter : ExcelCompanyAdapterBase
{
    // 11111111-0000-0000-0000-000000000001 (BKI seed ID)
    public override Guid CompanyId   => new("11111111-0000-0000-0000-000000000001");
    public override string CompanyName => "Bangkok Insurance";

    protected override IReadOnlyDictionary<string, string> ColumnMap =>
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            // Vehicle model
            ["รุ่นรถ"]             = "vehicle_model",
            ["รุ่นรถยนต์"]         = "vehicle_model",
            ["โมเดลรถ"]           = "vehicle_model",
            ["VehicleModel"]      = "vehicle_model",
            ["Vehicle Model"]     = "vehicle_model",

            // Plan type
            ["ประเภทประกัน"]      = "plan_type",
            ["ประเภทกรมธรรม์"]    = "plan_type",
            ["PlanType"]          = "plan_type",
            ["Plan Type"]         = "plan_type",
            ["Insurance Type"]    = "plan_type",

            // Repair type
            ["ประเภทซ่อม"]        = "repair_type",
            ["RepairType"]        = "repair_type",
            ["Repair Type"]       = "repair_type",

            // Registration year
            ["ปีจดทะเบียน"]       = "registration_year",
            ["ปีรถยนต์"]          = "registration_year",
            ["RegistrationYear"]  = "registration_year",
            ["Registration Year"] = "registration_year",
            // Legacy age-range fallbacks (mapped to registration_year)
            ["ปีเริ่มต้น"]        = "registration_year",
            ["อายุรถต่ำสุด"]      = "registration_year",
            ["MinYear"]           = "registration_year",
            ["Min Year"]          = "registration_year",

            // Financials
            ["ทุนประกัน"]         = "sum_insured",
            ["วงเงินคุ้มครอง"]    = "sum_insured",
            ["SumInsured"]        = "sum_insured",
            ["Sum Insured"]       = "sum_insured",

            ["เบี้ยรวม"]          = "premium_total",
            ["เบี้ยประกันรวม"]    = "premium_total",
            ["PremiumTotal"]      = "premium_total",
            ["Premium Total"]     = "premium_total",
            ["Premium"]           = "premium_total",

            ["ค่าเสียหายส่วนแรก"] = "excess_amount",
            ["ค่าเสียหายส่วนตัว"] = "excess_amount",
            ["ExcessAmount"]      = "excess_amount",
            ["Excess Amount"]     = "excess_amount",
            ["Excess"]            = "excess_amount",

            ["รายละเอียดความคุ้มครอง"] = "coverage_details",
            ["CoverageDetails"]   = "coverage_details",
            ["Coverage Details"]  = "coverage_details",
        };
}
