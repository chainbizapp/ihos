import { Component, inject, signal, output, input, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SearchApiService, VehicleMake, VehicleModel } from '../../core/search-api.service';

export interface VehicleSelection {
  makeId: string;
  makeName: string;
  modelId: string;
  modelName: string;
  engineCC?: string;
  gearType?: string;
  allVariants?: boolean;
  year?: number;
}

interface ModelGroup {
  name: string;
  umbrella?: VehicleModel;   // SubModel = null
  trims: VehicleModel[];     // SubModel != null, sorted A–Z
}

/** A sub-model choice presented in the second dropdown. */
interface SubModelOption {
  id: string;            // VehicleModel.id to emit
  label: string;         // Display label
  isAllVariants: boolean;
}

@Component({
  selector: 'app-vehicle-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div [class]="layout() === 'horizontal' ? 'flex flex-row flex-nowrap w-full gap-4 items-end' : 'flex flex-col gap-6'">
      <!-- Make -->
      <div [class]="layout() === 'horizontal' ? 'flex-1 min-w-[120px]' : ''">
        <label class="block text-[11px] font-bold text-[#4a5568] mb-2 uppercase tracking-wide">Make</label>
        <select
          [ngModel]="selectedMakeId()"
          (ngModelChange)="onMakeChange($event)"
          class="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#2d3748] focus:outline-none focus:border-[#006874] transition-colors cursor-pointer appearance-none">
          <option value="" disabled hidden>Select Brand</option>
          @for (make of makes(); track make.id) {
            <option [value]="make.id">{{ make.name }}</option>
          }
        </select>
      </div>

      <!-- Model (base name only) -->
      <div [class]="layout() === 'horizontal' ? 'flex-[1.5] min-w-[140px]' : ''">
        <label class="block text-[11px] font-bold text-[#4a5568] mb-2 uppercase tracking-wide">Model</label>
        <select
          [ngModel]="selectedModelName()"
          (ngModelChange)="onModelNameChange($event)"
          [disabled]="!selectedMakeId() || loadingModels()"
          class="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#2d3748] focus:outline-none focus:border-[#006874] transition-colors cursor-pointer appearance-none disabled:opacity-50 disabled:bg-gray-50 disabled:cursor-not-allowed">
          <option value="" disabled hidden>{{ loadingModels() ? 'Loading...' : 'Select Model' }}</option>
          @for (group of modelGroups(); track group.name) {
            <option [value]="group.name">{{ group.name }}</option>
          }
        </select>
      </div>

      <!-- Year -->
      <div [class]="layout() === 'horizontal' ? 'flex-1 min-w-[100px]' : ''">
        <label class="block text-[11px] font-bold text-[#4a5568] mb-2 uppercase tracking-wide">Year</label>
        <select
          [ngModel]="selectedYear()"
          (ngModelChange)="onYearChange($event)"
          [disabled]="!selectedModelName() || yearOptions().length === 0"
          class="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#2d3748] focus:outline-none focus:border-[#006874] transition-colors cursor-pointer appearance-none disabled:opacity-50 disabled:bg-gray-50 disabled:cursor-not-allowed">
          <option [value]="0">All Years</option>
          @for (yr of yearOptions(); track yr) {
            <option [value]="yr">{{ yr }}</option>
          }
        </select>
      </div>

      <!-- Engine CC -->
      <div [class]="layout() === 'horizontal' ? 'flex-1 min-w-[100px]' : ''">
        <label class="block text-[11px] font-bold text-[#4a5568] mb-2 uppercase tracking-wide">
          Engine CC
        </label>
        <select
          [ngModel]="selectedCC()"
          (ngModelChange)="onCCChange($event)"
          [disabled]="!selectedModelName() || ccOptions().length === 0"
          class="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#2d3748] focus:outline-none focus:border-[#006874] transition-colors cursor-pointer appearance-none disabled:opacity-50 disabled:bg-gray-50 disabled:cursor-not-allowed">
          <option value="">All CC</option>
          @for (cc of ccOptions(); track cc) {
            <option [value]="cc">{{ cc }} L</option>
          }
        </select>
      </div>

      <!-- Gear Type -->
      <div [class]="layout() === 'horizontal' ? 'flex-1 min-w-[120px]' : ''" [style.display]="gearTypeOptions().length === 0 ? 'none' : 'block'">
        <label class="block text-[11px] font-bold text-[#4a5568] mb-2 uppercase tracking-wide">
          Transmission
        </label>
        <select
          [ngModel]="selectedGearType()"
          (ngModelChange)="onGearTypeChange($event)"
          [disabled]="!selectedModelName() || gearTypeOptions().length === 0"
          class="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#2d3748] focus:outline-none focus:border-[#006874] transition-colors cursor-pointer appearance-none disabled:opacity-50 disabled:bg-gray-50 disabled:cursor-not-allowed">
          <option value="">All Gears</option>
          @for (gear of gearTypeOptions(); track gear) {
            <option [value]="gear">{{ gear }}</option>
          }
        </select>
      </div>

      <!-- Sub-model -->
      <div [class]="layout() === 'horizontal' ? 'flex-[1.5] min-w-[160px]' : ''">
        <label class="block text-[11px] font-bold text-[#4a5568] mb-2 uppercase tracking-wide">
          Variant / Sub-model
        </label>
        <select
          [ngModel]="selectedSubModelId()"
          (ngModelChange)="onSubModelChange($event)"
          [disabled]="!selectedModelName() || subModelOptions().length === 0"
          class="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#2d3748] focus:outline-none focus:border-[#006874] transition-colors cursor-pointer appearance-none disabled:opacity-50 disabled:bg-gray-50 disabled:cursor-not-allowed">
          <option value="" disabled hidden>Select Variant</option>
          @for (opt of subModelOptions(); track opt.id) {
            <option [value]="opt.id">{{ opt.label }}</option>
          }
        </select>
      </div>
    </div>
  `
})
export class VehicleSelectorComponent implements OnInit {
  private readonly searchApi = inject(SearchApiService);

  layout = input<'vertical' | 'horizontal'>('vertical');

  makes         = signal<VehicleMake[]>([]);
  models        = signal<VehicleModel[]>([]);
  loadingModels = signal(false);

  // Signal-based selection state so computed() tracks changes reactively
  readonly selectedMakeId     = signal('');
  readonly selectedModelName  = signal('');
  readonly selectedSubModelId = signal('');
  readonly selectedCC         = signal('');
  readonly selectedYear       = signal(0); // 0 = All Years
  readonly selectedGearType   = signal('');

  readonly initialSelection = input<VehicleSelection | null>(null);
  readonly selectionChange  = output<VehicleSelection | null>();

  // ── computed ──────────────────────────────────────────────────────────────

  /** Group flat models by base name, sorted A–Z. */
  readonly modelGroups = computed<ModelGroup[]>(() => {
    const map = new Map<string, ModelGroup>();
    for (const m of this.models()) {
      const key = m.name.trim();
      if (!map.has(key)) map.set(key, { name: key, trims: [] });
      const g = map.get(key)!;
      if (!m.subModel) g.umbrella = m;
      else             g.trims.push(m);
    }
    for (const g of map.values())
      g.trims.sort((a, b) => (a.subModel ?? '').localeCompare(b.subModel ?? ''));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  /** The group that matches the currently selected model name. */
  private readonly selectedGroup = computed<ModelGroup | undefined>(() =>
    this.modelGroups().find(g => g.name === this.selectedModelName())
  );

  /**
   * Year dropdown options for the selected model group.
   * Derived from the min/max year across all trims + umbrella that have plan data.
   * Empty when no plans exist yet for any model in this group.
   */
  readonly yearOptions = computed<number[]>(() => {
    const g = this.selectedGroup();
    if (!g) return [];
    const all = [...(g.umbrella ? [g.umbrella] : []), ...g.trims];
    const mins = all.map(m => m.minYear).filter((y): y is number => y != null);
    const maxs = all.map(m => m.maxYear).filter((y): y is number => y != null);
    if (mins.length === 0 || maxs.length === 0) return [];
    const lo = Math.min(...mins);
    const hi = Math.max(...maxs);
    const years: number[] = [];
    const currentYear = new Date().getFullYear();
    for (let age = lo; age <= hi; age++) {
      years.push(currentYear - age);
    }
    // Sort descending (latest years first)
    return years.sort((a, b) => b - a);
  });

  /**
   * CC options for the current model group, pre-filtered to trims that cover
   * the selected year (so invalid CC options disappear after year selection).
   */
  readonly ccOptions = computed<string[]>(() => {
    const g = this.selectedGroup();
    if (!g) return [];
    const yr = this.selectedYear();
    const all = [...(g.umbrella ? [g.umbrella] : []), ...g.trims]
      .filter(m => this.modelCoversYear(m, yr));
    const ccs = [...new Set(all.map(m => m.engineCC ?? '').filter(cc => cc !== ''))].sort();
    return ccs.length > 1 ? ccs : [];
  });

  /**
   * Gear Type options for the current model group.
   */
  readonly gearTypeOptions = computed<string[]>(() => {
    const g = this.selectedGroup();
    if (!g) return [];
    const yr = this.selectedYear();
    const cc = this.selectedCC();
    const all = [...(g.umbrella ? [g.umbrella] : []), ...g.trims]
      .filter(m => this.modelCoversYear(m, yr))
      .filter(m => !cc || (m.engineCC ?? '') === cc);
    const gears = [...new Set(all.map(m => m.gearType ?? '').filter(g => g !== ''))].sort();
    return gears.length > 1 ? gears : [];
  });

  /**
   * Sub-model options filtered by selected year AND selected CC.
   */
  readonly subModelOptions = computed<SubModelOption[]>(() => {
    const g = this.selectedGroup();
    if (!g) return [];

    const yr = this.selectedYear();
    const cc = this.selectedCC();
    const gear = this.selectedGearType();

    const trims = g.trims
      .filter(t => this.modelCoversYear(t, yr))
      .filter(t => !cc || (t.engineCC ?? '') === cc)
      .filter(t => !gear || (t.gearType ?? '') === gear);

    const opts: SubModelOption[] = [];
    if (trims.length === 0 && !g.umbrella) return [];
    
    // Always provide an "All variants" option. If umbrella doesn't exist, we use a special placeholder.
    if (g.umbrella) {
      opts.push({ id: g.umbrella.id, label: 'All variants', isAllVariants: true });
    } else if (trims.length > 0) {
      opts.push({ id: 'ALL_VARIANTS', label: 'All variants', isAllVariants: true });
    }
    
    for (const t of trims)
      opts.push({ id: t.id, label: t.gearType ? `${t.subModel} (${t.gearType})` : t.subModel!, isAllVariants: false });
    return opts;
  });

  readonly selectedSubModelIsAllVariants = computed(() => {
    if (!this.selectedSubModelId()) return false;
    return this.subModelOptions().find(o => o.id === this.selectedSubModelId())?.isAllVariants ?? false;
  });

  // ── lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void { this.loadMakes(); }

  async loadMakes(): Promise<void> {
    this.makes.set(await this.searchApi.getVehicleMakes());

    const saved = this.initialSelection();
    if (!saved?.makeId) return;

    this.selectedMakeId.set(saved.makeId);
    this.loadingModels.set(true);
    try {
      const models = await this.searchApi.getVehicleModels(saved.makeId);
      this.models.set(models);

      if (saved.modelId) {
        const m = models.find(x => x.id === saved.modelId);
        if (m) {
          this.selectedModelName.set(m.name);
          this.selectedYear.set(saved.year ?? 0);
          this.selectedCC.set(saved.engineCC ?? '');
          this.selectedGearType.set(saved.gearType ?? '');
          // When allVariants:true but the model has no umbrella row, the saved
          // modelId is trims[0].id — but the dropdown option for "All variants"
          // uses the synthetic id 'ALL_VARIANTS'. Match it so the dropdown restores correctly.
          const group = this.modelGroups().find(g => g.name === m.name);
          const subModelId = (saved.allVariants && group && !group.umbrella)
            ? 'ALL_VARIANTS'
            : m.id;
          this.selectedSubModelId.set(subModelId);
          this.selectionChange.emit(saved);
        }
      }
    } finally {
      this.loadingModels.set(false);
    }
  }

  // ── event handlers ────────────────────────────────────────────────────────

  async onMakeChange(makeId: string): Promise<void> {
    this.selectedMakeId.set(makeId);
    this.selectedModelName.set('');
    this.selectedYear.set(0);
    this.selectedCC.set('');
    this.selectedGearType.set('');
    this.selectedSubModelId.set('');
    this.models.set([]);
    this.selectionChange.emit(null);
    if (!makeId) return;

    this.loadingModels.set(true);
    try {
      this.models.set(await this.searchApi.getVehicleModels(makeId));
    } finally {
      this.loadingModels.set(false);
    }
  }

  onModelNameChange(modelName: string): void {
    this.selectedModelName.set(modelName);
    this.selectedYear.set(0);
    this.selectedCC.set('');
    this.selectedGearType.set('');
    this.selectedSubModelId.set('');
    this.selectionChange.emit(null);

    const group = this.modelGroups().find(g => g.name === modelName);
    if (!group) return;

    // No trims at all → auto-select the umbrella immediately.
    if (group.trims.length === 0 && group.umbrella) {
      this.selectedSubModelId.set(group.umbrella.id);
      this.emit(group.umbrella);
    }
  }

  onYearChange(yr: number | string): void {
    const year = Number(yr);
    this.selectedYear.set(year);
    this.selectedCC.set('');
    this.selectedGearType.set('');
    this.selectedSubModelId.set('');
    this.selectionChange.emit(null);
    this.autoSelectIfSingle();
  }

  onCCChange(cc: string): void {
    this.selectedCC.set(cc);
    this.selectedGearType.set('');
    this.selectedSubModelId.set('');
    this.selectionChange.emit(null);
    this.autoSelectIfSingle();
  }

  onGearTypeChange(gear: string): void {
    this.selectedGearType.set(gear);
    this.selectedSubModelId.set('');
    this.selectionChange.emit(null);
    this.autoSelectIfSingle();
  }

  onSubModelChange(modelId: string): void {
    this.selectedSubModelId.set(modelId);
    if (!modelId) { this.selectionChange.emit(null); return; }
    
    if (modelId === 'ALL_VARIANTS') {
      const group = this.selectedGroup();
      if (group && group.trims.length > 0) {
        this.emit(group.trims[0], true);
      }
      return;
    }

    const model = this.models().find(m => m.id === modelId);
    if (model) this.emit(model, false);
  }

  reset(): void {
    this.selectedMakeId.set('');
    this.selectedModelName.set('');
    this.selectedYear.set(0);
    this.selectedCC.set('');
    this.selectedGearType.set('');
    this.selectedSubModelId.set('');
    this.models.set([]);
    this.selectionChange.emit(null);
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  /** Returns true if this model's plan year range covers the given year (0 = no filter). */
  private modelCoversYear(m: VehicleModel, yr: number): boolean {
    if (!yr) return true;
    const lo = m.minYear ?? null;
    const hi = m.maxYear ?? null;
    // If model has no year data at all, keep it visible (don't hide due to missing data)
    if (lo == null && hi == null) return true;

    const currentYear = new Date().getFullYear();
    const age = currentYear - yr;

    return (lo == null || age >= lo) && (hi == null || age <= hi);
  }

  /** Auto-select the sub-model when exactly one option remains after a filter change. */
  private autoSelectIfSingle(): void {
    const opts = this.subModelOptions();
    if (opts.length === 1 && !opts[0].isAllVariants) {
      this.selectedSubModelId.set(opts[0].id);
      const model = this.models().find(m => m.id === opts[0].id);
      if (model) this.emit(model);
      return;
    }

    // No trims remain after filtering → try to auto-select umbrella or matching model
    if (opts.length === 0) {
      const g = this.selectedGroup();
      if (!g) return;
      const yr = this.selectedYear();
      const cc = this.selectedCC();
      const candidate = cc
        ? [...g.trims, ...(g.umbrella ? [g.umbrella] : [])]
            .filter(m => this.modelCoversYear(m, yr))
            .find(m => (m.engineCC ?? '') === cc)
        : g.umbrella;
      if (candidate) {
        this.selectedSubModelId.set(candidate.id);
        this.emit(candidate);
      }
    }
  }

  private emit(model: VehicleModel, isFakeAllVariants: boolean = false): void {
    const make = this.makes().find(m => m.id === this.selectedMakeId());
    if (!make) return;
    const modelName = (!isFakeAllVariants && model.subModel)
      ? `${model.name} ${model.subModel}`
      : model.name;
    const allVariants = isFakeAllVariants || (this.selectedGroup()?.umbrella?.id === model.id);
    const cc = this.selectedCC() || model.engineCC || undefined;
    // When "All variants" is selected, only use an explicit Transmission filter — never inherit from the model
    const gear = allVariants
      ? (this.selectedGearType() || undefined)
      : (this.selectedGearType() || model.gearType || undefined);
    const yr = this.selectedYear() || undefined;
    
    this.selectionChange.emit({ 
      makeId: make.id, 
      makeName: make.name, 
      modelId: model.id, 
      modelName, 
      engineCC: cc, 
      gearType: gear, 
      allVariants,
      year: yr 
    });
  }
}
