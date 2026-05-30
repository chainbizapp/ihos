using System.Diagnostics;
using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration;
using Ihos.Application.Common.Interfaces;
using Ihos.Application.Providers;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Ihos.Infrastructure.Providers.Viriyah;

/// <summary>
/// Vehicle master importer for Viriyah. Reads <c>db_master_car_master_v2.csv</c>
/// (~13 k rows: carname_code, carname_desc, car_model, car_option, car_cc, …) and writes
/// one <see cref="VehicleModelMapping"/> row per CSV entry that matches a local
/// <see cref="VehicleModel"/>. RawName encodes the Viriyah quote-API triple
/// <c>BRAND|MODEL|SUBMODEL</c> so <see cref="ViriyahVmiQuoteProvider"/> can look up the
/// exact strings Viriyah expects (Constitution Principle III — Mapping-First).
///
/// Until Viriyah exposes a master API this importer reads from a configured file path.
/// In production the path would point to a daily-refreshed export from Viriyah's portal.
/// </summary>
public sealed class ViriyahCsvMasterImporter : IVehicleMasterSyncer
{
    public const string CompanyShortCode = "VIRIYAH";

    /// <summary>Separator used in <c>VehicleModelMapping.RawName</c> for Viriyah rows.</summary>
    public const char Separator = '|';

    private readonly Persistence.ApplicationDbContext _db;
    private readonly ILogger<ViriyahCsvMasterImporter> _logger;
    private readonly ViriyahMasterOptions _options;

    public ViriyahCsvMasterImporter(
        Persistence.ApplicationDbContext db,
        IOptions<ViriyahMasterOptions> options,
        ILogger<ViriyahCsvMasterImporter> logger)
    {
        _db = db;
        _options = options.Value;
        _logger = logger;
    }

    public string ShortCode => CompanyShortCode;

    public async Task<SyncOutcome> SyncAsync(
        SyncTriggerType trigger, Guid? actorUserId, CancellationToken cancellationToken)
    {
        var sw = Stopwatch.StartNew();
        var csvPath = _options.CarMasterCsvPath;

        if (string.IsNullOrWhiteSpace(csvPath) || !File.Exists(csvPath))
        {
            sw.Stop();
            return new SyncOutcome(
                SyncStatus.Failed, 0, 0, 0, 0, sw.ElapsedMilliseconds,
                $"Viriyah car master CSV not found at '{csvPath}'. " +
                "Set Providers:Viriyah:CarMasterCsvPath in configuration.");
        }

        var company = await _db.InsuranceCompanies
            .FirstOrDefaultAsync(c => c.ShortCode == CompanyShortCode, cancellationToken);
        if (company is null)
        {
            sw.Stop();
            return new SyncOutcome(SyncStatus.Failed, 0, 0, 0, 0, sw.ElapsedMilliseconds,
                "VIRIYAH InsuranceCompany row missing.");
        }

        // Index local DB once for O(1) matching during the CSV walk.
        var makes = await _db.VehicleMakes.AsNoTracking()
            .ToDictionaryAsync(m => m.Name.ToUpperInvariant(), m => m.Id, cancellationToken);

        var modelsByMakeId = (await _db.VehicleModels.AsNoTracking()
            .Where(m => !m.IsDeleted)
            .ToListAsync(cancellationToken))
            .GroupBy(m => m.MakeId)
            .ToDictionary(g => g.Key, g => g.ToList());

        // Include soft-deleted rows — the unique constraint on (CompanyId, RawName) does
        // NOT filter on IsDeleted, so we must treat soft-deleted rows as occupying that
        // key. Otherwise insert would collide and abort the entire import.
        var existingMappings = await _db.VehicleModelMappings
            .IgnoreQueryFilters()
            .Where(m => m.CompanyId == company.Id)
            .ToDictionaryAsync(m => m.RawName, m => m, cancellationToken);

        int inserted = 0, updated = 0, errors = 0;
        var seenRawNames = new HashSet<string>();

        using var reader = new StreamReader(csvPath);
        using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HasHeaderRecord = true,
            HeaderValidated = null,
            MissingFieldFound = null,
        });

        await csv.ReadAsync();
        csv.ReadHeader();

        while (await csv.ReadAsync())
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                var brand    = csv.GetField("carname_desc")?.Trim() ?? string.Empty;
                var model    = csv.GetField("car_model")?.Trim() ?? string.Empty;
                var submodel = csv.GetField("car_option")?.Trim() ?? string.Empty;
                var ccText   = csv.GetField("car_cc")?.Trim() ?? string.Empty;

                if (string.IsNullOrEmpty(brand) || string.IsNullOrEmpty(model))
                    continue;

                if (!makes.TryGetValue(brand.ToUpperInvariant(), out var makeId))
                    continue; // Brand not present in local DB — skip silently.

                if (!modelsByMakeId.TryGetValue(makeId, out var candidates))
                    continue;

                // Match by (a) exact model name, (b) compatible engine cc when both sides
                // publish it. SubModel from Viriyah is verbose ("I-VTEC SV (AS) A") and rarely
                // matches local SubModel literally — we treat it as informative only.
                int.TryParse(ccText, NumberStyles.Any, CultureInfo.InvariantCulture, out var cc);
                var match = candidates.FirstOrDefault(m =>
                    string.Equals(m.Name, model, StringComparison.OrdinalIgnoreCase) &&
                    (cc == 0 || string.IsNullOrEmpty(m.EngineCC) ||
                     IsCompatibleCc(m.EngineCC, cc)));
                if (match is null) continue;

                var rawName = $"{brand}{Separator}{model}{Separator}{submodel}";
                if (!seenRawNames.Add(rawName))
                    continue; // CSV duplicate

                if (existingMappings.TryGetValue(rawName, out var existing))
                {
                    var changed = false;
                    // Resurrect soft-deleted rows — the CSV catalog says this mapping
                    // should exist, so we restore it instead of leaving it deleted.
                    if (existing.IsDeleted)
                    {
                        existing.IsDeleted = false;
                        changed = true;
                    }
                    if (existing.CanonicalModelId != match.Id)
                    {
                        existing.CanonicalModelId = match.Id;
                        changed = true;
                    }
                    if (changed) updated++;
                }
                else
                {
                    _db.VehicleModelMappings.Add(new VehicleModelMapping
                    {
                        Id = Guid.NewGuid(),
                        CompanyId = company.Id,
                        RawName = rawName,
                        CanonicalModelId = match.Id,
                        IsAutoSuggested = true,
                    });
                    inserted++;
                }
            }
            catch (Exception ex)
            {
                errors++;
                _logger.LogDebug(ex, "Skipped malformed Viriyah CSV row {Row}", csv.Parser.Row);
            }

            // Flush periodically to keep memory bounded on large files.
            if ((inserted + updated) % 500 == 0 && (inserted + updated) > 0)
            {
                await _db.SaveChangesAsync(cancellationToken);
            }
        }

        await _db.SaveChangesAsync(cancellationToken);
        sw.Stop();

        var status = errors == 0
            ? SyncStatus.Succeeded
            : (inserted + updated > 0 ? SyncStatus.PartialSuccess : SyncStatus.Failed);

        _logger.LogInformation(
            "Viriyah CSV import done in {Ms} ms — inserted={Inserted} updated={Updated} errors={Errors}",
            sw.ElapsedMilliseconds, inserted, updated, errors);

        return new SyncOutcome(status, inserted, updated, 0, errors, sw.ElapsedMilliseconds,
            errors > 0 ? $"{errors} CSV rows skipped due to parse errors" : null);
    }

    /// <summary>
    /// Engine-cc compatibility check. Local DB stores either litres ("1.5") or cc ("1500"),
    /// Viriyah stores cc as integer. Allow ±50 cc tolerance to absorb rounding.
    /// </summary>
    private static bool IsCompatibleCc(string localCc, int viriyahCc)
    {
        if (!decimal.TryParse(localCc, NumberStyles.Any, CultureInfo.InvariantCulture, out var raw))
            return false;
        var localCcInt = raw < 100m ? (int)Math.Round(raw * 1000m) : (int)Math.Round(raw);
        return Math.Abs(localCcInt - viriyahCc) <= 50;
    }
}

/// <summary>
/// Configuration block for Viriyah master-data import. Bound from
/// <c>Providers:Viriyah:Master</c>.
/// </summary>
public sealed class ViriyahMasterOptions
{
    public const string SectionName = "Providers:Viriyah:Master";

    /// <summary>Absolute path to <c>db_master_car_master_v2.csv</c>.</summary>
    public string CarMasterCsvPath { get; set; } = string.Empty;
}
