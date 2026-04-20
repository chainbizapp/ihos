using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;
using System.Text.Json;

namespace Ihos.Application.Import.Commands;

public record PublishImportBatchCommand(Guid BatchId) : IRequest<PublishImportBatchResult>;

public record PublishImportBatchResult(bool Success, string? Error = null, int PlansCreated = 0, int PlansUpdated = 0, List<PublishRecordError>? Errors = null);
public record PublishRecordError(Guid RecordId, int RowNumber, string Reason);

public class PublishImportBatchCommandHandler : IRequestHandler<PublishImportBatchCommand, PublishImportBatchResult>
{
    private readonly IImportBatchRepository _batches;
    private readonly IImportRecordRepository _records;
    private readonly IInsurancePlanRepository _plans;
    private readonly IVehicleModelMappingRepository _vehicleMappings;
    private readonly IAuditLogRepository _audit;
    private readonly ICurrentUserService _currentUser;

    public PublishImportBatchCommandHandler(
        IImportBatchRepository batches,
        IImportRecordRepository records,
        IInsurancePlanRepository plans,
        IVehicleModelMappingRepository vehicleMappings,
        IAuditLogRepository audit,
        ICurrentUserService currentUser)
    {
        _batches = batches;
        _records = records;
        _plans = plans;
        _vehicleMappings = vehicleMappings;
        _audit = audit;
        _currentUser = currentUser;
    }

    public async Task<PublishImportBatchResult> Handle(PublishImportBatchCommand request, CancellationToken ct)
    {
        var batch = await _batches.GetByIdAsync(request.BatchId, ct);
        if (batch == null)
            return new PublishImportBatchResult(false, "Batch not found.");

        if (batch.Status == ImportBatchStatus.Published)
            return new PublishImportBatchResult(false, "Batch is already published.");

        // Get all records for this batch (lean query — no deep nav includes, no pagination)
        var allRecords = await _records.GetAllForPublishAsync(request.BatchId, ct);

        // Check for pending or unresolved records
        var pendingRecords = allRecords.Where(r =>
            r.ReviewStatus == ImportReviewStatus.Pending ||
            r.MappingStatus == ImportMappingStatus.PendingMapping).ToList();

        if (pendingRecords.Count > 0)
            return new PublishImportBatchResult(false,
                $"Cannot publish: {pendingRecords.Count} record(s) are still pending review or have unresolved mappings.");

        // Create InsurancePlan records for all approved records
        var approvedRecords = allRecords.Where(r => r.ReviewStatus == ImportReviewStatus.Approved).ToList();
        int plansCreated = 0;
        int plansUpdated = 0;
        var recordErrors = new List<PublishRecordError>();

        // Load all existing plans for this company in ONE query instead of N+1 lookups
        var existingPlans = await _plans.GetExistingByCompanyAsync(batch.CompanyId, ct);

        var newPlans = new List<InsurancePlan>();

        // Track unique keys seen within this batch to catch intra-batch duplicates
        var seenKeys = new HashSet<string>();

        foreach (var record in approvedRecords)
        {
            var rawData = ParseRawData(record.RawData);

            // Get canonical vehicle model id from mapping
            Guid? vehicleModelId = null;
            if (record.VehicleModelMappingId.HasValue && record.VehicleModelMapping != null)
                vehicleModelId = record.VehicleModelMapping.CanonicalModelId;

            if (!vehicleModelId.HasValue)
            {
                recordErrors.Add(new PublishRecordError(record.Id, record.RowNumber, "No vehicle model mapping resolved."));
                continue;
            }

            // Get canonical plan type from mapping
            PlanType? planType = null;
            if (record.PlanTypeMappingId.HasValue && record.PlanTypeMapping != null)
                planType = record.PlanTypeMapping.CanonicalPlanType;

            if (!planType.HasValue)
            {
                recordErrors.Add(new PublishRecordError(record.Id, record.RowNumber, "No plan type mapping resolved."));
                continue;
            }

            var repairType = ParseRepairType(rawData);
            var minYear = ParseInt(rawData, "min_year", "minYear", "MinYear");
            var maxYear = ParseInt(rawData, "max_year", "maxYear", "MaxYear");
            var sumInsured = ParseDecimal(rawData, "sum_insured", "sumInsured", "SumInsured");
            var premiumTotal = ParseDecimal(rawData, "premium_total", "premiumTotal", "PremiumTotal");
            var excessAmount = ParseDecimal(rawData, "excess_amount", "excessAmount", "ExcessAmount");
            var regionGroup = rawData.GetValueOrDefault("region_group")
                ?? rawData.GetValueOrDefault("RegionGroup") ?? "";
            var externalPackageId = rawData.GetValueOrDefault("external_package_id")
                ?? rawData.GetValueOrDefault("ExternalPackageId") ?? "";
            var coverageDetails = rawData.GetValueOrDefault("coverage_details")
                ?? rawData.GetValueOrDefault("coverageDetails") ?? "{}";

            // Structured coverage limits (null when not provided by this company's file)
            var tpbiPerPerson    = ParseNullableDecimal(rawData, "tpbi_per_person");
            var tpbiPerAccident  = ParseNullableDecimal(rawData, "tpbi_per_accident");
            var tppd             = ParseNullableDecimal(rawData, "tppd");
            var fireTheft        = ParseNullableDecimal(rawData, "fire_theft");
            var personalAccident = ParseNullableDecimal(rawData, "personal_accident");
            var passengerAccident= ParseNullableDecimal(rawData, "passenger_accident");
            var medicalExpenses  = ParseNullableDecimal(rawData, "medical_expenses");
            var bailBond         = ParseNullableDecimal(rawData, "bail_bond");

            // Detect intra-batch duplicates before hitting the DB constraint
            var uniqueKey = FormattableString.Invariant($"{batch.CompanyId}|{vehicleModelId}|{planType}|{repairType}|{minYear}|{maxYear}|{sumInsured}|{regionGroup}|{externalPackageId}");
            if (!seenKeys.Add(uniqueKey))
            {
                recordErrors.Add(new PublishRecordError(record.Id, record.RowNumber,
                    $"Duplicate plan key within batch: VehicleModelId={vehicleModelId}, PlanType={planType}, RepairType={repairType}, Years={minYear}-{maxYear}, SumInsured={sumInsured}, RegionGroup={regionGroup}, PackageId={externalPackageId}"));
                continue;
            }

            // In-memory lookup — no DB round trip per record
            if (existingPlans.TryGetValue(uniqueKey, out var existing))
            {
                existing.SumInsured        = sumInsured;
                existing.PremiumTotal      = premiumTotal;
                existing.ExcessAmount      = excessAmount;
                existing.CoverageDetails   = coverageDetails;
                existing.RegionGroup       = regionGroup;
                existing.ExternalPackageId = externalPackageId;
                existing.TpbiPerPerson     = tpbiPerPerson;
                existing.TpbiPerAccident   = tpbiPerAccident;
                existing.Tppd              = tppd;
                existing.FireTheft         = fireTheft;
                existing.PersonalAccident  = personalAccident;
                existing.PassengerAccident = passengerAccident;
                existing.MedicalExpenses   = medicalExpenses;
                existing.BailBond          = bailBond;
                existing.IsPublished       = true;
                existing.SourceImportRecordId = record.Id;
                existing.SourceBatchId     = request.BatchId;
                plansUpdated++;
            }
            else
            {
                var plan = new InsurancePlan
                {
                    CompanyId          = batch.CompanyId,
                    VehicleModelId     = vehicleModelId.Value,
                    PlanType           = planType.Value,
                    RepairType         = repairType,
                    MinYear            = minYear,
                    MaxYear            = maxYear,
                    SumInsured         = sumInsured,
                    PremiumTotal       = premiumTotal,
                    ExcessAmount       = excessAmount,
                    CoverageDetails    = coverageDetails,
                    RegionGroup        = regionGroup,
                    ExternalPackageId  = externalPackageId,
                    TpbiPerPerson      = tpbiPerPerson,
                    TpbiPerAccident    = tpbiPerAccident,
                    Tppd               = tppd,
                    FireTheft          = fireTheft,
                    PersonalAccident   = personalAccident,
                    PassengerAccident  = passengerAccident,
                    MedicalExpenses    = medicalExpenses,
                    BailBond           = bailBond,
                    IsPublished        = true,
                    SourceImportRecordId = record.Id,
                    SourceBatchId      = request.BatchId,
                    CreatedBy          = _currentUser.UserId
                };
                newPlans.Add(plan);
                plansCreated++;
            }
        }

        // Bulk-add all new plans in one shot
        if (newPlans.Count > 0)
            await _plans.AddRangeAsync(newPlans, ct);

        batch.Status = ImportBatchStatus.Published;
        batch.PublishedBy = _currentUser.UserId;
        batch.PublishedAt = DateTime.UtcNow;

        await _plans.SaveChangesAsync(ct);

        var outcomeMetadata = JsonSerializer.Serialize(new
        {
            plansCreated,
            plansUpdated,
            approvedRecords = approvedRecords.Count,
            errorCount = recordErrors.Count,
            errors = recordErrors.Select(e => new { e.RecordId, e.RowNumber, e.Reason })
        });

        await _audit.AddAsync(new AuditLog
        {
            ActorId = _currentUser.UserId,
            ActionType = "BatchPublished",
            EntityType = "ImportBatch",
            EntityId = request.BatchId,
            Outcome = recordErrors.Count > 0 ? "PartialSuccess" : "Success",
            Metadata = outcomeMetadata
        }, ct);

        return new PublishImportBatchResult(true, PlansCreated: plansCreated, PlansUpdated: plansUpdated,
            Errors: recordErrors.Count > 0 ? recordErrors : null);
    }

    private static Dictionary<string, string> ParseRawData(string rawData)
    {
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string>>(rawData)
                ?? new Dictionary<string, string>();
        }
        catch
        {
            return new Dictionary<string, string>();
        }
    }

    private static RepairType ParseRepairType(Dictionary<string, string> data)
    {
        var raw = data.GetValueOrDefault("repair_type")
            ?? data.GetValueOrDefault("repairType")
            ?? data.GetValueOrDefault("RepairType") ?? string.Empty;

        return Enum.TryParse<RepairType>(raw, true, out var result) ? result : RepairType.Garage;
    }

    private static int ParseInt(Dictionary<string, string> data, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (data.TryGetValue(key, out var val) && int.TryParse(val, out var n))
                return n;
        }
        return 0;
    }

    private static decimal ParseDecimal(Dictionary<string, string> data, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (data.TryGetValue(key, out var val) && decimal.TryParse(val, out var n))
                return n;
        }
        return 0m;
    }

    /// <summary>
    /// Returns null when the key is absent OR empty — meaning this company's file does
    /// not provide this coverage limit.  Returns the parsed value when present and non-empty.
    /// </summary>
    private static decimal? ParseNullableDecimal(Dictionary<string, string> data, string key)
    {
        if (!data.TryGetValue(key, out var val) || string.IsNullOrWhiteSpace(val))
            return null;
        return decimal.TryParse(val, out var n) ? n : null;
    }
}
