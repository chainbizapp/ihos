import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SearchApiService, VehicleMake, VehicleModel } from '../../core/search-api.service';
import { SearchPreferencesService } from '../../core/search-preferences.service';

// ── Recently Viewed ───────────────────────────────────────────────────────────

export interface RecentVehicle {
  makeId: string; makeName: string;
  modelId: string; modelName: string;
  subModel?: string;
  year?: number;
  gearType?: string;
  savedAt: number;
}

const RECENT_KEY = 'ihos_recent_vehicles';
const RECENT_LIMIT = 4;

function loadRecent(): RecentVehicle[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}

function saveRecent(v: RecentVehicle): void {
  let list = loadRecent().filter(r => r.modelId !== v.modelId);
  list = [v, ...list].slice(0, RECENT_LIMIT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

// ── Popular brands (matched by name against API) ──────────────────────────────
const POPULAR_MAKE_NAMES = [
  'Toyota', 'Honda', 'Isuzu', 'Mitsubishi', 'Nissan',
  'Mazda', 'Ford', 'BYD', 'MG',
];

// ── Popular models per brand (matched case-insensitively against API) ─────────
const POPULAR_MODELS: Record<string, string[]> = {
  toyota:     ['Hilux Revo', 'Fortuner', 'Yaris ATIV', 'Yaris Cross', 'Corolla Altis', 'Corolla Cross', 'Camry', 'Vios', 'Alphard'],
  honda:      ['City', 'City Hatchback', 'Civic', 'Accord', 'HR-V', 'CR-V', 'BR-V', 'Jazz', 'Mobilio'],
  isuzu:      ['D-Max', 'MU-X', 'D-Max Hi-Lander', 'D-Max V-Cross', 'D-Max Spark', 'D-Max Cab4', 'MU-X Active', 'MU-X Elegant', 'MU-X Ultimate'],
  mitsubishi: ['Triton', 'Pajero Sport', 'Xpander', 'Xpander Cross', 'Attrage', 'Mirage', 'Outlander PHEV', 'Triton Athlete', 'Triton Single Cab'],
  nissan:     ['Almera', 'Navara', 'Terra', 'Kicks e-Power', 'Sylphy', 'Note', 'March', 'Teana', 'X-Trail'],
  mazda:      ['Mazda2', 'Mazda3', 'CX-3', 'CX-30', 'CX-5', 'CX-8', 'BT-50', 'MX-5', 'CX-60'],
  ford:       ['Ranger', 'Everest', 'Ranger Raptor', 'Ranger Wildtrak', 'Ranger XL', 'Ranger XLS', 'Ranger XLT', 'Everest Sport', 'Everest Titanium'],
  byd:        ['Dolphin', 'Atto 3', 'Seal', 'Sealion 6', 'Sealion 7', 'Yuan Plus', 'Qin Plus', 'Song Plus', 'Dolphin Mini'],
  mg:         ['MG4 Electric', 'MG5', 'MG ZS EV', 'MG HS', 'MG ES', 'MG3 Hybrid+', 'MG VS HEV', 'MG EP', 'Maxus 9'],
};

const MAKE_LOGO: Record<string, string> = {
  toyota: 'logos/toyota.png',
  honda: 'logos/honda.png',
  isuzu: 'logos/isuzu.png',
  mitsubishi: 'logos/mitsubishi.png',
  nissan: 'logos/nissan.png',
  mazda: 'logos/mazda.png',
  ford: 'logos/ford.png',
  byd: 'logos/byd.png',
  mg: 'logos/mg.png',
};

// ── Province data ─────────────────────────────────────────────────────────────

export interface Province { id: string; name: string; shortName: string; count: number }

const POPULAR_PROVINCES: Province[] = [
  { id: 'กรุงเทพมหานคร', name: 'กรุงเทพมหานคร', shortName: 'กทม.',       count: 10_244_144 },
  { id: 'ชลบุรี',         name: 'ชลบุรี',         shortName: 'ชลบุรี',      count:  1_570_782 },
  { id: 'เชียงใหม่',      name: 'เชียงใหม่',      shortName: 'เชียงใหม่',   count:  1_457_217 },
  { id: 'นครราชสีมา',    name: 'นครราชสีมา',    shortName: 'โคราช',       count:  1_368_421 },
  { id: 'ขอนแก่น',        name: 'ขอนแก่น',        shortName: 'ขอนแก่น',     count:    866_989 },
  { id: 'สงขลา',          name: 'สงขลา',          shortName: 'สงขลา',       count:    829_239 },
  { id: 'ระยอง',          name: 'ระยอง',          shortName: 'ระยอง',       count:    744_140 },
  { id: 'อุบลราชธานี',   name: 'อุบลราชธานี',   shortName: 'อุบลฯ',       count:    738_943 },
  { id: 'เชียงราย',       name: 'เชียงราย',       shortName: 'เชียงราย',    count:    738_735 },
];

const ALL_PROVINCES: string[] = [
  'กรุงเทพมหานคร','กระบี่','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร',
  'ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท',
  'ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่','ตรัง',
  'ตราด','ตาก','นครนายก','นครปฐม','นครพนม',
  'นครราชสีมา','นครศรีธรรมราช','นครสวรรค์','นนทบุรี','นราธิวาส',
  'น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์',
  'ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พะเยา','พังงา',
  'พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์',
  'แพร่','ภูเก็ต','มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน',
  'ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง',
  'ราชบุรี','ลพบุรี','ลำปาง','ลำพูน','เลย',
  'ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ',
  'สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี',
  'สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย',
  'หนองบัวลำภู','อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์',
  'อุทัยธานี','อุบลราชธานี',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomSearchId(): string {
  return 'MTR-' + Math.floor(1000 + Math.random() * 9000);
}

function makeAbbr(name: string): string {
  return name.slice(0, 3).toUpperCase();
}

@Component({
  selector: 'app-search-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  
  templateUrl: './search-home.component.html',
  styleUrl: './search-home.component.scss'
})
export class SearchHomeComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly searchApi = inject(SearchApiService);
  private readonly prefs = inject(SearchPreferencesService);

  // ── Data signals ──────────────────────────────────────────────────────────
  makes = signal<VehicleMake[]>([]);
  models = signal<VehicleModel[]>([]);
  loadingModels = signal(false);
  recentVehicles = signal<RecentVehicle[]>([]);

  // ── Wizard state ──────────────────────────────────────────────────────────
  readonly currentStep = signal(1);
  readonly selectedPlanType = signal('');
  readonly selectedRepairType = signal('Garage');

  readonly steps = [
    { n: 1, label: 'เลือกยี่ห้อ' },
    { n: 2, label: 'รุ่นและปี' },
    { n: 3, label: 'ข้อมูลเพิ่มเติม' },
  ];

  readonly planTypeOptions = [
    { value: 'Type1',    label: 'ชั้น 1' },
    { value: 'Type2Plus', label: 'ชั้น 2+' },
    { value: 'Type2',    label: 'ชั้น 2' },
    { value: 'Type3Plus', label: 'ชั้น 3+' },
    { value: 'Type3',    label: 'ชั้น 3' },
  ];

  readonly repairTypeOptions = [
    { value: 'Garage', label: 'ซ่อมอู่' },
    { value: 'Dealer', label: 'ซ่อมศูนย์' },
  ];

  goToStep(n: number): void {
    if (this.canGoToStep(n)) this.currentStep.set(n);
  }

  canGoToStep(n: number): boolean {
    if (n === 1) return true;
    if (n === 2) return !!this.selectedMakeId;
    if (n === 3) return !!this.selectedMakeId && !!this.selectedModelId();
    return false;
  }

  selectMakeStep(makeId: string): void {
    this.selectMake(makeId);
    this.currentStep.set(2);
  }

  // ── Form state ────────────────────────────────────────────────────────────
  selectedMakeId = '';
  readonly selectedModelName = signal('');
  readonly selectedYear = signal(0);
  readonly selectedVariantId = signal('');
  readonly searchId = randomSearchId();

  // ── Brand search / dialog ─────────────────────────────────────────────────
  brandSearch = signal('');   // kept for any remaining references
  showBrandSearch = signal(false);
  showBrandDialog = signal(false);
  dialogSearch = signal('');

  // ── Province ──────────────────────────────────────────────────────────────
  readonly popularProvinces = POPULAR_PROVINCES;
  readonly selectedProvinceId = signal('');
  readonly showProvinceDialog = signal(false);
  readonly dialogProvinceSearch = signal('');

  readonly provinceDialogResults = computed(() => {
    const q = this.dialogProvinceSearch().toLowerCase().trim();
    if (!q) return ALL_PROVINCES;
    return ALL_PROVINCES.filter(p => p.toLowerCase().includes(q));
  });

  isOtherProvince(): boolean {
    const id = this.selectedProvinceId();
    return !!id && !POPULAR_PROVINCES.some(p => p.id === id);
  }

  selectProvince(id: string): void {
    this.selectedProvinceId.set(this.selectedProvinceId() === id ? '' : id);
  }

  openProvinceDialog(): void {
    this.dialogProvinceSearch.set('');
    this.showProvinceDialog.set(true);
  }

  closeProvinceDialog(): void {
    this.showProvinceDialog.set(false);
    this.dialogProvinceSearch.set('');
  }

  selectProvinceFromDialog(name: string): void {
    this.selectedProvinceId.set(name);
    this.closeProvinceDialog();
  }

  readonly popularMakes = computed(() => {
    const all = this.makes();
    return POPULAR_MAKE_NAMES
      .map(name => all.find(m => m.name.toLowerCase() === name.toLowerCase()))
      .filter((m): m is VehicleMake => m != null);
  });

  readonly brandSearchResults = computed(() => {
    const q = this.brandSearch().toLowerCase();
    if (!q) return this.makes();
    return this.makes().filter(m => m.name.toLowerCase().includes(q));
  });

  readonly dialogResults = computed(() => {
    const q = this.dialogSearch().toLowerCase().trim();
    if (!q) return this.makes();
    return this.makes().filter(m => m.name.toLowerCase().includes(q));
  });

  // ── Popular model tiles (step 2) ──────────────────────────────────────────
  /**
   * Returns up to 9 popular model tiles for the selected brand.
   * Matches entries from POPULAR_MODELS against the API model groups by name
   * (case-insensitive). Only includes models that exist in the database.
   *
   * To update popular models per brand, edit the POPULAR_MODELS constant above.
   */
  readonly popularModelTiles = computed(() => {
    const makeName = this.selectedMakeName().toLowerCase();
    const popularNames = POPULAR_MODELS[makeName] ?? [];
    const groups = this.modelGroups();
    return popularNames
      .map(popName => {
        const group = groups.find(g => g.name.toLowerCase() === popName.toLowerCase());
        return { name: popName, groupName: group?.name ?? null };
      })
      .filter((t): t is { name: string; groupName: string } => t.groupName !== null)
      .slice(0, 9);
  });

  // ── Model search dialog (step 2 "รุ่นอื่นๆ") ──────────────────────────────
  readonly showModelDialog = signal(false);
  readonly modelDialogSearch = signal('');
  readonly modelDialogResults = computed(() => {
    const q = this.modelDialogSearch().toLowerCase().trim();
    if (!q) return this.modelGroups();
    return this.modelGroups().filter(g => g.name.toLowerCase().includes(q));
  });

  isPopularModel(): boolean {
    const name = this.selectedModelName();
    return !!name && this.popularModelTiles().some(t => t.groupName === name);
  }

  openModelDialog(): void {
    this.modelDialogSearch.set('');
    this.showModelDialog.set(true);
  }

  closeModelDialog(): void {
    this.showModelDialog.set(false);
    this.modelDialogSearch.set('');
  }

  selectModelFromDialog(name: string): void {
    this.onModelChange(name);
    this.closeModelDialog();
  }

  // Expose module-level helpers to template
  readonly makeAbbr = makeAbbr;
  readonly makeLogo = (name: string) => MAKE_LOGO[name.toLowerCase()] ?? null;

  selectedMakeName(): string {
    return this.makes().find(m => m.id === this.selectedMakeId)?.name ?? '';
  }

  isPopularMake(): boolean {
    const name = this.selectedMakeName().toLowerCase();
    return POPULAR_MAKE_NAMES.some(n => n.toLowerCase() === name);
  }

  selectMake(makeId: string): void {
    this.selectedMakeId = makeId;
    this.showBrandSearch.set(false);
    this.brandSearch.set('');
    this.onMakeChange(makeId);
  }

  openBrandDialog(): void {
    this.dialogSearch.set('');
    this.showBrandDialog.set(true);
  }

  closeBrandDialog(): void {
    this.showBrandDialog.set(false);
    this.dialogSearch.set('');
  }

  selectMakeFromDialog(makeId: string): void {
    this.selectedMakeId = makeId;
    this.closeBrandDialog();
    this.onMakeChange(makeId);
    this.currentStep.set(2);
  }

  // ── Computed options ─────────────────────────────────────────────────────
  readonly modelGroups = computed(() => {
    const map = new Map<string, { name: string; umbrella?: VehicleModel; trims: VehicleModel[] }>();
    for (const m of this.models()) {
      const key = m.name.trim();
      if (!map.has(key)) map.set(key, { name: key, trims: [] });
      const g = map.get(key)!;
      if (!m.subModel) g.umbrella = m;
      else g.trims.push(m);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  private readonly selectedGroup = computed(() =>
    this.modelGroups().find(g => g.name === this.selectedModelName())
  );

  /**
   * Year dropdown options. Backend returns actual registration years (e.g. 2020, 2026)
   * via min/maxYear — NOT vehicle ages — so we list them directly.
   */
  readonly yearOptions = computed<number[]>(() => {
    const g = this.selectedGroup();
    if (!g) return [];
    const all = [...(g.umbrella ? [g.umbrella] : []), ...g.trims];
    const mins = all.map(m => m.minYear).filter((y): y is number => y != null);
    const maxs = all.map(m => m.maxYear).filter((y): y is number => y != null);
    if (mins.length === 0 || maxs.length === 0) return [];
    const lo = Math.min(...mins);   // earliest registration year for this model
    const hi = Math.max(...maxs);   // latest   registration year for this model
    const years: number[] = [];
    for (let y = lo; y <= hi; y++) years.push(y);
    return years.sort((a, b) => b - a); // newest first
  });

  readonly variantOptions = computed(() => {
    const g = this.selectedGroup();
    if (!g) return [];
    const yr = this.selectedYear();

    // minYear/maxYear are real registration years from the backend.
    const coversYear = (m: VehicleModel) => {
      if (!yr) return true;
      const lo = m.minYear ?? 0;
      const hi = m.maxYear ?? 9999;
      return yr >= lo && yr <= hi;
    };

    let trims = g.trims.filter(coversYear);
    // Fallback: if year filter leaves nothing, show all trims
    if (yr && trims.length === 0) trims = g.trims;

    const opts: { id: string; label: string }[] = [];
    // Empty string = "All Variants" sentinel (maps to umbrella/first model in selectedModelId)
    opts.push({ id: '', label: 'All Variants' });
    for (const t of trims) {
      // Label format: "<SubModel> · <CC>cc · <GearType>" — CC is the key disambiguator
      // between trims (e.g. Civic E MODULO 1500 vs 1800), critical for matching against
      // the live MTI/Viriyah catalog. Skip parts that are empty.
      const cc = t.engineCC
        ? `${t.engineCC}${/^\d+$/.test(t.engineCC) ? 'cc' : ''}`
        : '';
      opts.push({
        id: t.id,
        label: [t.subModel, cc, t.gearType].filter(Boolean).join(' · '),
      });
    }
    return opts;
  });

  readonly selectedModelId = computed<string>(() => {
    const g = this.selectedGroup();
    if (!g) return '';
    // Specific trim selected
    if (this.selectedVariantId())
      return this.selectedVariantId();
    // "All Variants" (empty) → umbrella or first trim
    return g.umbrella?.id ?? g.trims[0]?.id ?? '';
  });

  // ─────────────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.searchApi.getVehicleMakes().then(m => this.makes.set(m));
    this.recentVehicles.set(loadRecent());

    // Restore last selection
    const saved = this.prefs.load();
    if (saved?.makeId) {
      this.selectedMakeId = saved.makeId;
      this.loadModels(saved.makeId).then(() => {
        this.selectedModelName.set(saved.modelName ?? '');
        this.selectedYear.set(saved.vehicleYear ?? 0);
      });
    }
    if (saved?.province) {
      this.selectedProvinceId.set(saved.province);
    }
  }

  private async loadModels(makeId: string): Promise<void> {
    this.loadingModels.set(true);
    this.models.set([]);
    this.selectedModelName.set('');
    this.selectedYear.set(0);
    this.selectedVariantId.set('');
    try {
      this.models.set(await this.searchApi.getVehicleModels(makeId));
    } finally {
      this.loadingModels.set(false);
    }
  }

  onMakeChange(makeId: string): void {
    if (!makeId) { this.models.set([]); return; }
    this.loadModels(makeId);
  }

  onModelChange(name: string): void {
    this.selectedModelName.set(name);
    this.selectedYear.set(0);
    this.selectedVariantId.set('');
  }

  onSearch(): void {
    const modelId = this.selectedModelId();
    if (!modelId) return;

    const make = this.makes().find(m => m.id === this.selectedMakeId);
    const group = this.selectedGroup();
    const year = this.selectedYear() || undefined;
    const variantId = this.selectedVariantId();

    // Save to prefs
    this.prefs.save({
      makeId: this.selectedMakeId,
      makeName: make?.name ?? '',
      modelId,
      modelName: this.selectedModelName(),
      engineCC: undefined,
      gearType: undefined,
      allVariants: !variantId || undefined,   // true when "All Variants" selected
      vehicleYear: year,
      province: this.selectedProvinceId() || undefined,
      planType: this.selectedPlanType(),
      repairType: this.selectedRepairType(),
    });

    // Save to recently viewed
    saveRecent({
      makeId: this.selectedMakeId,
      makeName: make?.name ?? '',
      modelId,
      modelName: this.selectedModelName(),
      subModel: variantId
        ? group?.trims.find((m: VehicleModel) => m.id === variantId)?.subModel
        : undefined,
      year,
      gearType: undefined,
      savedAt: Date.now(),
    });

    this.router.navigate(['/search/results']);
  }

  loadRecent(v: RecentVehicle): void {
    this.prefs.save({
      makeId: v.makeId,
      makeName: v.makeName,
      modelId: v.modelId,
      modelName: v.modelName,
      vehicleYear: v.year,
      gearType: v.gearType,
      planType: '',
      repairType: 'Garage',
    });
    this.router.navigate(['/search/results']);
  }
}
