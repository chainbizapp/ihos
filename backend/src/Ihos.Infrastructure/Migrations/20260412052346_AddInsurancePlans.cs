using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ihos.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddInsurancePlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "insurance_plans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    VehicleModelId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanType = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    RepairType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MinYear = table.Column<int>(type: "integer", nullable: false),
                    MaxYear = table.Column<int>(type: "integer", nullable: false),
                    SumInsured = table.Column<decimal>(type: "numeric(15,2)", nullable: false),
                    PremiumTotal = table.Column<decimal>(type: "numeric(15,2)", nullable: false),
                    ExcessAmount = table.Column<decimal>(type: "numeric(15,2)", nullable: false, defaultValue: 0m),
                    CoverageDetails = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'{}'"),
                    Remarks = table.Column<string>(type: "text", nullable: true),
                    SourceImportRecordId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceBatchId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsPublished = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_insurance_plans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_insurance_plans_import_batches_SourceBatchId",
                        column: x => x.SourceBatchId,
                        principalTable: "import_batches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_insurance_plans_import_records_SourceImportRecordId",
                        column: x => x.SourceImportRecordId,
                        principalTable: "import_records",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_insurance_plans_insurance_companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "insurance_companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_insurance_plans_vehicle_models_VehicleModelId",
                        column: x => x.VehicleModelId,
                        principalTable: "vehicle_models",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_insurance_plans_CompanyId",
                table: "insurance_plans",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_insurance_plans_CompanyId_VehicleModelId_PlanType_RepairTyp~",
                table: "insurance_plans",
                columns: new[] { "CompanyId", "VehicleModelId", "PlanType", "RepairType", "MinYear", "MaxYear" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_insurance_plans_IsPublished",
                table: "insurance_plans",
                column: "IsPublished");

            migrationBuilder.CreateIndex(
                name: "IX_insurance_plans_SourceBatchId",
                table: "insurance_plans",
                column: "SourceBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_insurance_plans_SourceImportRecordId",
                table: "insurance_plans",
                column: "SourceImportRecordId");

            migrationBuilder.CreateIndex(
                name: "IX_insurance_plans_VehicleModelId",
                table: "insurance_plans",
                column: "VehicleModelId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "insurance_plans");
        }
    }
}
