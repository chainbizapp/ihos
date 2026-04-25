using Ihos.Domain.Entities;
using Ihos.Domain.Enums;

namespace Ihos.Infrastructure.Persistence;

/// <summary>
/// Seed data for all 77 Thai provinces grouped by region
/// as defined by the Thai insurance industry zone classification.
/// </summary>
internal static class ProvinceSeeder
{
    public static readonly Province[] All =
    [
        // ── กรุงเทพและปริมณฑลฯ (Bangkok Metropolitan) ─────────────────────────
        new() { Id =  1, NameTh = "กรุงเทพมหานคร",       NameEn = "Bangkok",                      Region = ThaiRegion.Bangkok },
        new() { Id =  2, NameTh = "นครปฐม",              NameEn = "Nakhon Pathom",                Region = ThaiRegion.Bangkok },
        new() { Id =  3, NameTh = "นนทบุรี",              NameEn = "Nonthaburi",                   Region = ThaiRegion.Bangkok },
        new() { Id =  4, NameTh = "ปทุมธานี",             NameEn = "Pathum Thani",                 Region = ThaiRegion.Bangkok },
        new() { Id =  5, NameTh = "สมุทรปราการ",          NameEn = "Samut Prakan",                 Region = ThaiRegion.Bangkok },

        // ── ภาคเหนือ (North) ─────────────────────────────────────────────────
        new() { Id =  6, NameTh = "กำแพงเพชร",           NameEn = "Kamphaeng Phet",               Region = ThaiRegion.North },
        new() { Id =  7, NameTh = "เชียงราย",             NameEn = "Chiang Rai",                   Region = ThaiRegion.North },
        new() { Id =  8, NameTh = "เชียงใหม่",            NameEn = "Chiang Mai",                   Region = ThaiRegion.North },
        new() { Id =  9, NameTh = "น่าน",                 NameEn = "Nan",                          Region = ThaiRegion.North },
        new() { Id = 10, NameTh = "พะเยา",                NameEn = "Phayao",                       Region = ThaiRegion.North },
        new() { Id = 11, NameTh = "พิจิตร",               NameEn = "Phichit",                      Region = ThaiRegion.North },
        new() { Id = 12, NameTh = "พิษณุโลก",             NameEn = "Phitsanulok",                  Region = ThaiRegion.North },
        new() { Id = 13, NameTh = "เพชรบูรณ์",            NameEn = "Phetchabun",                   Region = ThaiRegion.North },
        new() { Id = 14, NameTh = "แพร่",                 NameEn = "Phrae",                        Region = ThaiRegion.North },
        new() { Id = 15, NameTh = "แม่ฮ่องสอน",           NameEn = "Mae Hong Son",                 Region = ThaiRegion.North },
        new() { Id = 16, NameTh = "ลำปาง",                NameEn = "Lampang",                      Region = ThaiRegion.North },
        new() { Id = 17, NameTh = "ลำพูน",                NameEn = "Lamphun",                      Region = ThaiRegion.North },
        new() { Id = 18, NameTh = "สุโขทัย",              NameEn = "Sukhothai",                    Region = ThaiRegion.North },
        new() { Id = 19, NameTh = "อุตรดิตถ์",            NameEn = "Uttaradit",                    Region = ThaiRegion.North },

        // ── ภาคกลาง (Central) ────────────────────────────────────────────────
        new() { Id = 20, NameTh = "ชัยนาท",               NameEn = "Chai Nat",                     Region = ThaiRegion.Central },
        new() { Id = 21, NameTh = "นครนายก",              NameEn = "Nakhon Nayok",                 Region = ThaiRegion.Central },
        new() { Id = 22, NameTh = "นครสวรรค์",            NameEn = "Nakhon Sawan",                 Region = ThaiRegion.Central },
        new() { Id = 23, NameTh = "พระนครศรีอยุธยา",     NameEn = "Phra Nakhon Si Ayutthaya",    Region = ThaiRegion.Central },
        new() { Id = 24, NameTh = "ลพบุรี",               NameEn = "Lop Buri",                     Region = ThaiRegion.Central },
        new() { Id = 25, NameTh = "สมุทรสงคราม",          NameEn = "Samut Songkhram",              Region = ThaiRegion.Central },
        new() { Id = 26, NameTh = "สมุทรสาคร",            NameEn = "Samut Sakhon",                 Region = ThaiRegion.Central },
        new() { Id = 27, NameTh = "สิงห์บุรี",            NameEn = "Sing Buri",                    Region = ThaiRegion.Central },
        new() { Id = 28, NameTh = "สระบุรี",              NameEn = "Saraburi",                     Region = ThaiRegion.Central },
        new() { Id = 29, NameTh = "สุพรรณบุรี",           NameEn = "Suphan Buri",                  Region = ThaiRegion.Central },
        new() { Id = 30, NameTh = "อ่างทอง",              NameEn = "Ang Thong",                    Region = ThaiRegion.Central },
        new() { Id = 31, NameTh = "อุทัยธานี",            NameEn = "Uthai Thani",                  Region = ThaiRegion.Central },

        // ── ภาคตะวันออกเฉียงเหนือ (Northeast) ───────────────────────────────
        new() { Id = 32, NameTh = "กาฬสินธุ์",            NameEn = "Kalasin",                      Region = ThaiRegion.Northeast },
        new() { Id = 33, NameTh = "ขอนแก่น",              NameEn = "Khon Kaen",                    Region = ThaiRegion.Northeast },
        new() { Id = 34, NameTh = "ชัยภูมิ",              NameEn = "Chaiyaphum",                   Region = ThaiRegion.Northeast },
        new() { Id = 35, NameTh = "นครพนม",               NameEn = "Nakhon Phanom",                Region = ThaiRegion.Northeast },
        new() { Id = 36, NameTh = "นครราชสีมา",           NameEn = "Nakhon Ratchasima",            Region = ThaiRegion.Northeast },
        new() { Id = 37, NameTh = "บึงกาฬ",               NameEn = "Bueng Kan",                    Region = ThaiRegion.Northeast },
        new() { Id = 38, NameTh = "บุรีรัมย์",            NameEn = "Buri Ram",                     Region = ThaiRegion.Northeast },
        new() { Id = 39, NameTh = "มหาสารคาม",            NameEn = "Maha Sarakham",                Region = ThaiRegion.Northeast },
        new() { Id = 40, NameTh = "มุกดาหาร",             NameEn = "Mukdahan",                     Region = ThaiRegion.Northeast },
        new() { Id = 41, NameTh = "ยโสธร",                NameEn = "Yasothon",                     Region = ThaiRegion.Northeast },
        new() { Id = 42, NameTh = "ร้อยเอ็ด",             NameEn = "Roi Et",                       Region = ThaiRegion.Northeast },
        new() { Id = 43, NameTh = "เลย",                  NameEn = "Loei",                         Region = ThaiRegion.Northeast },
        new() { Id = 44, NameTh = "ศรีสะเกษ",             NameEn = "Si Sa Ket",                    Region = ThaiRegion.Northeast },
        new() { Id = 45, NameTh = "สกลนคร",               NameEn = "Sakon Nakhon",                 Region = ThaiRegion.Northeast },
        new() { Id = 46, NameTh = "สุรินทร์",             NameEn = "Surin",                        Region = ThaiRegion.Northeast },
        new() { Id = 47, NameTh = "หนองคาย",              NameEn = "Nong Khai",                    Region = ThaiRegion.Northeast },
        new() { Id = 48, NameTh = "หนองบัวลำภู",          NameEn = "Nong Bua Lam Phu",             Region = ThaiRegion.Northeast },
        new() { Id = 49, NameTh = "อำนาจเจริญ",           NameEn = "Amnat Charoen",                Region = ThaiRegion.Northeast },
        new() { Id = 50, NameTh = "อุดรธานี",             NameEn = "Udon Thani",                   Region = ThaiRegion.Northeast },
        new() { Id = 51, NameTh = "อุบลราชธานี",          NameEn = "Ubon Ratchathani",             Region = ThaiRegion.Northeast },

        // ── ภาคตะวันออก (East) ───────────────────────────────────────────────
        new() { Id = 52, NameTh = "จันทบุรี",             NameEn = "Chanthaburi",                  Region = ThaiRegion.East },
        new() { Id = 53, NameTh = "ฉะเชิงเทรา",          NameEn = "Chachoengsao",                 Region = ThaiRegion.East },
        new() { Id = 54, NameTh = "ชลบุรี",               NameEn = "Chon Buri",                    Region = ThaiRegion.East },
        new() { Id = 55, NameTh = "ตราด",                 NameEn = "Trat",                         Region = ThaiRegion.East },
        new() { Id = 56, NameTh = "ปราจีนบุรี",           NameEn = "Prachin Buri",                 Region = ThaiRegion.East },
        new() { Id = 57, NameTh = "ระยอง",                NameEn = "Rayong",                       Region = ThaiRegion.East },
        new() { Id = 58, NameTh = "สระแก้ว",              NameEn = "Sa Kaeo",                      Region = ThaiRegion.East },

        // ── ภาคตะวันตก (West) ────────────────────────────────────────────────
        new() { Id = 59, NameTh = "กาญจนบุรี",            NameEn = "Kanchanaburi",                 Region = ThaiRegion.West },
        new() { Id = 60, NameTh = "ตาก",                  NameEn = "Tak",                          Region = ThaiRegion.West },
        new() { Id = 61, NameTh = "ประจวบคีรีขันธ์",      NameEn = "Prachuap Khiri Khan",          Region = ThaiRegion.West },
        new() { Id = 62, NameTh = "เพชรบุรี",             NameEn = "Phetchaburi",                  Region = ThaiRegion.West },
        new() { Id = 63, NameTh = "ราชบุรี",              NameEn = "Ratchaburi",                   Region = ThaiRegion.West },

        // ── ภาคใต้ (South) ───────────────────────────────────────────────────
        new() { Id = 64, NameTh = "กระบี่",               NameEn = "Krabi",                        Region = ThaiRegion.South },
        new() { Id = 65, NameTh = "ชุมพร",                NameEn = "Chumphon",                     Region = ThaiRegion.South },
        new() { Id = 66, NameTh = "ตรัง",                 NameEn = "Trang",                        Region = ThaiRegion.South },
        new() { Id = 67, NameTh = "นครศรีธรรมราช",        NameEn = "Nakhon Si Thammarat",          Region = ThaiRegion.South },
        new() { Id = 68, NameTh = "นราธิวาส",             NameEn = "Narathiwat",                   Region = ThaiRegion.South },
        new() { Id = 69, NameTh = "ปัตตานี",              NameEn = "Pattani",                      Region = ThaiRegion.South },
        new() { Id = 70, NameTh = "พังงา",                NameEn = "Phang Nga",                    Region = ThaiRegion.South },
        new() { Id = 71, NameTh = "พัทลุง",               NameEn = "Phatthalung",                  Region = ThaiRegion.South },
        new() { Id = 72, NameTh = "ภูเก็ต",               NameEn = "Phuket",                       Region = ThaiRegion.South },
        new() { Id = 73, NameTh = "ระนอง",                NameEn = "Ranong",                       Region = ThaiRegion.South },
        new() { Id = 74, NameTh = "สงขลา",                NameEn = "Songkhla",                     Region = ThaiRegion.South },
        new() { Id = 75, NameTh = "สตูล",                 NameEn = "Satun",                        Region = ThaiRegion.South },
        new() { Id = 76, NameTh = "สุราษฎร์ธานี",         NameEn = "Surat Thani",                  Region = ThaiRegion.South },
        new() { Id = 77, NameTh = "ยะลา",                 NameEn = "Yala",                         Region = ThaiRegion.South },
    ];
}
