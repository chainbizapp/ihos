using System.Globalization;
using NpgsqlTypes;
using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Ihos.Infrastructure.Repositories;

public class InsurancePlanRepository : IInsurancePlanRepository
{
    private readonly ApplicationDbContext _db;

    public InsurancePlanRepository(ApplicationDbContext db) => _db = db;

    public Task<InsurancePlan?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.InsurancePlans
            .Include(p => p.Company)
            .Include(p => p.VehicleModel).ThenInclude(m => m!.Make)
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted, ct);

    public async Task<(IReadOnlyList<InsurancePlan> Items, int TotalCount)> SearchAsync(
        IReadOnlyList<Guid> vehicleModelIds,
        int? registrationYear,
        PlanType? planType,
        RepairType repairType,
        Guid? companyId,
        decimal? excessMin,
        decimal? excessMax,
        string sort,
        int page,
        int pageSize,
        string? province = null,
        CancellationToken ct = default)
    {
        // Resolve province name → ThaiRegion (match on Thai or English name)
        ThaiRegion? region = null;
        if (!string.IsNullOrWhiteSpace(province))
        {
            var prov = await _db.Provinces.FirstOrDefaultAsync(
                p => p.NameTh == province || p.NameEn == province, ct);
            if (prov != null) region = prov.Region;
        }

        var query = _db.InsurancePlans
            .Include(p => p.Company)
            .Include(p => p.VehicleModel).ThenInclude(m => m.Make)
            .Where(p =>
                p.IsPublished &&
                !p.IsDeleted &&
                vehicleModelIds.Contains(p.VehicleModelId) &&
                p.RepairType == repairType &&
                (registrationYear == null || p.RegistrationYear == 0 || p.RegistrationYear == registrationYear));

        // Region filter:
        // - Plans with RegionGroup == "" apply nationwide → always shown.
        // - Plans with a RegionGroup are shown only when a mapping row exists for
        //   (company.ShortCode, plan.RegionGroup, user's region).
        // - When no province selected, all plans are returned (unfiltered behaviour).
        if (region.HasValue)
        {
            var userRegion = region.Value;

            // Pre-load applicable (CompanyId, RegionGroup) pairs for this region.
            // We join RegionGroupMappings → InsuranceCompanies to resolve ShortCode → Guid.
            // Using in-memory sets + EF Contains() avoids a correlated subquery on a
            // navigation property (p.Company.ShortCode) which EF cannot always translate.
            var applicable = await _db.RegionGroupMappings
                .Where(m => m.ThaiRegion == userRegion)
                .Join(_db.InsuranceCompanies,
                      m => m.CompanyShortCode,
                      c => c.ShortCode,
                      (m, c) => new { CompanyId = c.Id, m.RegionGroup })
                .ToListAsync(ct);

            var applicableCompanyIds  = applicable.Select(a => a.CompanyId).ToHashSet();
            var applicableRegionGroups = applicable.Select(a => a.RegionGroup).ToHashSet();

            query = query.Where(p =>
                p.RegionGroup == "" ||
                (applicableCompanyIds.Contains(p.CompanyId) &&
                 applicableRegionGroups.Contains(p.RegionGroup)));
        }

        if (planType.HasValue)
            query = query.Where(p => p.PlanType == planType.Value);

        if (companyId.HasValue)
            query = query.Where(p => p.CompanyId == companyId.Value);

        if (excessMin.HasValue)
            query = query.Where(p => p.ExcessAmount >= excessMin.Value);

        if (excessMax.HasValue)
            query = query.Where(p => p.ExcessAmount <= excessMax.Value);

        var total = await query.CountAsync(ct);

        query = sort switch
        {
            "sum_insured_desc" => query.OrderByDescending(p => p.SumInsured),
            _ => query.OrderBy(p => p.PremiumTotal)
        };

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task<IReadOnlyList<InsurancePlan>> GetByIdsAsync(IEnumerable<Guid> ids, CancellationToken ct = default)
    {
        var idList = ids.ToList();
        return await _db.InsurancePlans
            .Include(p => p.Company)
            .Include(p => p.VehicleModel).ThenInclude(m => m!.Make)
            .Where(p => idList.Contains(p.Id) && p.IsPublished && !p.IsDeleted)
            .ToListAsync(ct);
    }

    public Task<InsurancePlan?> GetByUniqueKeyAsync(
        Guid companyId, Guid vehicleModelId, PlanType planType, RepairType repairType,
        int registrationYear, decimal sumInsured, string regionGroup = "",
        string externalPackageId = "", string vehicleTypeCode = "", CancellationToken ct = default) =>
        _db.InsurancePlans
            .FirstOrDefaultAsync(p =>
                p.CompanyId == companyId &&
                p.VehicleModelId == vehicleModelId &&
                p.PlanType == planType &&
                p.RepairType == repairType &&
                p.RegistrationYear == registrationYear &&
                p.SumInsured == sumInsured &&
                p.RegionGroup == regionGroup &&
                p.ExternalPackageId == externalPackageId &&
                p.VehicleTypeCode == vehicleTypeCode &&
                !p.IsDeleted, ct);

    public async Task AddAsync(InsurancePlan plan, CancellationToken ct = default) =>
        await _db.InsurancePlans.AddAsync(plan, ct);

    public async Task<Dictionary<string, InsurancePlan>> GetExistingByCompanyAsync(Guid companyId, CancellationToken ct = default)
    {
        var plans = await _db.InsurancePlans
            .Where(p => p.CompanyId == companyId && !p.IsDeleted)
            .ToListAsync(ct);

        return plans.ToDictionary(p =>
            FormattableString.Invariant($"{p.CompanyId}|{p.VehicleModelId}|{p.PlanType}|{p.RepairType}|{p.RegistrationYear}|{p.SumInsured}|{p.RegionGroup}|{p.ExternalPackageId}|{p.VehicleTypeCode}"));
    }

    public async Task AddRangeAsync(IEnumerable<InsurancePlan> plans, CancellationToken ct = default) =>
        await _db.InsurancePlans.AddRangeAsync(plans, ct);

    public Task SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);

    public async Task BulkUpsertAsync(IReadOnlyList<InsurancePlan> plans, CancellationToken ct = default)
    {
        if (plans.Count == 0) return;

        var conn = (Npgsql.NpgsqlConnection)_db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);

        await using var tx = await conn.BeginTransactionAsync(ct);

        // 1. Create temp table with exact schema for copy
        using var createCmd = new Npgsql.NpgsqlCommand("""
            CREATE TEMPORARY TABLE temp_insurance_plans (
                "Id" uuid, "CompanyId" uuid, "VehicleModelId" uuid, "PlanType" text, "RepairType" text,
                "RegistrationYear" integer, "SumInsured" numeric, "PremiumTotal" numeric, "ExcessAmount" numeric,
                "CoverageDetails" jsonb, "RegionGroup" text, "ExternalPackageId" text, "VehicleTypeCode" text,
                "IsPublished" boolean,
                "SourceImportRecordId" uuid, "SourceBatchId" uuid, "CreatedBy" uuid, "CreatedAt" timestamp with time zone,
                "TpbiPerPerson" numeric, "TpbiPerAccident" numeric, "Tppd" numeric, "FireTheft" numeric,
                "PersonalAccident" numeric, "PassengerAccident" numeric, "MedicalExpenses" numeric, "BailBond" numeric
            ) ON COMMIT DROP;
            """, conn) { Transaction = tx };
        await createCmd.ExecuteNonQueryAsync(ct);

        // 2. Efficient binary COPY to temp table
        using (var writer = await conn.BeginBinaryImportAsync("""
            COPY temp_insurance_plans (
                "Id", "CompanyId", "VehicleModelId", "PlanType", "RepairType",
                "RegistrationYear", "SumInsured", "PremiumTotal", "ExcessAmount",
                "CoverageDetails", "RegionGroup", "ExternalPackageId", "VehicleTypeCode",
                "IsPublished",
                "SourceImportRecordId", "SourceBatchId", "CreatedBy", "CreatedAt",
                "TpbiPerPerson", "TpbiPerAccident", "Tppd", "FireTheft",
                "PersonalAccident", "PassengerAccident", "MedicalExpenses", "BailBond"
            ) FROM STDIN (FORMAT BINARY)
            """, ct))
        {
            foreach (var p in plans)
            {
                await writer.StartRowAsync(ct);
                await writer.WriteAsync(p.Id == Guid.Empty ? Guid.NewGuid() : p.Id, ct);
                await writer.WriteAsync(p.CompanyId, ct);
                await writer.WriteAsync(p.VehicleModelId, ct);
                await writer.WriteAsync(p.PlanType.ToString(), ct);
                await writer.WriteAsync(p.RepairType.ToString(), ct);
                await writer.WriteAsync(p.RegistrationYear, ct);
                await writer.WriteAsync(p.SumInsured, ct);
                await writer.WriteAsync(p.PremiumTotal, ct);
                await writer.WriteAsync(p.ExcessAmount, ct);
                await writer.WriteAsync(CleanString(p.CoverageDetails, "{}"), NpgsqlDbType.Jsonb, ct);
                await writer.WriteAsync(CleanString(p.RegionGroup), ct);
                await writer.WriteAsync(CleanString(p.ExternalPackageId), ct);
                await writer.WriteAsync(CleanString(p.VehicleTypeCode), ct);
                await writer.WriteAsync(p.IsPublished, ct);
                await writer.WriteAsync(p.SourceImportRecordId, ct);
                await writer.WriteAsync(p.SourceBatchId, ct);
                if (p.CreatedBy.HasValue) await writer.WriteAsync(p.CreatedBy.Value, ct); else await writer.WriteNullAsync(ct);
                await writer.WriteAsync(p.CreatedAt, ct);

                // Nullable coverage limits
                if (p.TpbiPerPerson.HasValue)    await writer.WriteAsync(p.TpbiPerPerson.Value, ct);    else await writer.WriteNullAsync(ct);
                if (p.TpbiPerAccident.HasValue)  await writer.WriteAsync(p.TpbiPerAccident.Value, ct);  else await writer.WriteNullAsync(ct);
                if (p.Tppd.HasValue)             await writer.WriteAsync(p.Tppd.Value, ct);             else await writer.WriteNullAsync(ct);
                if (p.FireTheft.HasValue)        await writer.WriteAsync(p.FireTheft.Value, ct);        else await writer.WriteNullAsync(ct);
                if (p.PersonalAccident.HasValue) await writer.WriteAsync(p.PersonalAccident.Value, ct); else await writer.WriteNullAsync(ct);
                if (p.PassengerAccident.HasValue)await writer.WriteAsync(p.PassengerAccident.Value, ct);else await writer.WriteNullAsync(ct);
                if (p.MedicalExpenses.HasValue)  await writer.WriteAsync(p.MedicalExpenses.Value, ct);  else await writer.WriteNullAsync(ct);
                if (p.BailBond.HasValue)         await writer.WriteAsync(p.BailBond.Value, ct);         else await writer.WriteNullAsync(ct);
            }
            await writer.CompleteAsync(ct);
        }

        // 3. ATOMIC UPSERT: Insert new or update existing on unique key conflict
        using var upsertCmd = new Npgsql.NpgsqlCommand("""
            INSERT INTO insurance_plans (
                "Id", "CompanyId", "VehicleModelId", "PlanType", "RepairType",
                "RegistrationYear", "SumInsured", "PremiumTotal", "ExcessAmount",
                "CoverageDetails", "RegionGroup", "ExternalPackageId", "VehicleTypeCode",
                "IsPublished",
                "SourceImportRecordId", "SourceBatchId", "CreatedBy", "CreatedAt", "UpdatedAt", "IsDeleted",
                "TpbiPerPerson", "TpbiPerAccident", "Tppd", "FireTheft",
                "PersonalAccident", "PassengerAccident", "MedicalExpenses", "BailBond"
            )
            SELECT
                t."Id", t."CompanyId", t."VehicleModelId", t."PlanType", t."RepairType",
                t."RegistrationYear", t."SumInsured", t."PremiumTotal", t."ExcessAmount",
                t."CoverageDetails", t."RegionGroup", t."ExternalPackageId", t."VehicleTypeCode",
                t."IsPublished",
                t."SourceImportRecordId", t."SourceBatchId", t."CreatedBy", t."CreatedAt", t."CreatedAt", false,
                t."TpbiPerPerson", t."TpbiPerAccident", t."Tppd", t."FireTheft",
                t."PersonalAccident", t."PassengerAccident", t."MedicalExpenses", t."BailBond"
            FROM temp_insurance_plans t
            ON CONFLICT ("CompanyId", "VehicleModelId", "PlanType", "RepairType", "RegistrationYear", "SumInsured", "RegionGroup", "ExternalPackageId", "VehicleTypeCode")
            DO UPDATE SET
                "PremiumTotal" = EXCLUDED."PremiumTotal",
                "ExcessAmount" = EXCLUDED."ExcessAmount",
                "CoverageDetails" = EXCLUDED."CoverageDetails",
                "IsPublished" = true,
                "IsDeleted" = false,
                "SourceImportRecordId" = EXCLUDED."SourceImportRecordId",
                "SourceBatchId" = EXCLUDED."SourceBatchId",
                "UpdatedAt" = EXCLUDED."CreatedAt",
                "TpbiPerPerson" = EXCLUDED."TpbiPerPerson",
                "TpbiPerAccident" = EXCLUDED."TpbiPerAccident",
                "Tppd" = EXCLUDED."Tppd",
                "FireTheft" = EXCLUDED."FireTheft",
                "PersonalAccident" = EXCLUDED."PersonalAccident",
                "PassengerAccident" = EXCLUDED."PassengerAccident",
                "MedicalExpenses" = EXCLUDED."MedicalExpenses",
                "BailBond" = EXCLUDED."BailBond";
            """, conn) { Transaction = tx };
        await upsertCmd.ExecuteNonQueryAsync(ct);

        await tx.CommitAsync(ct);
    }

    /// <summary>
    /// Strips characters that PostgreSQL TEXT/JSONB rejects over binary COPY:
    /// - Null bytes (\x00) — not allowed in PostgreSQL text types
    /// - Lone UTF-16 surrogates — produce invalid UTF-8 bytes when encoded
    /// - C1 control bytes (U+0080–U+009F) that arrived as raw bytes from
    ///   mis-decoded Windows-874/1252 source files
    /// </summary>
    private static string CleanString(string? input, string fallback = "")
    {
        if (string.IsNullOrEmpty(input)) return fallback;

        // Fast path: skip allocation when the string is already clean
        bool dirty = false;
        foreach (var c in input)
        {
            if (c == '\0' || char.IsSurrogate(c) || (c >= '\u0080' && c <= '\u009F'))
            { dirty = true; break; }
        }
        if (!dirty) return input;

        var sb = new System.Text.StringBuilder(input.Length);
        foreach (var c in input)
        {
            if (c == '\0' || char.IsSurrogate(c) || (c >= '\u0080' && c <= '\u009F'))
                continue;
            sb.Append(c);
        }
        return sb.Length > 0 ? sb.ToString() : fallback;
    }
}
