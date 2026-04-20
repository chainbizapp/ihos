using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ihos.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCompanyLogoUrl : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LogoUrl",
                table: "insurance_companies",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LogoUrl",
                table: "insurance_companies");
        }
    }
}
