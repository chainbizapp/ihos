using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ihos.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddQuotations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "quotations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    PlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    VehicleRegistration = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    VehicleMake = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    VehicleModelName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    VehicleYear = table.Column<int>(type: "integer", nullable: false),
                    PremiumAtGeneration = table.Column<decimal>(type: "numeric(15,2)", nullable: false),
                    GeneratedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_quotations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_quotations_insurance_plans_PlanId",
                        column: x => x.PlanId,
                        principalTable: "insurance_plans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_quotations_CreatedBy",
                table: "quotations",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_quotations_GeneratedAt",
                table: "quotations",
                column: "GeneratedAt");

            migrationBuilder.CreateIndex(
                name: "IX_quotations_PlanId",
                table: "quotations",
                column: "PlanId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "quotations");
        }
    }
}
