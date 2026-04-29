using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ihos.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerVehicleRegistration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_customers_FullName_Phone_CreatedBy",
                table: "customers");

            migrationBuilder.AddColumn<string>(
                name: "VehicleRegistration",
                table: "customers",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_customers_FullName_Phone_VehicleRegistration_CreatedBy",
                table: "customers",
                columns: new[] { "FullName", "Phone", "VehicleRegistration", "CreatedBy" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_customers_FullName_Phone_VehicleRegistration_CreatedBy",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "VehicleRegistration",
                table: "customers");

            migrationBuilder.CreateIndex(
                name: "IX_customers_FullName_Phone_CreatedBy",
                table: "customers",
                columns: new[] { "FullName", "Phone", "CreatedBy" },
                unique: true);
        }
    }
}
