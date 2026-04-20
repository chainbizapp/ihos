using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;
using Ihos.Domain.Entities;

namespace Ihos.Application.Import.Commands;

/// <summary>
/// Parses a Viriyah YMM master CSV (db_master_car_master_v2.csv) and reconciles it
/// against our vehicle_makes + vehicle_models tables.
///
/// For each entry in the master file the command will:
///   1. Find or create the VehicleMake
///   2. Find or create the VehicleModel
///   3. Find or create a VehicleModelMapping (carname_code → canonical model)
///
/// Returns a structured report of what was created vs what already existed.
/// </summary>
public record SyncVehicleMasterCommand(
    Guid   CompanyId,
    Stream FileStream
) : IRequest<VehicleMasterSyncResult>;

// ── Result DTOs ──────────────────────────────────────────────────────────────

public record SyncedMakeDto(Guid MakeId, string Name, bool IsNew);

public record SyncedModelDto(
    Guid    MakeId,
    string  MakeName,
    Guid    ModelId,
    string  ModelName,
    string? SubModel,
    string? GearType,
    string  CarnameCode,
    bool    IsNewMake,
    bool    IsNewModel,
    bool    IsNewMapping
);

public record VehicleMasterSyncResult
{
    /// <summary>Total rows in the master file.</summary>
    public int TotalRows { get; init; }

    /// <summary>Rows skipped (blank brand/model or parse errors).</summary>
    public int SkippedRows { get; init; }

    /// <summary>New VehicleMake records created.</summary>
    public int NewMakes { get; init; }

    /// <summary>New VehicleModel records created.</summary>
    public int NewModels { get; init; }

    /// <summary>New VehicleModelMapping records created (carname_code → canonical model).</summary>
    public int NewMappings { get; init; }

    /// <summary>Entries that already existed in DB and were not changed.</summary>
    public int AlreadyExisting { get; init; }

    /// <summary>Breakdown by make: new vs existing.</summary>
    public IReadOnlyList<SyncedMakeDto> Makes { get; init; } = [];

    /// <summary>Full per-entry report (carname_code level).</summary>
    public IReadOnlyList<SyncedModelDto> Entries { get; init; } = [];
}

// ── Handler ──────────────────────────────────────────────────────────────────

public class SyncVehicleMasterCommandHandler
    : IRequestHandler<SyncVehicleMasterCommand, VehicleMasterSyncResult>
{
    private readonly IVehicleModelRepository        _vehicles;
    private readonly IVehicleModelMappingRepository _mappings;
    private readonly ICurrentUserService            _currentUser;
    private readonly IVehicleMasterFileParser       _parser;

    public SyncVehicleMasterCommandHandler(
        IVehicleModelRepository        vehicles,
        IVehicleModelMappingRepository mappings,
        ICurrentUserService            currentUser,
        IVehicleMasterFileParser       parser)
    {
        _vehicles    = vehicles;
        _mappings    = mappings;
        _currentUser = currentUser;
        _parser      = parser;
    }

    public async Task<VehicleMasterSyncResult> Handle(
        SyncVehicleMasterCommand request, CancellationToken ct)
    {
        var rows = _parser.Parse(request.FileStream);

        // ── Pre-load entire DB into memory ────────────────────────────────────
        var dbMakes = (await _vehicles.GetAllMakesAsync(ct))
                          .ToDictionary(m => m.Name.ToUpperInvariant());

        var dbModels = (await _vehicles.GetAllAsync(ct))
                           .ToDictionary(
                               m => (m.MakeId, m.Name.ToUpperInvariant(), m.SubModel?.ToUpperInvariant(), m.GearType));

        var existingMappingKeys = (await _mappings.GetByCompanyAsync(request.CompanyId, ct))
                                      .Select(m => m.RawName)
                                      .ToHashSet(StringComparer.Ordinal);

        // ── Phase 1: collect and bulk-insert new VehicleMakes ─────────────────
        var newMakeByKey = new Dictionary<string, VehicleMake>(StringComparer.OrdinalIgnoreCase);
        int skipped = 0;

        foreach (var row in rows)
        {
            if (string.IsNullOrWhiteSpace(row.Brand) || string.IsNullOrWhiteSpace(row.CarModel))
            { skipped++; continue; }

            var key = row.Brand.ToUpperInvariant();
            if (!dbMakes.ContainsKey(key) && !newMakeByKey.ContainsKey(key))
            {
                newMakeByKey[key] = new VehicleMake
                {
                    Name      = TitleCase(row.Brand),
                    CreatedBy = _currentUser.UserId
                };
            }
        }

        if (newMakeByKey.Count > 0)
        {
            await _vehicles.AddMakesAsync(newMakeByKey.Values, ct);
            await _vehicles.SaveChangesAsync(ct);            // ← SaveChanges #1
            foreach (var (k, make) in newMakeByKey)
                dbMakes[k] = make;
        }

        // ── Phase 2: collect and bulk-insert new VehicleModels ───────────────
        var newModelByKey = new Dictionary<(Guid, string, string?, string?), VehicleModel>();

        foreach (var row in rows)
        {
            if (string.IsNullOrWhiteSpace(row.Brand) || string.IsNullOrWhiteSpace(row.CarModel))
                continue;

            if (!dbMakes.TryGetValue(row.Brand.ToUpperInvariant(), out var make)) continue;

            var modelName = TitleCase(row.CarModel);
            var (subModel, gearType) = ParseVariant(row.CarOption);
            var key       = (make.Id, modelName.ToUpperInvariant(), subModel?.ToUpperInvariant(), gearType);

            if (!dbModels.ContainsKey(key) && !newModelByKey.ContainsKey(key))
            {
                newModelByKey[key] = new VehicleModel
                {
                    MakeId    = make.Id,
                    Name      = modelName,
                    SubModel  = subModel,
                    GearType  = gearType,
                    CreatedBy = _currentUser.UserId
                };
            }
        }

        if (newModelByKey.Count > 0)
        {
            await _vehicles.AddModelsAsync(newModelByKey.Values, ct);
            await _vehicles.SaveChangesAsync(ct);            // ← SaveChanges #2
            foreach (var (k, model) in newModelByKey)
                dbModels[k] = model;
        }

        // ── Phase 3: collect and bulk-insert new VehicleModelMappings ────────
        var newMappings = new List<VehicleModelMapping>();

        foreach (var row in rows)
        {
            if (string.IsNullOrWhiteSpace(row.Brand) || string.IsNullOrWhiteSpace(row.CarModel))
                continue;

            if (!dbMakes.TryGetValue(row.Brand.ToUpperInvariant(), out var make)) continue;

            var modelName = TitleCase(row.CarModel);
            var (subModel, gearType) = ParseVariant(row.CarOption);
            var modelKey  = (make.Id, modelName.ToUpperInvariant(), subModel?.ToUpperInvariant(), gearType);

            if (!dbModels.TryGetValue(modelKey, out var model)) continue;

            if (!existingMappingKeys.Contains(row.CarnameCode))
            {
                newMappings.Add(new VehicleModelMapping
                {
                    CompanyId        = request.CompanyId,
                    RawName          = row.CarnameCode,
                    CanonicalModelId = model.Id,
                    CreatedBy        = _currentUser.UserId
                });
                existingMappingKeys.Add(row.CarnameCode);    // deduplicate within file
            }
        }

        if (newMappings.Count > 0)
        {
            await _mappings.AddRangeAsync(newMappings, ct);
            await _mappings.SaveChangesAsync(ct);            // ← SaveChanges #3
        }

        // ── Build result report ───────────────────────────────────────────────
        var newMakeIds    = newMakeByKey.Values.Select(m => m.Id).ToHashSet();
        var newModelIds   = newModelByKey.Values.Select(m => m.Id).ToHashSet();
        var newMappingSet = newMappings.Select(m => m.RawName).ToHashSet(StringComparer.Ordinal);

        var entries = new List<SyncedModelDto>();

        foreach (var row in rows)
        {
            if (string.IsNullOrWhiteSpace(row.Brand) || string.IsNullOrWhiteSpace(row.CarModel))
                continue;

            if (!dbMakes.TryGetValue(row.Brand.ToUpperInvariant(), out var make)) continue;

            var modelName = TitleCase(row.CarModel);
            var (subModel, gearType) = ParseVariant(row.CarOption);

            if (!dbModels.TryGetValue((make.Id, modelName.ToUpperInvariant(), subModel?.ToUpperInvariant(), gearType), out var model))
                continue;

            entries.Add(new SyncedModelDto(
                MakeId      : make.Id,
                MakeName    : make.Name,
                ModelId     : model.Id,
                ModelName   : model.Name,
                SubModel    : model.SubModel,
                GearType    : model.GearType,
                CarnameCode : row.CarnameCode,
                IsNewMake   : newMakeIds.Contains(make.Id),
                IsNewModel  : newModelIds.Contains(model.Id),
                IsNewMapping: newMappingSet.Contains(row.CarnameCode)
            ));
        }

        int existing = entries.Count(e => !e.IsNewMake && !e.IsNewModel && !e.IsNewMapping);

        var makeSummary = entries
            .GroupBy(e => new { e.MakeId, e.MakeName })
            .Select(g => new SyncedMakeDto(g.Key.MakeId, g.Key.MakeName, g.Any(e => e.IsNewMake)))
            .OrderBy(m => m.Name)
            .ToList();

        return new VehicleMasterSyncResult
        {
            TotalRows       = rows.Count,
            SkippedRows     = skipped,
            NewMakes        = newMakeByKey.Count,
            NewModels       = newModelByKey.Count,
            NewMappings     = newMappings.Count,
            AlreadyExisting = existing,
            Makes           = makeSummary,
            Entries         = entries
        };
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Normalizes brand/model strings from Viriyah (all-uppercase) to title case.
    /// Keeps short words (≤3 chars) and words containing digits fully uppercase.
    /// Examples: "TOYOTA" → "Toyota", "BMW" → "BMW", "BZ4X" → "BZ4X",
    ///           "MERCEDES-BENZ" → "Mercedes-Benz", "CR-V" → "CR-V",
    ///           "2 (ALL NEW)" → "2 (All New)"
    /// </summary>
    private static string TitleCase(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return input.Trim();

        // Split into tokens (words and non-word separators)
        var result = System.Text.RegularExpressions.Regex.Replace(
            input.Trim(),
            @"\b([A-Za-z0-9]+)\b",
            m =>
            {
                var word = m.Value;
                // Keep fully uppercase if short or contains digits (e.g. BZ4X, CR, V, 4WD)
                if (word.Length <= 3 || word.Any(char.IsDigit))
                    return word.ToUpperInvariant();
                // Standard title case for longer words
                return char.ToUpperInvariant(word[0]) + word[1..].ToLowerInvariant();
            });
        return result;
    }

    /// <summary>
    /// Parses the raw car option to extract submodel and gear type.
    /// E.g. "J TRD SPORTIVO A" -> ("J TRD SPORTIVO", "Automatic")
    /// </summary>
    private static (string? SubModel, string? GearType) ParseVariant(string? carOption)
    {
        if (string.IsNullOrWhiteSpace(carOption)) return (null, null);
        var parts = carOption.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        
        if (parts.Length > 1)
        {
            var last = parts[^1].ToUpperInvariant();
            if (last == "A" || last == "M")
            {
                var gearType = last == "A" ? "Automatic" : "Manual";
                var subModel = string.Join(" ", parts[..^1]);
                return (subModel, gearType);
            }
        }
        return (carOption.Trim(), null);
    }
}
