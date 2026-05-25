using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ihos.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProviderDataSourceAndSyncLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DataSource",
                table: "insurance_companies",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "vehicle_sync_logs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Trigger = table.Column<int>(type: "integer", nullable: false),
                    TriggeredByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    StartedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    InsertedCount = table.Column<int>(type: "integer", nullable: false),
                    UpdatedCount = table.Column<int>(type: "integer", nullable: false),
                    DeactivatedCount = table.Column<int>(type: "integer", nullable: false),
                    ErrorCount = table.Column<int>(type: "integer", nullable: false),
                    ErrorMessage = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    DurationMs = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_vehicle_sync_logs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_vehicle_sync_logs_insurance_companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "insurance_companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_vehicle_sync_logs_company_started_desc",
                table: "vehicle_sync_logs",
                columns: new[] { "CompanyId", "StartedAtUtc" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_vehicle_sync_logs_Status",
                table: "vehicle_sync_logs",
                column: "Status");

            // ── Seed for feature 002-multi-provider-integration ──────────────
            // Mark existing VIRIYAH as API-sourced (DataSource = 1 = Api).
            // ALA (Allianz) stays at default 0 (Import). MTL (Muang Thai Life) is unrelated
            // to MTI and stays at 0. BKI is out-of-scope and stays at 0.
            migrationBuilder.Sql(@"
                UPDATE insurance_companies
                SET ""DataSource"" = 1
                WHERE ""ShortCode"" = 'VIRIYAH';
            ");

            // Insert Muang Thai Insurance (MTI) as a new API-sourced company if it does not
            // already exist. MTI is distinct from MTL (Muang Thai Life Assurance).
            migrationBuilder.Sql(@"
                INSERT INTO insurance_companies (""Id"", ""Name"", ""ShortCode"", ""IsActive"", ""DataSource"", ""CreatedAt"", ""UpdatedAt"", ""IsDeleted"")
                SELECT gen_random_uuid(), 'Muang Thai Insurance', 'MTI', true, 1, now(), now(), false
                WHERE NOT EXISTS (
                    SELECT 1 FROM insurance_companies WHERE ""ShortCode"" = 'MTI'
                );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "vehicle_sync_logs");

            migrationBuilder.DropColumn(
                name: "DataSource",
                table: "insurance_companies");
        }
    }
}
