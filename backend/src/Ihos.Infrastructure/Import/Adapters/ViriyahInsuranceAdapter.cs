using ClosedXML.Excel;
using CsvHelper;
using CsvHelper.Configuration;
using Ihos.Application.Import.Adapters;
using Ihos.Application.Import.Services;
using System.Globalization;
using System.Text.Json;

namespace Ihos.Infrastructure.Import.Adapters;

/// <summary>
/// Adapter for Viriyah Insurance (VRI).
///
/// Supported files (all share the same column schema):
///   *.csv   — e.g. viriyah.csv, X37 report_list_car_and_package_table_package_common.csv
///   *.xlsx  — e.g. BX8 TOYOTA.xlsx
///
/// Column schema (actual Viriyah export format):
///   carname_code, brand, model, submodel, registration_year,
///   insure_type, flag_repair_type, sum_insured, deduct, total,
///   car_age, rate_code, rate_fname, ...
///
/// Note: db_master_car_master_v2.csv is a vehicle master file (no pricing columns).
///       This adapter will reject it with a clear error message.
///
/// insure_type → PlanType
///   1 → Type1   (ประเภท 1 / Comprehensive)
///   2 → Type2
///   3 → Type3
///   4 → Type3Plus
///   5 → Type2Plus  (Viriyah "ประเภท 5 (2+)")
///
/// flag_repair_type → RepairType
///   N → Garage
///   Y → Dealer
/// </summary>
public sealed class ViriyahInsuranceAdapter : ICompanyImportAdapter
{
    // 11111111-0000-0000-0000-000000000003 (VRI seed ID)
    public Guid   CompanyId    => new("11111111-0000-0000-0000-000000000003");
    public string CompanyName  => "Viriyah Insurance";
    public IReadOnlyList<string> SupportedExtensions => [".csv", ".xlsx", ".xls"];

    // Required columns that distinguish a pricing file from a master/reference file
    private static readonly string[] RequiredPricingColumns =
        ["insure_type", "flag_repair_type", "total", "car_age"];

    public Task<AdapterParseResult> ParseAsync(Stream stream, string fileName, CancellationToken ct = default)
    {
        if (fileName.Equals("db_master_car_master_v2.csv", StringComparison.OrdinalIgnoreCase))
        {
            return Task.FromResult(AdapterParseResult.Fail(
                $"File '{fileName}' is a vehicle master file and cannot be imported as pricing data. " +
                "Vehicle master files (db_master_car_master_v2.csv) are not pricing imports. " +
                "Please use the Vehicle Database Sync tool instead."));
        }

        var ext = Path.GetExtension(fileName).ToLowerInvariant();

        return ext switch
        {
            ".csv"         => Task.FromResult(ParseCsv(stream, fileName)),
            ".xlsx" or ".xls" => Task.FromResult(ParseExcel(stream, fileName)),
            _ => Task.FromResult(AdapterParseResult.Fail(
                    $"'{CompanyName}' adapter does not support '{ext}'. Expected .csv, .xlsx, or .xls."))
        };
    }

    // ── CSV ─────────────────────────────────────────────────────────────────

    private AdapterParseResult ParseCsv(Stream stream, string fileName)
    {
        try
        {
            var config = new CsvConfiguration(CultureInfo.InvariantCulture)
            {
                HeaderValidated  = null,
                MissingFieldFound = null,
                BadDataFound     = _ => { }
            };

            using var reader = new StreamReader(stream, leaveOpen: true);
            using var csv    = new CsvReader(reader, config);

            csv.Read();
            csv.ReadHeader();
            var headers = csv.HeaderRecord ?? [];

            var missing = RequiredPricingColumns
                .Where(c => !headers.Contains(c, StringComparer.OrdinalIgnoreCase))
                .ToList();

            if (missing.Count > 0)
                return AdapterParseResult.Fail(
                    $"File '{fileName}' does not appear to be a Viriyah pricing file. " +
                    $"Missing required columns: {string.Join(", ", missing)}. " +
                    "Vehicle master files (db_master_car_master_v2.csv) are not pricing imports.");

            var rows   = new List<NormalizedPlanRow>();
            var errors = new List<ParseError>();
            int rowNum = 1;

            while (csv.Read())
            {
                rowNum++;
                string Get(string col) => csv.GetField(col) ?? string.Empty;

                var row = MapRow(rowNum, Get, errors);
                if (row != null) rows.Add(row);
            }

            return errors.Count > 0
                ? AdapterParseResult.Fail(errors)
                : AdapterParseResult.Ok(rows);
        }
        catch (Exception ex)
        {
            return AdapterParseResult.Fail($"Failed to parse CSV file: {ex.Message}");
        }
    }

    // ── Excel ────────────────────────────────────────────────────────────────

    private AdapterParseResult ParseExcel(Stream stream, string fileName)
    {
        try
        {
            using var workbook = new XLWorkbook(stream);
            var ws      = workbook.Worksheets.First();
            var lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;
            var lastCol = ws.LastColumnUsed()?.ColumnNumber() ?? 1;

            if (lastRow < 2)
                return AdapterParseResult.Fail("Worksheet has no data rows.");

            // Build header index (col number → header name, case-insensitive)
            var headers = Enumerable.Range(1, lastCol)
                .ToDictionary(c => c, c => ws.Cell(1, c).GetString().Trim(), EqualityComparer<int>.Default);

            // Validate required columns exist
            var headerSet = headers.Values.ToHashSet(StringComparer.OrdinalIgnoreCase);
            var missing   = RequiredPricingColumns.Where(c => !headerSet.Contains(c)).ToList();
            if (missing.Count > 0)
                return AdapterParseResult.Fail(
                    $"File '{fileName}' does not appear to be a Viriyah pricing file. " +
                    $"Missing required columns: {string.Join(", ", missing)}. " +
                    "Vehicle master files (db_master_car_master_v2.csv) are not pricing imports.");

            // Build reverse lookup: canonical header name → column index
            var colIndex = headers
                .ToDictionary(kv => kv.Value, kv => kv.Key, StringComparer.OrdinalIgnoreCase);

            string GetCell(int row, string col)
            {
                if (!colIndex.TryGetValue(col, out var c)) return string.Empty;
                return ws.Cell(row, c).GetString().Trim();
            }

            var rows   = new List<NormalizedPlanRow>();
            var errors = new List<ParseError>();

            for (int r = 2; r <= lastRow; r++)
            {
                // Skip blank rows
                if (Enumerable.Range(1, lastCol).All(c => string.IsNullOrWhiteSpace(ws.Cell(r, c).GetString())))
                    continue;

                var row = MapRow(r, col => GetCell(r, col), errors);
                if (row != null) rows.Add(row);
            }

            return errors.Count > 0
                ? AdapterParseResult.Fail(errors)
                : AdapterParseResult.Ok(rows);
        }
        catch (Exception ex)
        {
            return AdapterParseResult.Fail($"Failed to parse Excel file: {ex.Message}");
        }
    }

    // ── shared row mapping ───────────────────────────────────────────────────

    private static NormalizedPlanRow? MapRow(
        int rowNum,
        Func<string, string> get,
        List<ParseError> errors)
    {
        var carnameCode = get("carname_code").Trim();
        var brand       = get("brand").Trim().ToUpperInvariant();
        var model       = get("model").Trim();
        var rawSubmodel = get("submodel").Trim();
        var submodel = rawSubmodel;
        string? gearType = null;

        var parts = rawSubmodel.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length > 1)
        {
            var last = parts[^1].ToUpperInvariant();
            if (last == "A" || last == "M")
            {
                gearType = last == "A" ? "Automatic" : "Manual";
                submodel = string.Join(" ", parts[..^1]);
            }
        }

        if (string.IsNullOrWhiteSpace(carnameCode))
        {
            errors.Add(new ParseError(rowNum, "carname_code", "carname_code is empty — cannot resolve vehicle mapping."));
            return null;
        }

        // Use carname_code as the raw vehicle model key.
        // The YMM sync (SyncVehicleMasterCommand) creates VehicleModelMapping entries
        // with raw_value = carname_code, so the mapping resolver will find a match here.
        var rawVehicleModel = carnameCode;

        var rawPlanType = MapInsureType(get("insure_type"));
        var repairType  = MapRepairType(get("flag_repair_type"));
        var carAge      = get("car_age");
        var sumInsured  = get("sum_insured");
        var premium     = get("total");
        var deduct      = get("deduct");
        var rateCode    = get("rate_code");
        var rateFname   = get("rate_fname");
        var regYear     = get("registration_year");

        // Structured coverage limits — Viriyah column names
        var tpbiPerson   = get("tpbi_person_sumstd");
        var tpbiAccident = get("tpbi_time_sumstd");
        var tppd         = get("tppd_time_sumstd");
        var tppdDeduct   = get("tppd_deduct");           // excess on 3rd-party property damage
        var fireTheft    = get("fire_theft");
        var drvPA        = get("drv_sum_insured");       // driver personal accident
        var psgPA        = get("psg_sum_insured");       // passenger personal accident (per person)
        var psgPermDisable  = get("psg_perm_disable");   // passenger permanent disability
        var psgCompensate   = get("psg_compensate");     // passenger income compensation
        var psgTempDisable  = get("psg_temp_disable");   // passenger temporary disability
        var drvCompensate   = get("drv_compensate");     // driver income compensation
        var medicalExpenses = get("me_sum_insured_std"); // medical expenses (per person)
        var bailBond        = get("bb_sumstd");          // bail bond / ประกันตัวผู้ขับขี่

        // Passenger accident: prefer psg_sum_insured; fall back to psg_perm_disable
        var passengerAccident = string.IsNullOrWhiteSpace(psgPA) ? psgPermDisable : psgPA;

        // Build coverage_details JSON with Viriyah-specific metadata and
        // all supplementary fields that have no dedicated DB column
        var coverageJson = JsonSerializer.Serialize(new
        {
            carname_code       = carnameCode,
            brand              = brand,
            model              = model,
            submodel           = submodel,
            gear_type          = gearType,
            registration_year  = regYear,
            rate_code          = rateCode,
            rate_name          = rateFname,
            tppd_deduct        = tppdDeduct,
            psg_perm_disable   = psgPermDisable,
            psg_compensate     = psgCompensate,
            psg_temp_disable   = psgTempDisable,
            drv_compensate     = drvCompensate
        });

        return new NormalizedPlanRow(
            RawVehicleModel   : rawVehicleModel,
            RawPlanType       : rawPlanType,
            RepairType        : repairType,
            MinYear           : carAge,
            MaxYear           : carAge,
            SumInsured        : sumInsured,
            PremiumTotal      : premium,
            ExcessAmount      : deduct,
            CoverageDetails   : coverageJson,
            // rate_code uniquely identifies a Viriyah pricing package.
            // Including it in the unique key ensures that different packages
            // for the same vehicle/plan/age/sumInsured are stored as separate plans.
            ExternalPackageId : rateCode,
            TpbiPerPerson     : tpbiPerson,
            TpbiPerAccident   : tpbiAccident,
            Tppd              : tppd,
            FireTheft         : fireTheft,
            PersonalAccident  : drvPA,
            PassengerAccident : passengerAccident,
            MedicalExpenses   : medicalExpenses,
            BailBond          : bailBond
        );
    }

    // ── lookup helpers ───────────────────────────────────────────────────────

    /// <summary>
    /// Maps Viriyah's insure_type numeric code to our PlanType enum name.
    /// Viriyah codes: 1=Type1, 2=Type2, 3=Type3, 4=Type3Plus, 5=Type2Plus
    /// </summary>
    private static string MapInsureType(string raw) => raw.Trim() switch
    {
        "1" => "Type1",
        "2" => "Type2",
        "3" => "Type3",
        "4" => "Type3Plus",
        "5" => "Type2Plus",
        _   => raw   // pass through for mapping resolver to handle
    };

    /// <summary>
    /// Maps Viriyah's flag_repair_type to our RepairType enum name.
    /// N = Garage (general workshop), Y = Dealer (authorized service center)
    /// </summary>
    private static string MapRepairType(string raw) => raw.Trim().ToUpperInvariant() switch
    {
        "Y" => "Dealer",
        _   => "Garage"   // N or anything else → Garage
    };
}
