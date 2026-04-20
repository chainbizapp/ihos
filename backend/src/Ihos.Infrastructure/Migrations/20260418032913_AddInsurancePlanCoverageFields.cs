using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ihos.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddInsurancePlanCoverageFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "BailBond",
                table: "insurance_plans",
                type: "numeric(15,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "FireTheft",
                table: "insurance_plans",
                type: "numeric(15,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MedicalExpenses",
                table: "insurance_plans",
                type: "numeric(15,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PassengerAccident",
                table: "insurance_plans",
                type: "numeric(15,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PersonalAccident",
                table: "insurance_plans",
                type: "numeric(15,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TpbiPerAccident",
                table: "insurance_plans",
                type: "numeric(15,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TpbiPerPerson",
                table: "insurance_plans",
                type: "numeric(15,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Tppd",
                table: "insurance_plans",
                type: "numeric(15,2)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BailBond",
                table: "insurance_plans");

            migrationBuilder.DropColumn(
                name: "FireTheft",
                table: "insurance_plans");

            migrationBuilder.DropColumn(
                name: "MedicalExpenses",
                table: "insurance_plans");

            migrationBuilder.DropColumn(
                name: "PassengerAccident",
                table: "insurance_plans");

            migrationBuilder.DropColumn(
                name: "PersonalAccident",
                table: "insurance_plans");

            migrationBuilder.DropColumn(
                name: "TpbiPerAccident",
                table: "insurance_plans");

            migrationBuilder.DropColumn(
                name: "TpbiPerPerson",
                table: "insurance_plans");

            migrationBuilder.DropColumn(
                name: "Tppd",
                table: "insurance_plans");
        }
    }
}
