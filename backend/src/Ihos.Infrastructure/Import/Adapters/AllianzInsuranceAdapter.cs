using ClosedXML.Excel;
using Ihos.Application.Import.Adapters;
using Ihos.Application.Import.Services;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Ihos.Infrastructure.Import.Adapters;

/// <summary>
/// Adapter for Allianz Ayudhya General Insurance (AAGI).
///
/// Supported file: Premium table Type1 Excel export (*.xlsx).
///
/// File layout (single sheet "Premium Non Type 1", flat format — no separate YMM file):
///   PACKAGE_ID, PACKAGE_NAME, COVER_TYPE, BRAND, BRAND_NAME, MODEL, MODEL_NAME,
///   MODEL_YEAR, USAGE, REGION_GROUP, GARAGE_TYPE, OD, DD, FL,
///   TPBI_PERSON, TPBI_ACCIDENT, TPPD, PA, ME, BB,
///   NET_PREMIUM, VAT, STAMP, GROSS_TOTAL,
///   ROADSIDE_ASSISTANCE, SEAT, FUEL_TYPE, WALL_CHARGE, Funeral, Theft, HIB
///
/// Mapping notes:
///   vehicle_model  = BRAND_NAME + " " + MODEL_NAME  (e.g. "DENZA D9")
///   min_year       = max_year = MODEL_YEAR           (single-year rows, no range)
///   sum_insured    = OD                              (Own Damage coverage limit)
///   excess_amount  = DD                              (deductible)
///   premium_total  = GROSS_TOTAL                     (net + VAT + stamp duty)
///
///   COVER_TYPE → plan_type
///     VMI1  → Type1
///     VMI2  → Type2
///     VMI3  → Type3
///     VMI2P → Type2Plus
///     VMI3P → Type3Plus
///
///   GARAGE_TYPE → repair_type
///     DEALER → Dealer
///     GARAGE → Garage   (catch-all)
///
///   coverage_details stores all remaining columns (package_id, region_group, usage,
///   fuel_type, FL, TPBI_PERSON, TPBI_ACCIDENT, TPPD, PA, ME, BB, WALL_CHARGE,
///   NET_PREMIUM, VAT, STAMP, ROADSIDE_ASSISTANCE, SEAT, Funeral, Theft, HIB).
/// </summary>
public sealed class AllianzInsuranceAdapter : ICompanyImportAdapter
{
    // 11111111-0000-0000-0000-000000000004 (AAGI seed ID)
    public Guid   CompanyId   => new("11111111-0000-0000-0000-000000000004");
    public string CompanyName => "Allianz Ayudhya General Insurance";
    public IReadOnlyList<string> SupportedExtensions => [".xlsx", ".xls"];

    // Required columns that identify a valid Allianz pricing file.
    private static readonly string[] RequiredColumns =
        ["PACKAGE_ID", "COVER_TYPE", "BRAND_NAME", "MODEL_NAME", "MODEL_YEAR",
         "GARAGE_TYPE", "OD", "DD", "GROSS_TOTAL"];

    public Task<AdapterParseResult> ParseAsync(Stream stream, string fileName, CancellationToken ct = default)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        if (!SupportedExtensions.Contains(ext))
            return Task.FromResult(AdapterParseResult.Fail(
                $"'{CompanyName}' adapter does not support '{ext}'. Expected .xlsx or .xls."));

        try
        {
            using var workbook = new XLWorkbook(stream);
            var ws      = workbook.Worksheets.First();
            var lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;
            var lastCol = ws.LastColumnUsed()?.ColumnNumber() ?? 1;

            if (lastRow < 2)
                return Task.FromResult(AdapterParseResult.Fail("Worksheet has no data rows."));

            // Build header → column-index lookup (case-insensitive)
            var colIndex = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            for (int c = 1; c <= lastCol; c++)
            {
                var header = ws.Cell(1, c).GetString().Trim();
                if (!string.IsNullOrEmpty(header) && !colIndex.ContainsKey(header))
                    colIndex[header] = c;
            }

            // Validate required columns
            var missing = RequiredColumns.Where(col => !colIndex.ContainsKey(col)).ToList();
            if (missing.Count > 0)
                return Task.FromResult(AdapterParseResult.Fail(
                    $"File '{fileName}' does not appear to be an Allianz AAGI pricing file. " +
                    $"Missing required columns: {string.Join(", ", missing)}."));

            string GetCell(int row, string col)
            {
                if (!colIndex.TryGetValue(col, out var c)) return string.Empty;
                return ws.Cell(row, c).GetString().Trim();
            }

            // Extract the pricing effective year from the filename so we can convert
            // MODEL_YEAR (ปี ค.ศ.) into vehicle age (in years), matching the storage
            // convention used by all other company adapters.
            // Filename pattern: "... (20260401) ..." → yyyyMMdd → year 2026.
            var pricingYear = ExtractPricingYear(fileName);

            var rows   = new List<NormalizedPlanRow>();
            var errors = new List<ParseError>();

            for (int r = 2; r <= lastRow; r++)
            {
                // Skip entirely blank rows
                if (Enumerable.Range(1, lastCol)
                    .All(c => string.IsNullOrWhiteSpace(ws.Cell(r, c).GetString())))
                    continue;

                var row = MapRow(r, col => GetCell(r, col), pricingYear, errors);
                if (row != null) rows.Add(row);
            }

            return errors.Count > 0
                ? Task.FromResult(AdapterParseResult.Fail(errors))
                : Task.FromResult(AdapterParseResult.Ok(rows));
        }
        catch (Exception ex)
        {
            return Task.FromResult(AdapterParseResult.Fail($"Failed to parse Excel file: {ex.Message}"));
        }
    }

    // ── row mapping ───────────────────────────────────────────────────────────

    private static NormalizedPlanRow? MapRow(
        int rowNum,
        Func<string, string> get,
        int pricingYear,
        List<ParseError> errors)
    {
        var packageId = get("PACKAGE_ID").Trim();
        var brandName = get("BRAND_NAME").Trim();
        var modelName = get("MODEL_NAME").Trim();

        if (string.IsNullOrWhiteSpace(packageId))
        {
            errors.Add(new ParseError(rowNum, "PACKAGE_ID", "PACKAGE_ID is empty."));
            return null;
        }

        // Use MODEL_NAME alone as the raw vehicle model key (e.g. "D9", not "DENZA D9").
        //
        // Rationale: VehicleModelMapping is resolved by comparing rawVehicleModel against
        // VehicleModel.Name (which stores just the model name, not the make).
        // Using "BRAND_NAME MODEL_NAME" would create a Levenshtein distance of ~6 against
        // "D9", far exceeding the auto-suggest threshold of 2 and leaving every row unresolved.
        // Using just MODEL_NAME ("D9") gives distance 0 → instant auto-suggest once the
        // canonical VehicleModel exists in the database.
        //
        // BRAND_NAME is preserved in coverage_details.brand_name so admins can see it
        // during the mapping review and during vehicle model creation.
        if (string.IsNullOrWhiteSpace(modelName))
        {
            errors.Add(new ParseError(rowNum, "MODEL_NAME", "MODEL_NAME is empty."));
            return null;
        }

        var rawVehicleModel = modelName;

        // Parse MODEL_NAME to extract sub-components used as hints in the mapping dialog.
        // Pattern: "<ModelRoot> <X.X> <BodyVariant>"
        // e.g. "BT-50 2.2 2 Doors" → root="BT-50", cc="2.2", variant="2 Doors"
        // e.g. "D9"                 → root="D9",    cc=null,  variant=null
        var (parsedModelRoot, parsedEngineCC, parsedVariant) = ParseModelName(modelName);

        var coverType  = get("COVER_TYPE").Trim();
        var planType   = MapCoverType(coverType);
        var repairType = MapGarageType(get("GARAGE_TYPE"));
        var od         = get("OD").Trim();
        var dd         = get("DD").Trim();
        var grossTotal = get("GROSS_TOTAL").Trim();

        // MODEL_YEAR is the vehicle registration year (absolute calendar year, e.g. 2025).
        // Store it directly as RegistrationYear — no age conversion needed.
        var modelYearStr = get("MODEL_YEAR").Trim();

        // Build coverage_details: all supplementary columns retained for downstream use.
        // parsed_model_root / parsed_engine_cc / parsed_variant are hints shown to admins
        // in the mapping dialog so they know which EngineCC to set on the canonical model.
        var coverageDetails = JsonSerializer.Serialize(new
        {
            package_id          = packageId,
            brand_name          = brandName,   // BRAND_NAME kept here for admin context
            parsed_model_root   = parsedModelRoot,
            parsed_engine_cc    = parsedEngineCC,
            parsed_variant      = parsedVariant,
            model_year          = modelYearStr,
            region_group        = get("REGION_GROUP"),
            usage               = get("USAGE"),
            fuel_type           = get("FUEL_TYPE"),
            seat                = get("SEAT"),
            fl                  = get("FL"),
            tpbi_person         = get("TPBI_PERSON"),
            tpbi_accident       = get("TPBI_ACCIDENT"),
            tppd                = get("TPPD"),
            pa                  = get("PA"),
            me                  = get("ME"),
            bb                  = get("BB"),
            wall_charge         = get("WALL_CHARGE"),
            net_premium         = get("NET_PREMIUM"),
            vat                 = get("VAT"),
            stamp               = get("STAMP"),
            roadside_assistance = get("ROADSIDE_ASSISTANCE"),
            funeral             = get("Funeral"),
            theft               = get("Theft"),
            hib                 = get("HIB")
        });

        return new NormalizedPlanRow(
            RawVehicleModel   : rawVehicleModel,
            RawPlanType       : planType,
            RepairType        : repairType,
            RegistrationYear  : modelYearStr,
            SumInsured        : od,
            PremiumTotal      : grossTotal,
            ExcessAmount      : dd,
            CoverageDetails   : coverageDetails,
            RegionGroup       : get("REGION_GROUP").Trim(),
            ExternalPackageId : packageId,
            TpbiPerPerson     : get("TPBI_PERSON"),
            TpbiPerAccident   : get("TPBI_ACCIDENT"),
            Tppd              : get("TPPD"),
            FireTheft         : get("FL"),       // FL = fire/theft loss
            PersonalAccident  : get("PA"),       // personal accident (driver)
            MedicalExpenses   : get("ME"),
            BailBond          : get("BB")
        );
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Parses an Allianz MODEL_NAME string into (modelRoot, engineCC, bodyVariant).
    ///
    /// Pattern: "&lt;ModelRoot&gt; &lt;X.X&gt; &lt;BodyVariant&gt;"
    ///   "BT-50 2.2 2 Doors"     → ("BT-50",     "2.2", "2 Doors")
    ///   "BT-50 PRO 2.2 2 Doors" → ("BT-50 PRO", "2.2", "2 Doors")
    ///   "D9"                    → ("D9",         null,  null)
    ///
    /// The first \d+\.\d+ token is treated as engine CC; everything before it is the
    /// model root (sub-model); everything after is the body variant descriptor.
    /// </summary>
    private static readonly Regex _ccPattern =
        new(@"^(.*?)\s+(\d+\.\d+)(?:\s+(.+))?$", RegexOptions.Compiled);

    private static (string ModelRoot, string? EngineCC, string? Variant) ParseModelName(string modelName)
    {
        var m = _ccPattern.Match(modelName.Trim());
        if (!m.Success) return (modelName.Trim(), null, null);

        // Convert litre notation (e.g. "2.8") to actual CC ("2800") so the value is
        // consistent with Viriyah's master file which stores integer cc values.
        var litre = m.Groups[2].Value;
        var engineCC = decimal.TryParse(litre, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var litreVal)
            ? ((int)(litreVal * 1000)).ToString()
            : litre;

        return (
            ModelRoot: m.Groups[1].Value.Trim(),
            EngineCC : engineCC,
            Variant  : m.Groups[3].Success ? m.Groups[3].Value.Trim() : null
        );
    }

    /// <summary>
    /// Extracts the pricing effective year from the filename.
    /// Allianz filenames embed an 8-digit date in parentheses, e.g.:
    ///   "Premium table Type1 for AAGI _ PRODUCTION (20260401) (EV).xlsx"
    ///   → matches "(20260401)" → returns 2026.
    /// Falls back to the current year if the pattern is not found.
    /// </summary>
    private static int ExtractPricingYear(string fileName)
    {
        var match = Regex.Match(fileName, @"\((\d{8})\)");
        if (match.Success
            && int.TryParse(match.Groups[1].Value[..4], out var year)
            && year > 2000 && year < 2100)
            return year;

        return DateTime.UtcNow.Year;
    }

    // ── lookup helpers ────────────────────────────────────────────────────────

    /// <summary>
    /// Maps Allianz COVER_TYPE codes to canonical PlanType names.
    /// VMI1 → Type1, VMI2 → Type2, VMI3 → Type3,
    /// VMI2P / VMI2+ → Type2Plus, VMI3P / VMI3+ → Type3Plus.
    /// Unknown codes are passed through so the mapping resolver can handle them.
    /// </summary>
    private static string MapCoverType(string raw) =>
        raw.ToUpperInvariant() switch
        {
            "VMI1"           => "Type1",
            "VMI2"           => "Type2",
            "VMI3"           => "Type3",
            "VMI2P" or "VMI2+" => "Type2Plus",
            "VMI3P" or "VMI3+" => "Type3Plus",
            _                => raw
        };

    /// <summary>
    /// Maps Allianz GARAGE_TYPE to canonical RepairType.
    /// DEALER → Dealer (authorized service center),
    /// GARAGE or anything else → Garage (general workshop).
    /// </summary>
    private static string MapGarageType(string raw) =>
        raw.Trim().ToUpperInvariant() switch
        {
            "DEALER" => "Dealer",
            _        => "Garage"
        };
}
