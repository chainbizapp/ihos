// Thai region/province data for the search step-3 area cascade.
// AUTO-DERIVED from the backend seed (Migrations/20260421012655_AddProvinces) — 77 provinces.
// Figma groups Bangkok-metro under "ภาคกลาง" (กทม. shown under Central), so we follow
// Figma here and merge backend's Bangkok region into `central`.
//
// TODO(backend): the /plans/search-aggregated `regionGroup` param vocabulary is unconfirmed.
// Backend RegionGroupMapping seeds use pricing-tier codes (BKK / NE / UPC for Allianz), which
// are NOT the same as the ThaiRegion geography enum. We send the ThaiRegion enum name as a
// best-effort value; confirm the expected vocabulary with the backend team.

export type RegionKey = 'all' | 'central' | 'north' | 'northeast' | 'east' | 'west' | 'south';

export interface RegionOption {
  readonly key: RegionKey;
  readonly label: string;
  /** Value sent to the aggregated search as `regionGroup`. `undefined` = no filter (all). */
  readonly regionGroup?: string;
}

export const REGIONS: readonly RegionOption[] = [
  { key: 'all',       label: 'รวมทุกพื้นที่' },
  { key: 'central',   label: 'ภาคกลาง',                regionGroup: 'Central' },
  { key: 'north',     label: 'ภาคเหนือ',               regionGroup: 'North' },
  { key: 'south',     label: 'ภาคใต้',                 regionGroup: 'South' },
  { key: 'east',      label: 'ภาคตะวันออก',            regionGroup: 'East' },
  { key: 'west',      label: 'ภาคตะวันตก',             regionGroup: 'West' },
  { key: 'northeast', label: 'ภาคตะวันออกเฉียงเหนือ',  regionGroup: 'Northeast' },
];

export const PROVINCES_BY_REGION: Record<Exclude<RegionKey, 'all'>, readonly string[]> = {
  central: ['กรุงเทพมหานคร', 'นครปฐม', 'นนทบุรี', 'ปทุมธานี', 'สมุทรปราการ', 'ชัยนาท', 'นครนายก', 'นครสวรรค์', 'พระนครศรีอยุธยา', 'ลพบุรี', 'สมุทรสงคราม', 'สมุทรสาคร', 'สิงห์บุรี', 'สระบุรี', 'สุพรรณบุรี', 'อ่างทอง', 'อุทัยธานี'],
  north: ['กำแพงเพชร', 'เชียงราย', 'เชียงใหม่', 'น่าน', 'พะเยา', 'พิจิตร', 'พิษณุโลก', 'เพชรบูรณ์', 'แพร่', 'แม่ฮ่องสอน', 'ลำปาง', 'ลำพูน', 'สุโขทัย', 'อุตรดิตถ์'],
  northeast: ['กาฬสินธุ์', 'ขอนแก่น', 'ชัยภูมิ', 'นครพนม', 'นครราชสีมา', 'บึงกาฬ', 'บุรีรัมย์', 'มหาสารคาม', 'มุกดาหาร', 'ยโสธร', 'ร้อยเอ็ด', 'เลย', 'ศรีสะเกษ', 'สกลนคร', 'สุรินทร์', 'หนองคาย', 'หนองบัวลำภู', 'อำนาจเจริญ', 'อุดรธานี', 'อุบลราชธานี'],
  east: ['จันทบุรี', 'ฉะเชิงเทรา', 'ชลบุรี', 'ตราด', 'ปราจีนบุรี', 'ระยอง', 'สระแก้ว'],
  west: ['กาญจนบุรี', 'ตาก', 'ประจวบคีรีขันธ์', 'เพชรบุรี', 'ราชบุรี'],
  south: ['กระบี่', 'ชุมพร', 'ตรัง', 'นครศรีธรรมราช', 'นราธิวาส', 'ปัตตานี', 'พังงา', 'พัทลุง', 'ภูเก็ต', 'ระนอง', 'สงขลา', 'สตูล', 'สุราษฎร์ธานี', 'ยะลา'],
};

/** All 77 provinces, alphabetically sorted (Thai locale). */
export const ALL_PROVINCES: readonly string[] = Object.values(PROVINCES_BY_REGION)
  .flat()
  .sort((a, b) => a.localeCompare(b, 'th'));

/** Provinces for a region key — the full list when `all`. */
export function provincesForRegion(key: RegionKey): readonly string[] {
  return key === 'all' ? ALL_PROVINCES : PROVINCES_BY_REGION[key];
}

/** Region key that contains the given province (defaults to `all` if not found). */
export function regionOfProvince(province: string): RegionKey {
  for (const key of Object.keys(PROVINCES_BY_REGION) as Exclude<RegionKey, 'all'>[]) {
    if (PROVINCES_BY_REGION[key].includes(province)) return key;
  }
  return 'all';
}
