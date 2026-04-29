using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ihos.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEngineCCToVehicleModelUniqueKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_vehicle_models_MakeId_Name_SubModel_GearType",
                table: "vehicle_models");

            migrationBuilder.CreateIndex(
                name: "IX_vehicle_models_MakeId_Name_SubModel_GearType_EngineCC",
                table: "vehicle_models",
                columns: new[] { "MakeId", "Name", "SubModel", "GearType", "EngineCC" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_vehicle_models_MakeId_Name_SubModel_GearType_EngineCC",
                table: "vehicle_models");

            migrationBuilder.CreateIndex(
                name: "IX_vehicle_models_MakeId_Name_SubModel_GearType",
                table: "vehicle_models",
                columns: new[] { "MakeId", "Name", "SubModel", "GearType" },
                unique: true);
        }
    }
}
