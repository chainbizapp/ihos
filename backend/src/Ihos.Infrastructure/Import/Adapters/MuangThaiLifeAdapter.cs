namespace Ihos.Infrastructure.Import.Adapters;

/// <summary>
/// Adapter for Muang Thai Life (MTL).
/// Uses English column headers with MTL-specific naming conventions.
/// </summary>
public sealed class MuangThaiLifeAdapter : ExcelCompanyAdapterBase
{
    // 11111111-0000-0000-0000-000000000002 (MTL seed ID)
    public override Guid CompanyId   => new("11111111-0000-0000-0000-000000000002");
    public override string CompanyName => "Muang Thai Life";

    protected override IReadOnlyDictionary<string, string> ColumnMap =>
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            // Vehicle model
            ["Car Model"]         = "vehicle_model",
            ["Car Make/Model"]    = "vehicle_model",
            ["Model"]             = "vehicle_model",
            ["Vehicle"]           = "vehicle_model",
            ["VehicleModel"]      = "vehicle_model",

            // Plan type
            ["Insurance Type"]    = "plan_type",
            ["Policy Type"]       = "plan_type",
            ["Type"]              = "plan_type",
            ["PlanType"]          = "plan_type",

            // Repair type
            ["Repair"]            = "repair_type",
            ["Repair Type"]       = "repair_type",
            ["Workshop Type"]     = "repair_type",
            ["RepairType"]        = "repair_type",

            // Year range
            ["Age From"]          = "min_year",
            ["Min Age"]           = "min_year",
            ["From Year"]         = "min_year",
            ["MinYear"]           = "min_year",

            ["Age To"]            = "max_year",
            ["Max Age"]           = "max_year",
            ["To Year"]           = "max_year",
            ["MaxYear"]           = "max_year",

            // Financials
            ["Coverage Amount"]   = "sum_insured",
            ["Insured Amount"]    = "sum_insured",
            ["Sum Insured"]       = "sum_insured",
            ["SumInsured"]        = "sum_insured",

            ["Total Premium"]     = "premium_total",
            ["Premium (THB)"]     = "premium_total",
            ["Premium"]           = "premium_total",
            ["PremiumTotal"]      = "premium_total",

            ["Deductible"]        = "excess_amount",
            ["Excess"]            = "excess_amount",
            ["Excess Amount"]     = "excess_amount",
            ["ExcessAmount"]      = "excess_amount",

            ["Coverage"]          = "coverage_details",
            ["Coverage Details"]  = "coverage_details",
            ["CoverageDetails"]   = "coverage_details",
        };
}
