using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ihos.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddVehicleMarketValues : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "vehicle_market_values",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    VehicleModelId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductionYear = table.Column<int>(type: "integer", nullable: false),
                    MarketValue = table.Column<decimal>(type: "numeric", nullable: false),
                    Source = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_vehicle_market_values", x => x.Id);
                    table.ForeignKey(
                        name: "FK_vehicle_market_values_vehicle_models_VehicleModelId",
                        column: x => x.VehicleModelId,
                        principalTable: "vehicle_models",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_vehicle_market_values_ProductionYear",
                table: "vehicle_market_values",
                column: "ProductionYear");

            migrationBuilder.CreateIndex(
                name: "IX_vehicle_market_values_VehicleModelId",
                table: "vehicle_market_values",
                column: "VehicleModelId");

            migrationBuilder.CreateIndex(
                name: "IX_vehicle_market_values_VehicleModelId_ProductionYear",
                table: "vehicle_market_values",
                columns: new[] { "VehicleModelId", "ProductionYear" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "vehicle_market_values");
        }
    }
}
