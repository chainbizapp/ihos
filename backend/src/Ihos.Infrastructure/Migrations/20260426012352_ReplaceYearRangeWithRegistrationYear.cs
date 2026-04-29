using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ihos.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ReplaceYearRangeWithRegistrationYear : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_insurance_plans_CompanyId_VehicleModelId_PlanType_RepairTyp~",
                table: "insurance_plans");

            migrationBuilder.DropColumn(
                name: "MaxYear",
                table: "insurance_plans");

            migrationBuilder.RenameColumn(
                name: "MinYear",
                table: "insurance_plans",
                newName: "RegistrationYear");

            migrationBuilder.CreateIndex(
                name: "IX_insurance_plans_CompanyId_VehicleModelId_PlanType_RepairTyp~",
                table: "insurance_plans",
                columns: new[] { "CompanyId", "VehicleModelId", "PlanType", "RepairType", "RegistrationYear", "SumInsured", "RegionGroup", "ExternalPackageId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_insurance_plans_CompanyId_VehicleModelId_PlanType_RepairTyp~",
                table: "insurance_plans");

            migrationBuilder.RenameColumn(
                name: "RegistrationYear",
                table: "insurance_plans",
                newName: "MinYear");

            migrationBuilder.AddColumn<int>(
                name: "MaxYear",
                table: "insurance_plans",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_insurance_plans_CompanyId_VehicleModelId_PlanType_RepairTyp~",
                table: "insurance_plans",
                columns: new[] { "CompanyId", "VehicleModelId", "PlanType", "RepairType", "MinYear", "MaxYear", "SumInsured", "RegionGroup", "ExternalPackageId" },
                unique: true);
        }
    }
}
