using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Ihos.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProvinces : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "provinces",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    NameTh = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    NameEn = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Region = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_provinces", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "provinces",
                columns: new[] { "Id", "NameEn", "NameTh", "Region" },
                values: new object[,]
                {
                    { 1, "Bangkok", "กรุงเทพมหานคร", "Bangkok" },
                    { 2, "Nakhon Pathom", "นครปฐม", "Bangkok" },
                    { 3, "Nonthaburi", "นนทบุรี", "Bangkok" },
                    { 4, "Pathum Thani", "ปทุมธานี", "Bangkok" },
                    { 5, "Samut Prakan", "สมุทรปราการ", "Bangkok" },
                    { 6, "Kamphaeng Phet", "กำแพงเพชร", "North" },
                    { 7, "Chiang Rai", "เชียงราย", "North" },
                    { 8, "Chiang Mai", "เชียงใหม่", "North" },
                    { 9, "Nan", "น่าน", "North" },
                    { 10, "Phayao", "พะเยา", "North" },
                    { 11, "Phichit", "พิจิตร", "North" },
                    { 12, "Phitsanulok", "พิษณุโลก", "North" },
                    { 13, "Phetchabun", "เพชรบูรณ์", "North" },
                    { 14, "Phrae", "แพร่", "North" },
                    { 15, "Mae Hong Son", "แม่ฮ่องสอน", "North" },
                    { 16, "Lampang", "ลำปาง", "North" },
                    { 17, "Lamphun", "ลำพูน", "North" },
                    { 18, "Sukhothai", "สุโขทัย", "North" },
                    { 19, "Uttaradit", "อุตรดิตถ์", "North" },
                    { 20, "Chai Nat", "ชัยนาท", "Central" },
                    { 21, "Nakhon Nayok", "นครนายก", "Central" },
                    { 22, "Nakhon Sawan", "นครสวรรค์", "Central" },
                    { 23, "Phra Nakhon Si Ayutthaya", "พระนครศรีอยุธยา", "Central" },
                    { 24, "Lop Buri", "ลพบุรี", "Central" },
                    { 25, "Samut Songkhram", "สมุทรสงคราม", "Central" },
                    { 26, "Samut Sakhon", "สมุทรสาคร", "Central" },
                    { 27, "Sing Buri", "สิงห์บุรี", "Central" },
                    { 28, "Saraburi", "สระบุรี", "Central" },
                    { 29, "Suphan Buri", "สุพรรณบุรี", "Central" },
                    { 30, "Ang Thong", "อ่างทอง", "Central" },
                    { 31, "Uthai Thani", "อุทัยธานี", "Central" },
                    { 32, "Kalasin", "กาฬสินธุ์", "Northeast" },
                    { 33, "Khon Kaen", "ขอนแก่น", "Northeast" },
                    { 34, "Chaiyaphum", "ชัยภูมิ", "Northeast" },
                    { 35, "Nakhon Phanom", "นครพนม", "Northeast" },
                    { 36, "Nakhon Ratchasima", "นครราชสีมา", "Northeast" },
                    { 37, "Bueng Kan", "บึงกาฬ", "Northeast" },
                    { 38, "Buri Ram", "บุรีรัมย์", "Northeast" },
                    { 39, "Maha Sarakham", "มหาสารคาม", "Northeast" },
                    { 40, "Mukdahan", "มุกดาหาร", "Northeast" },
                    { 41, "Yasothon", "ยโสธร", "Northeast" },
                    { 42, "Roi Et", "ร้อยเอ็ด", "Northeast" },
                    { 43, "Loei", "เลย", "Northeast" },
                    { 44, "Si Sa Ket", "ศรีสะเกษ", "Northeast" },
                    { 45, "Sakon Nakhon", "สกลนคร", "Northeast" },
                    { 46, "Surin", "สุรินทร์", "Northeast" },
                    { 47, "Nong Khai", "หนองคาย", "Northeast" },
                    { 48, "Nong Bua Lam Phu", "หนองบัวลำภู", "Northeast" },
                    { 49, "Amnat Charoen", "อำนาจเจริญ", "Northeast" },
                    { 50, "Udon Thani", "อุดรธานี", "Northeast" },
                    { 51, "Ubon Ratchathani", "อุบลราชธานี", "Northeast" },
                    { 52, "Chanthaburi", "จันทบุรี", "East" },
                    { 53, "Chachoengsao", "ฉะเชิงเทรา", "East" },
                    { 54, "Chon Buri", "ชลบุรี", "East" },
                    { 55, "Trat", "ตราด", "East" },
                    { 56, "Prachin Buri", "ปราจีนบุรี", "East" },
                    { 57, "Rayong", "ระยอง", "East" },
                    { 58, "Sa Kaeo", "สระแก้ว", "East" },
                    { 59, "Kanchanaburi", "กาญจนบุรี", "West" },
                    { 60, "Tak", "ตาก", "West" },
                    { 61, "Prachuap Khiri Khan", "ประจวบคีรีขันธ์", "West" },
                    { 62, "Phetchaburi", "เพชรบุรี", "West" },
                    { 63, "Ratchaburi", "ราชบุรี", "West" },
                    { 64, "Krabi", "กระบี่", "South" },
                    { 65, "Chumphon", "ชุมพร", "South" },
                    { 66, "Trang", "ตรัง", "South" },
                    { 67, "Nakhon Si Thammarat", "นครศรีธรรมราช", "South" },
                    { 68, "Narathiwat", "นราธิวาส", "South" },
                    { 69, "Pattani", "ปัตตานี", "South" },
                    { 70, "Phang Nga", "พังงา", "South" },
                    { 71, "Phatthalung", "พัทลุง", "South" },
                    { 72, "Phuket", "ภูเก็ต", "South" },
                    { 73, "Ranong", "ระนอง", "South" },
                    { 74, "Songkhla", "สงขลา", "South" },
                    { 75, "Satun", "สตูล", "South" },
                    { 76, "Surat Thani", "สุราษฎร์ธานี", "South" },
                    { 77, "Yala", "ยะลา", "South" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_provinces_NameTh",
                table: "provinces",
                column: "NameTh",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_provinces_Region",
                table: "provinces",
                column: "Region");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "provinces");
        }
    }
}
