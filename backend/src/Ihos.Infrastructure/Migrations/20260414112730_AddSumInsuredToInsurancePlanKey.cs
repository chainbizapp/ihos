using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ihos.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSumInsuredToInsurancePlanKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_insurance_plans_CompanyId_VehicleModelId_PlanType_RepairTyp~",
                table: "insurance_plans");

            migrationBuilder.CreateIndex(
                name: "IX_insurance_plans_CompanyId_VehicleModelId_PlanType_RepairTyp~",
                table: "insurance_plans",
                columns: new[] { "CompanyId", "VehicleModelId", "PlanType", "RepairType", "MinYear", "MaxYear", "SumInsured" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_insurance_plans_CompanyId_VehicleModelId_PlanType_RepairTyp~",
                table: "insurance_plans");

            migrationBuilder.CreateIndex(
                name: "IX_insurance_plans_CompanyId_VehicleModelId_PlanType_RepairTyp~",
                table: "insurance_plans",
                columns: new[] { "CompanyId", "VehicleModelId", "PlanType", "RepairType", "MinYear", "MaxYear" },
                unique: true);
        }
    }
}
