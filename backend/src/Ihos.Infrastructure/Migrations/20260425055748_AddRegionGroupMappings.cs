using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Ihos.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRegionGroupMappings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "region_group_mappings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CompanyShortCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    RegionGroup = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ThaiRegion = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_region_group_mappings", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "region_group_mappings",
                columns: new[] { "Id", "CompanyShortCode", "RegionGroup", "ThaiRegion" },
                values: new object[,]
                {
                    { 1, "ALLIANZ", "BKK", "Bangkok" },
                    { 2, "ALLIANZ", "NE", "Northeast" },
                    { 3, "ALLIANZ", "UPC", "North" },
                    { 4, "ALLIANZ", "UPC", "Central" },
                    { 5, "ALLIANZ", "UPC", "East" },
                    { 6, "ALLIANZ", "UPC", "West" },
                    { 7, "ALLIANZ", "UPC", "South" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_region_group_mappings_CompanyShortCode_RegionGroup",
                table: "region_group_mappings",
                columns: new[] { "CompanyShortCode", "RegionGroup" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "region_group_mappings");
        }
    }
}
