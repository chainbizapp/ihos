using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ihos.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddInsurancePlanRegionGroup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_insurance_plans_CompanyId_VehicleModelId_PlanType_RepairTyp~",
                table: "insurance_plans");

            migrationBuilder.AddColumn<string>(
                name: "RegionGroup",
                table: "insurance_plans",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_insurance_plans_CompanyId_VehicleModelId_PlanType_RepairTyp~",
                table: "insurance_plans",
                columns: new[] { "CompanyId", "VehicleModelId", "PlanType", "RepairType", "MinYear", "MaxYear", "SumInsured", "RegionGroup" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_insurance_plans_CompanyId_VehicleModelId_PlanType_RepairTyp~",
                table: "insurance_plans");

            migrationBuilder.DropColumn(
                name: "RegionGroup",
                table: "insurance_plans");

            migrationBuilder.CreateIndex(
                name: "IX_insurance_plans_CompanyId_VehicleModelId_PlanType_RepairTyp~",
                table: "insurance_plans",
                columns: new[] { "CompanyId", "VehicleModelId", "PlanType", "RepairType", "MinYear", "MaxYear", "SumInsured" },
                unique: true);
        }
    }
}
