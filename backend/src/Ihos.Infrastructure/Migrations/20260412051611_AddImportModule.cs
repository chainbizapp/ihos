using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ihos.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddImportModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "insurance_companies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    Name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    ShortCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_insurance_companies", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "vehicle_makes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_vehicle_makes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "import_batches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceFileName = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    SourceFilePath = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    UploadedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    TotalRows = table.Column<int>(type: "integer", nullable: false),
                    ResolvedRows = table.Column<int>(type: "integer", nullable: false),
                    PendingRows = table.Column<int>(type: "integer", nullable: false),
                    ApprovedRows = table.Column<int>(type: "integer", nullable: false),
                    RejectedRows = table.Column<int>(type: "integer", nullable: false),
                    PublishedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FailureReason = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_import_batches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_import_batches_insurance_companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "insurance_companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "plan_type_mappings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    RawName = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CanonicalPlanType = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_plan_type_mappings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_plan_type_mappings_insurance_companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "insurance_companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "vehicle_models",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    MakeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SubModel = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_vehicle_models", x => x.Id);
                    table.ForeignKey(
                        name: "FK_vehicle_models_vehicle_makes_MakeId",
                        column: x => x.MakeId,
                        principalTable: "vehicle_makes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "vehicle_model_mappings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    RawName = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CanonicalModelId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsAutoSuggested = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_vehicle_model_mappings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_vehicle_model_mappings_insurance_companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "insurance_companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_vehicle_model_mappings_vehicle_models_CanonicalModelId",
                        column: x => x.CanonicalModelId,
                        principalTable: "vehicle_models",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "import_records",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    BatchId = table.Column<Guid>(type: "uuid", nullable: false),
                    RowNumber = table.Column<int>(type: "integer", nullable: false),
                    RawData = table.Column<string>(type: "jsonb", nullable: false),
                    VehicleModelMappingId = table.Column<Guid>(type: "uuid", nullable: true),
                    PlanTypeMappingId = table.Column<Guid>(type: "uuid", nullable: true),
                    MappingStatus = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ReviewStatus = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ReviewedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_import_records", x => x.Id);
                    table.ForeignKey(
                        name: "FK_import_records_import_batches_BatchId",
                        column: x => x.BatchId,
                        principalTable: "import_batches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_import_records_plan_type_mappings_PlanTypeMappingId",
                        column: x => x.PlanTypeMappingId,
                        principalTable: "plan_type_mappings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_import_records_vehicle_model_mappings_VehicleModelMappingId",
                        column: x => x.VehicleModelMappingId,
                        principalTable: "vehicle_model_mappings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_import_batches_CompanyId",
                table: "import_batches",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_import_batches_Status",
                table: "import_batches",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_import_batches_UploadedAt",
                table: "import_batches",
                column: "UploadedAt");

            migrationBuilder.CreateIndex(
                name: "IX_import_batches_UploadedBy",
                table: "import_batches",
                column: "UploadedBy");

            migrationBuilder.CreateIndex(
                name: "IX_import_records_BatchId",
                table: "import_records",
                column: "BatchId");

            migrationBuilder.CreateIndex(
                name: "IX_import_records_MappingStatus",
                table: "import_records",
                column: "MappingStatus");

            migrationBuilder.CreateIndex(
                name: "IX_import_records_PlanTypeMappingId",
                table: "import_records",
                column: "PlanTypeMappingId");

            migrationBuilder.CreateIndex(
                name: "IX_import_records_ReviewStatus",
                table: "import_records",
                column: "ReviewStatus");

            migrationBuilder.CreateIndex(
                name: "IX_import_records_VehicleModelMappingId",
                table: "import_records",
                column: "VehicleModelMappingId");

            migrationBuilder.CreateIndex(
                name: "IX_insurance_companies_Name",
                table: "insurance_companies",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_insurance_companies_ShortCode",
                table: "insurance_companies",
                column: "ShortCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_plan_type_mappings_CompanyId_RawName",
                table: "plan_type_mappings",
                columns: new[] { "CompanyId", "RawName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_vehicle_makes_Name",
                table: "vehicle_makes",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_vehicle_model_mappings_CanonicalModelId",
                table: "vehicle_model_mappings",
                column: "CanonicalModelId");

            migrationBuilder.CreateIndex(
                name: "IX_vehicle_model_mappings_CompanyId",
                table: "vehicle_model_mappings",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_vehicle_model_mappings_CompanyId_RawName",
                table: "vehicle_model_mappings",
                columns: new[] { "CompanyId", "RawName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_vehicle_models_MakeId",
                table: "vehicle_models",
                column: "MakeId");

            migrationBuilder.CreateIndex(
                name: "IX_vehicle_models_MakeId_Name_SubModel",
                table: "vehicle_models",
                columns: new[] { "MakeId", "Name", "SubModel" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "import_records");

            migrationBuilder.DropTable(
                name: "import_batches");

            migrationBuilder.DropTable(
                name: "plan_type_mappings");

            migrationBuilder.DropTable(
                name: "vehicle_model_mappings");

            migrationBuilder.DropTable(
                name: "insurance_companies");

            migrationBuilder.DropTable(
                name: "vehicle_models");

            migrationBuilder.DropTable(
                name: "vehicle_makes");
        }
    }
}
