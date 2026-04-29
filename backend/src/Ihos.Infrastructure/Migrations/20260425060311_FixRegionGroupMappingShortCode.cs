using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ihos.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FixRegionGroupMappingShortCode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "region_group_mappings",
                keyColumn: "Id",
                keyValue: 1,
                column: "CompanyShortCode",
                value: "ALA");

            migrationBuilder.UpdateData(
                table: "region_group_mappings",
                keyColumn: "Id",
                keyValue: 2,
                column: "CompanyShortCode",
                value: "ALA");

            migrationBuilder.UpdateData(
                table: "region_group_mappings",
                keyColumn: "Id",
                keyValue: 3,
                column: "CompanyShortCode",
                value: "ALA");

            migrationBuilder.UpdateData(
                table: "region_group_mappings",
                keyColumn: "Id",
                keyValue: 4,
                column: "CompanyShortCode",
                value: "ALA");

            migrationBuilder.UpdateData(
                table: "region_group_mappings",
                keyColumn: "Id",
                keyValue: 5,
                column: "CompanyShortCode",
                value: "ALA");

            migrationBuilder.UpdateData(
                table: "region_group_mappings",
                keyColumn: "Id",
                keyValue: 6,
                column: "CompanyShortCode",
                value: "ALA");

            migrationBuilder.UpdateData(
                table: "region_group_mappings",
                keyColumn: "Id",
                keyValue: 7,
                column: "CompanyShortCode",
                value: "ALA");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "region_group_mappings",
                keyColumn: "Id",
                keyValue: 1,
                column: "CompanyShortCode",
                value: "ALLIANZ");

            migrationBuilder.UpdateData(
                table: "region_group_mappings",
                keyColumn: "Id",
                keyValue: 2,
                column: "CompanyShortCode",
                value: "ALLIANZ");

            migrationBuilder.UpdateData(
                table: "region_group_mappings",
                keyColumn: "Id",
                keyValue: 3,
                column: "CompanyShortCode",
                value: "ALLIANZ");

            migrationBuilder.UpdateData(
                table: "region_group_mappings",
                keyColumn: "Id",
                keyValue: 4,
                column: "CompanyShortCode",
                value: "ALLIANZ");

            migrationBuilder.UpdateData(
                table: "region_group_mappings",
                keyColumn: "Id",
                keyValue: 5,
                column: "CompanyShortCode",
                value: "ALLIANZ");

            migrationBuilder.UpdateData(
                table: "region_group_mappings",
                keyColumn: "Id",
                keyValue: 6,
                column: "CompanyShortCode",
                value: "ALLIANZ");

            migrationBuilder.UpdateData(
                table: "region_group_mappings",
                keyColumn: "Id",
                keyValue: 7,
                column: "CompanyShortCode",
                value: "ALLIANZ");
        }
    }
}
