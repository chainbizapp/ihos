using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ihos.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProviderBrandAlias : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "provider_brand_aliases",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    ProviderCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    RawValue = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CanonicalMakeId = table.Column<Guid>(type: "uuid", nullable: true),
                    Source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Confidence = table.Column<int>(type: "integer", nullable: true),
                    IsVerified = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_provider_brand_aliases", x => x.Id);
                    table.ForeignKey(
                        name: "FK_provider_brand_aliases_vehicle_makes_CanonicalMakeId",
                        column: x => x.CanonicalMakeId,
                        principalTable: "vehicle_makes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_provider_brand_aliases_CanonicalMakeId",
                table: "provider_brand_aliases",
                column: "CanonicalMakeId");

            migrationBuilder.CreateIndex(
                name: "IX_provider_brand_aliases_ProviderCode_RawValue",
                table: "provider_brand_aliases",
                columns: new[] { "ProviderCode", "RawValue" },
                unique: true);

            // ── Seed for feature 003-brand-alias-mapping ───────────────────────
            // 18 canonical car brands MTI sends that the DB didn't have yet.
            // INSERT WHERE NOT EXISTS so re-running is safe and we don't duplicate any brand
            // that happened to be added by another path.
            migrationBuilder.Sql(@"
                INSERT INTO vehicle_makes (""Id"", ""Name"", ""CreatedAt"", ""UpdatedAt"", ""IsDeleted"")
                SELECT gen_random_uuid(), v.name, now(), now(), false
                FROM (VALUES
                    ('Alfa Romeo'), ('DeLorean'), ('Denza'), ('GAC'), ('Geely'),
                    ('Lumin'), ('Morris'), ('Lada Niva'), ('Perodua'), ('Picaso'),
                    ('Rolls-Royce'), ('Simca'), ('Smart'), ('Spyker'), ('Thairung'),
                    ('Valiant'), ('Villy'), ('Wey')
                ) AS v(name)
                WHERE NOT EXISTS (
                    SELECT 1 FROM vehicle_makes m
                    WHERE UPPER(m.""Name"") = UPPER(v.name) AND m.""IsDeleted"" = false
                );
            ");

            // 21 MTI brand aliases → canonical make (resolved by name).
            // All car-only, human-curated from the POC, so Source=Human / IsVerified=true.
            // Re-runnable via NOT EXISTS on (ProviderCode, RawValue).
            migrationBuilder.Sql(@"
                INSERT INTO provider_brand_aliases
                    (""Id"", ""ProviderCode"", ""RawValue"", ""CanonicalMakeId"", ""Source"", ""Confidence"", ""IsVerified"", ""CreatedAt"", ""UpdatedAt"", ""IsDeleted"")
                SELECT gen_random_uuid(), 'MTI', a.raw,
                       (SELECT m.""Id"" FROM vehicle_makes m WHERE UPPER(m.""Name"") = UPPER(a.canonical) AND m.""IsDeleted"" = false LIMIT 1),
                       'Human', 100, true, now(), now(), false
                FROM (VALUES
                    ('ISUZ','Isuzu'), ('MUSSO','Ssangyong'), ('MINE','Mine Mobility'),
                    ('ALFA ROMEO','Alfa Romeo'), ('DELOREAN','DeLorean'), ('DENZA','Denza'),
                    ('GAC','GAC'), ('GEELY','Geely'), ('LUMIN','Lumin'), ('MORRIS','Morris'),
                    ('NIVA','Lada Niva'), ('PERODUA','Perodua'), ('PICASO','Picaso'),
                    ('ROLLS-ROYCE','Rolls-Royce'), ('SIMCA','Simca'), ('SMART','Smart'),
                    ('SPYKER','Spyker'), ('THAIRUNG','Thairung'), ('VALIANT','Valiant'),
                    ('VILLY','Villy'), ('WEY','Wey')
                ) AS a(raw, canonical)
                WHERE NOT EXISTS (
                    SELECT 1 FROM provider_brand_aliases p
                    WHERE p.""ProviderCode"" = 'MTI' AND p.""RawValue"" = a.raw
                );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "provider_brand_aliases");
        }
    }
}
