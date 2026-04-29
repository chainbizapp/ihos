using ClosedXML.Excel;
using Ihos.Application.Import.Adapters;
using Ihos.Application.Import.Services;

namespace Ihos.Infrastructure.Import.Adapters;

/// <summary>
/// Base class for Excel-based company adapters.
/// Subclasses declare a ColumnMap (raw header → canonical key) and the base
/// class handles parsing, blank-row skipping, and field normalization.
/// </summary>
public abstract class ExcelCompanyAdapterBase : ICompanyImportAdapter
{
    public abstract Guid CompanyId { get; }
    public abstract string CompanyName { get; }
    public virtual IReadOnlyList<string> SupportedExtensions => [".xlsx", ".xls"];

    /// <summary>
    /// Maps each company-specific column header to a canonical key.
    /// Keys are matched case-insensitively.
    /// Canonical keys: vehicle_model, plan_type, repair_type,
    ///                 min_year, max_year, sum_insured, premium_total,
    ///                 excess_amount, coverage_details
    /// </summary>
    protected abstract IReadOnlyDictionary<string, string> ColumnMap { get; }

    public Task<AdapterParseResult> ParseAsync(Stream stream, string fileName, CancellationToken ct = default)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        if (!SupportedExtensions.Contains(ext))
            return Task.FromResult(AdapterParseResult.Fail(
                $"Company '{CompanyName}' adapter does not support '{ext}' files. " +
                $"Supported formats: {string.Join(", ", SupportedExtensions)}."));

        try
        {
            using var workbook = new XLWorkbook(stream);
            var ws = workbook.Worksheets.First();
            var lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;
            var lastCol = ws.LastColumnUsed()?.ColumnNumber() ?? 1;

            if (lastRow < 2)
                return Task.FromResult(AdapterParseResult.Fail("Worksheet has no data rows."));

            // Build header list (row 1)
            var headers = Enumerable.Range(1, lastCol)
                .Select(c => ws.Cell(1, c).GetString().Trim())
                .Select((h, i) => string.IsNullOrEmpty(h) ? $"Column{i + 1}" : h)
                .ToList();

            var rows = new List<NormalizedPlanRow>();
            var errors = new List<ParseError>();

            for (int r = 2; r <= lastRow; r++)
            {
                // Skip entirely blank rows
                if (Enumerable.Range(1, lastCol).All(c => string.IsNullOrWhiteSpace(ws.Cell(r, c).GetString())))
                    continue;

                // Build raw dict using original headers
                var raw = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                for (int c = 1; c <= lastCol; c++)
                    raw[headers[c - 1]] = ws.Cell(r, c).GetString().Trim();

                // Apply column map → canonical dict
                var canonical = ApplyColumnMap(raw);

                var row = ExtractRow(canonical);
                if (row == null)
                {
                    errors.Add(new ParseError(r, "vehicle_model", "Could not map required fields from row."));
                    continue;
                }

                rows.Add(row);
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

    // ── helpers ──────────────────────────────────────────────────────────────

    private Dictionary<string, string> ApplyColumnMap(Dictionary<string, string> raw)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (key, value) in raw)
        {
            var canonicalKey = ColumnMap.FirstOrDefault(
                kv => kv.Key.Equals(key, StringComparison.OrdinalIgnoreCase)).Value ?? key;
            result[canonicalKey] = value;
        }
        return result;
    }

    private static NormalizedPlanRow? ExtractRow(Dictionary<string, string> d)
    {
        var vehicleModel = d.GetValueOrDefault("vehicle_model", string.Empty);
        var planType     = d.GetValueOrDefault("plan_type", string.Empty);

        if (string.IsNullOrWhiteSpace(vehicleModel) && string.IsNullOrWhiteSpace(planType))
            return null;

        return new NormalizedPlanRow(
            RawVehicleModel  : vehicleModel,
            RawPlanType      : planType,
            RepairType       : d.GetValueOrDefault("repair_type", "Garage"),
            RegistrationYear : d.GetValueOrDefault("registration_year", "0"),
            SumInsured       : d.GetValueOrDefault("sum_insured", "0"),
            PremiumTotal     : d.GetValueOrDefault("premium_total", "0"),
            ExcessAmount     : d.GetValueOrDefault("excess_amount", "0"),
            CoverageDetails  : d.GetValueOrDefault("coverage_details", "{}")
        );
    }
}
