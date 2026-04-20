using System.Data;
using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;

namespace Ihos.Infrastructure.Repositories;

public class ImportRecordRepository : IImportRecordRepository
{
    private readonly ApplicationDbContext _db;

    public ImportRecordRepository(ApplicationDbContext db) => _db = db;

    public Task<ImportRecord?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.ImportRecords
            .Include(r => r.VehicleModelMapping)
            .Include(r => r.PlanTypeMapping)
            .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted, ct);

    public async Task<(IReadOnlyList<ImportRecord> Items, int TotalCount)> GetByBatchAsync(
        Guid batchId, int page, int pageSize, bool issuesOnly = false, CancellationToken ct = default)
    {
        var query = _db.ImportRecords
            .Include(r => r.VehicleModelMapping).ThenInclude(m => m!.CanonicalModel)
            .Include(r => r.PlanTypeMapping)
            .Where(r => r.BatchId == batchId && !r.IsDeleted);

        if (issuesOnly)
        {
            query = query.Where(r => r.MappingStatus != ImportMappingStatus.Resolved || r.ReviewStatus == ImportReviewStatus.Rejected);
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(r => r.RowNumber)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task<IReadOnlyList<ImportRecord>> GetResolvedPendingByBatchAsync(Guid batchId, CancellationToken ct = default) =>
        await _db.ImportRecords
            .Where(r => r.BatchId == batchId
                     && !r.IsDeleted
                     && r.MappingStatus == ImportMappingStatus.Resolved
                     && r.ReviewStatus == ImportReviewStatus.Pending)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<ImportRecord>> GetPendingMappingByBatchAsync(Guid batchId, CancellationToken ct = default) =>
        await _db.ImportRecords
            .Where(r => r.BatchId == batchId
                     && !r.IsDeleted
                     && r.MappingStatus == ImportMappingStatus.PendingMapping)
            .ToListAsync(ct);

    public async Task AddRangeAsync(IEnumerable<ImportRecord> records, CancellationToken ct = default) =>
        await _db.ImportRecords.AddRangeAsync(records, ct);

    public Task SaveChangesAsync(CancellationToken ct = default) =>
        _db.SaveChangesAsync(ct);

    public async Task<IReadOnlyList<DuplicateRecordGroup>> GetDuplicateGroupsAsync(
        Guid batchId, int limit = 30, CancellationToken ct = default)
    {
        var connectionString = _db.Database.GetConnectionString()!;
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync(ct);

        const string sql = """
            SELECT
                COUNT(*)::int                                                          AS "Count",
                MIN("RowNumber")::int                                                  AS "FirstRowNumber",
                COALESCE("RawData"->>'repair_type', '')                                AS "RepairType",
                COALESCE("RawData"->>'min_year', '')                                   AS "MinYear",
                COALESCE("RawData"->>'max_year', '')                                   AS "MaxYear",
                COALESCE("RawData"->>'sum_insured', '')                                AS "SumInsured",
                COALESCE("RawData"->>'external_package_id', '')                        AS "ExternalPackageId",
                array_agg(DISTINCT COALESCE("RawData"->>'vehicle_model', ''))          AS "VehicleModels",
                array_agg("RowNumber" ORDER BY "RowNumber")
                    FILTER (WHERE "RowNumber" <> MIN("RowNumber") OVER (
                        PARTITION BY
                            "VehicleModelMappingId", "PlanTypeMappingId",
                            "RawData"->>'repair_type', "RawData"->>'min_year',
                            "RawData"->>'max_year',   "RawData"->>'sum_insured',
                            "RawData"->>'external_package_id'
                    ))::int[]                                                           AS "DuplicateRows"
            FROM import_records
            WHERE "BatchId" = @batchId AND "IsDeleted" = false
            GROUP BY
                "VehicleModelMappingId", "PlanTypeMappingId",
                "RawData"->>'repair_type', "RawData"->>'min_year',
                "RawData"->>'max_year',   "RawData"->>'sum_insured',
                "RawData"->>'external_package_id'
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC
            LIMIT @limit
            """;

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("batchId", batchId);
        cmd.Parameters.AddWithValue("limit",   limit);

        await using var reader = await cmd.ExecuteReaderAsync(ct);

        var results = new List<DuplicateRecordGroup>();
        while (await reader.ReadAsync(ct))
        {
            var vehicleModels  = reader.GetFieldValue<string[]>("VehicleModels");
            var duplicateRows  = reader.IsDBNull(reader.GetOrdinal("DuplicateRows"))
                ? Array.Empty<int>()
                : reader.GetFieldValue<int[]>("DuplicateRows");

            results.Add(new DuplicateRecordGroup(
                Count            : reader.GetInt32(reader.GetOrdinal("Count")),
                FirstRowNumber   : reader.GetInt32(reader.GetOrdinal("FirstRowNumber")),
                RepairType       : reader.GetString(reader.GetOrdinal("RepairType")),
                MinYear          : reader.GetString(reader.GetOrdinal("MinYear")),
                MaxYear          : reader.GetString(reader.GetOrdinal("MaxYear")),
                SumInsured       : reader.GetString(reader.GetOrdinal("SumInsured")),
                ExternalPackageId: reader.GetString(reader.GetOrdinal("ExternalPackageId")),
                VehicleModels    : vehicleModels,
                DuplicateRows    : duplicateRows
            ));
        }
        return results;
    }

    public async Task<IReadOnlyList<ImportRecord>> GetAllForPublishAsync(Guid batchId, CancellationToken ct = default) =>
        await _db.ImportRecords
            .Include(r => r.VehicleModelMapping)   // need CanonicalModelId
            .Include(r => r.PlanTypeMapping)        // need CanonicalPlanType
            .Where(r => r.BatchId == batchId && !r.IsDeleted)
            .AsNoTracking()                         // read-only; no change tracking needed
            .OrderBy(r => r.RowNumber)
            .ToListAsync(ct);

    public async Task<int> BulkRejectUnresolvedAsync(Guid batchId, Guid? userId, DateTime now, string reason, CancellationToken ct = default) =>
        await _db.ImportRecords
            .Where(r => r.BatchId == batchId
                     && !r.IsDeleted
                     && r.MappingStatus == ImportMappingStatus.PendingMapping
                     && r.ReviewStatus == ImportReviewStatus.Pending)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.ReviewStatus,    ImportReviewStatus.Rejected)
                .SetProperty(r => r.ReviewedBy,      userId)
                .SetProperty(r => r.ReviewedAt,      now)
                .SetProperty(r => r.RejectionReason, reason), ct);

    public async Task<int> BulkApproveResolvedAsync(Guid batchId, Guid? userId, DateTime now, CancellationToken ct = default) =>
        await _db.ImportRecords
            .Where(r => r.BatchId == batchId
                     && !r.IsDeleted
                     && r.MappingStatus == ImportMappingStatus.Resolved
                     && r.ReviewStatus == ImportReviewStatus.Pending)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.ReviewStatus, ImportReviewStatus.Approved)
                .SetProperty(r => r.ReviewedBy,   userId)
                .SetProperty(r => r.ReviewedAt,   now), ct);

    /// <summary>
    /// Bulk-inserts rows via PostgreSQL COPY binary protocol using a dedicated connection.
    /// Column names must match the quoted PascalCase names EF Core creates in PostgreSQL.
    /// </summary>
    public async Task BulkInsertAsync(IReadOnlyList<ImportRecord> records, CancellationToken ct = default)
    {
        if (records.Count == 0) return;

        // Use a dedicated connection so we never interfere with EF's connection state.
        var connectionString = _db.Database.GetConnectionString()!;
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync(ct);

        // Column names must be quoted and match exactly what EF created (PascalCase, no snake_case).
        await using var writer = await conn.BeginBinaryImportAsync(
            "COPY import_records " +
            "(\"Id\", \"BatchId\", \"RowNumber\", \"RawData\", " +
            "\"VehicleModelMappingId\", \"PlanTypeMappingId\", " +
            "\"MappingStatus\", \"ReviewStatus\", " +
            "\"ReviewedBy\", \"ReviewedAt\", \"RejectionReason\", " +
            "\"CreatedAt\", \"UpdatedAt\", \"IsDeleted\", \"CreatedBy\") " +
            "FROM STDIN (FORMAT BINARY)", ct);

        foreach (var r in records)
        {
            await writer.StartRowAsync(ct);
            await writer.WriteAsync(r.Id,        NpgsqlDbType.Uuid,    ct);
            await writer.WriteAsync(r.BatchId,   NpgsqlDbType.Uuid,    ct);
            await writer.WriteAsync(r.RowNumber, NpgsqlDbType.Integer, ct);
            await writer.WriteAsync(r.RawData,   NpgsqlDbType.Jsonb,   ct);

            if (r.VehicleModelMappingId.HasValue)
                await writer.WriteAsync(r.VehicleModelMappingId.Value, NpgsqlDbType.Uuid, ct);
            else
                await writer.WriteNullAsync(ct);

            if (r.PlanTypeMappingId.HasValue)
                await writer.WriteAsync(r.PlanTypeMappingId.Value, NpgsqlDbType.Uuid, ct);
            else
                await writer.WriteNullAsync(ct);

            await writer.WriteAsync(r.MappingStatus.ToString(), NpgsqlDbType.Varchar, ct);
            await writer.WriteAsync(r.ReviewStatus.ToString(),  NpgsqlDbType.Varchar, ct);

            // ReviewedBy, ReviewedAt, RejectionReason — always null for new records
            await writer.WriteNullAsync(ct);
            await writer.WriteNullAsync(ct);
            await writer.WriteNullAsync(ct);

            await writer.WriteAsync(r.CreatedAt, NpgsqlDbType.TimestampTz, ct);
            await writer.WriteAsync(r.UpdatedAt, NpgsqlDbType.TimestampTz, ct);
            await writer.WriteAsync(r.IsDeleted, NpgsqlDbType.Boolean,     ct);

            if (r.CreatedBy.HasValue)
                await writer.WriteAsync(r.CreatedBy.Value, NpgsqlDbType.Uuid, ct);
            else
                await writer.WriteNullAsync(ct);
        }

        await writer.CompleteAsync(ct);
    }
}
