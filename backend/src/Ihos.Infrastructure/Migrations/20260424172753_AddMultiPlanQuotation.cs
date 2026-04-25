using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ihos.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMultiPlanQuotation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PlanId2",
                table: "quotations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PlanId3",
                table: "quotations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PremiumAtGeneration2",
                table: "quotations",
                type: "numeric(15,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PremiumAtGeneration3",
                table: "quotations",
                type: "numeric(15,2)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_quotations_PlanId2",
                table: "quotations",
                column: "PlanId2");

            migrationBuilder.CreateIndex(
                name: "IX_quotations_PlanId3",
                table: "quotations",
                column: "PlanId3");

            migrationBuilder.AddForeignKey(
                name: "FK_quotations_insurance_plans_PlanId2",
                table: "quotations",
                column: "PlanId2",
                principalTable: "insurance_plans",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_quotations_insurance_plans_PlanId3",
                table: "quotations",
                column: "PlanId3",
                principalTable: "insurance_plans",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_quotations_insurance_plans_PlanId2",
                table: "quotations");

            migrationBuilder.DropForeignKey(
                name: "FK_quotations_insurance_plans_PlanId3",
                table: "quotations");

            migrationBuilder.DropIndex(
                name: "IX_quotations_PlanId2",
                table: "quotations");

            migrationBuilder.DropIndex(
                name: "IX_quotations_PlanId3",
                table: "quotations");

            migrationBuilder.DropColumn(
                name: "PlanId2",
                table: "quotations");

            migrationBuilder.DropColumn(
                name: "PlanId3",
                table: "quotations");

            migrationBuilder.DropColumn(
                name: "PremiumAtGeneration2",
                table: "quotations");

            migrationBuilder.DropColumn(
                name: "PremiumAtGeneration3",
                table: "quotations");
        }
    }
}
