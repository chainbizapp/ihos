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

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomSearchId(): string {
  return 'MTR-' + Math.floor(1000 + Math.random() * 9000);
}

@Component({
  selector: 'app-search-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    .field-label {
      display: block; font-size: 10px; font-weight: 700;
      letter-spacing: 0.08em; text-transform: uppercase;
      color: #6b7a8d; margin-bottom: 6px;
    }
    .field-input, .field-select {
      width: 100%; background: #ffffff;
      border: 1.5px solid #e2e8f0; border-radius: 0.625rem;
      padding: 0.625rem 0.875rem; font-size: 14px;
      font-family: 'Noto Sans Thai', sans-serif; color: #171c22;
      outline: none; transition: border-color 0.15s, box-shadow 0.15s;
    }
    .field-input:focus, .field-select:focus {
      border-color: #006874; box-shadow: 0 0 0 3px rgba(0,104,116,0.1);
    }
    .field-input::placeholder { color: #b0b9c6; }
    .field-select { appearance: none; -webkit-appearance: none; cursor: pointer;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256' fill='%23006874'%3E%3Cpath d='M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 0.75rem center; background-size: 14px;
      padding-right: 2.5rem;
    }
    .field-select:disabled { background-color: #f8f9ff; color: #b0b9c6; cursor: not-allowed; }
    .icon-input-wrap { position: relative; }
    .icon-input-wrap .field-input,
    .icon-input-wrap .field-select { padding-right: 2.75rem; }
    .icon-input-wrap .field-icon {
      position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%);
      color: #9aa5b4; pointer-events: none;
    }
  `],
  template: `
<div style="background:#f0f4fd;font-family:'Noto Sans Thai',sans-serif;min-height:calc(100vh - 4rem)">
  <div class="max-w-6xl mx-auto px-6 py-10 md:py-14">

    <!-- ── Hero headline + Search ID ─────────────────────────────────── -->
    <div class="flex items-start justify-between gap-4 mb-8">
      <div>
        <h1 class="text-[36px] md:text-[44px] font-black leading-[1.1] mb-3"
            style="color:#004d58;font-family:'Plus Jakarta Sans',sans-serif">
          เลือกข้อมูลรถยนต์ของคุณ
        </h1>
        <p class="text-[14px] leading-relaxed max-w-md" style="color:#6b7a8d">
          กรุณาเลือกยี่ห้อรถยนต์ที่คุณต้องการทำประกัน เพื่อรับข้อเสนอที่ดีที่สุด
        </p>
      </div>
      <div class="flex-shrink-0 mt-2">
        <div class="text-[11px] font-bold tracking-widest px-4 py-2 rounded-lg"
             style="background:white;color:#6b7a8d;border:1px solid #e2e8f0;white-space:nowrap">
          SEARCH ID: {{ searchId }}
        </div>
      </div>
    </div>

    <!-- ── 2-column: form + sidebar cards ────────────────────────────── -->
    <div class="grid gap-5" style="grid-template-columns:1fr 280px;align-items:start">

      <!-- Form card -->
      <div class="rounded-2xl p-7" style="background:#ffffff;box-shadow:0 2px 20px rgba(17,48,105,0.07)">

        <!-- Card heading -->
        <div class="flex items-center gap-2.5 mb-6">
          <svg viewBox="0 0 256 256" fill="#f7941d" style="width:22px;height:22px">
            <path d="M240,112H229.2L201.42,49.5A16,16,0,0,0,186.8,40H69.2a16,16,0,0,0-14.62,9.5L26.8,112H16a8,8,0,0,0,0,16h8v80a16,16,0,0,0,16,16H64a16,16,0,0,0,16-16V192h96v16a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V128h8a8,8,0,0,0,0-16ZM69.2,56H186.8l24.89,56H44.31ZM64,208H40V192H64Zm128,0V192h24v16Zm24-32H40V128H216ZM72,160a12,12,0,1,1,12,12A12,12,0,0,1,72,160Zm100,0a12,12,0,1,1,12,12A12,12,0,0,1,172,160Z"/>
          </svg>
          <h2 class="text-[18px] font-extrabold" style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
            Vehicle Specifications
          </h2>
        </div>

        <div class="grid grid-cols-2 gap-x-5 gap-y-5">

          <!-- Brand -->
          <div>
            <label class="field-label">Brand</label>
            <select class="field-select" [(ngModel)]="selectedMakeId" (ngModelChange)="onMakeChange($event)">
              <option value="">Select Manufacturer</option>
              @for (m of makes(); track m.id) {
                <option [value]="m.id">{{ m.name }}</option>
              }
            </select>
          </div>

          <!-- Model -->
          <div>
            <label class="field-label">Model</label>
            <select class="field-select"
                    [ngModel]="selectedModelName()"
                    (ngModelChange)="onModelChange($event)"
                    [disabled]="!selectedMakeId || loadingModels()">
              <option value="">{{ loadingModels() ? 'Loading...' : 'e.g. Camry, Civic' }}</option>
              @for (g of modelGroups(); track g.name) {
                <option [value]="g.name">{{ g.name }}</option>
              }
            </select>
          </div>

          <!-- Year -->
          <div>
            <label class="field-label">Year</label>
            <div class="icon-input-wrap">
              <select class="field-select"
                      [ngModel]="selectedYear()"
                      (ngModelChange)="selectedYear.set(+$event)"
                      [disabled]="yearOptions().length === 0">
                <option [value]="0">Manufacturing Year</option>
                @for (yr of yearOptions(); track yr) {
                  <option [value]="yr">{{ yr }}</option> 
                }
              </select>
              <span class="field-icon">
                <svg viewBox="0 0 256 256" fill="currentColor" style="width:16px;height:16px">
                  <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-96-88a8,8,0,1,1-8-8A8,8,0,0,1,112,120Zm48,0a8,8,0,1,1-8-8A8,8,0,0,1,160,120Zm-96,40a8,8,0,1,1-8-8A8,8,0,0,1,64,160Zm48,0a8,8,0,1,1-8-8A8,8,0,0,1,112,160Zm48,0a8,8,0,1,1-8-8A8,8,0,0,1,160,160Zm-96,40a8,8,0,1,1-8-8A8,8,0,0,1,64,200Zm48,0a8,8,0,1,1-8-8A8,8,0,0,1,112,200Z"/>
                </svg>
              </span>
            </div>
          </div>

          <!-- Trim / Variant -->
          <div>
            <label class="field-label">Trim</label>
            <select class="field-select"
                    [ngModel]="selectedVariantId()"
                    (ngModelChange)="selectedVariantId.set($event)"
                    [disabled]="!selectedModelName()">
              @for (v of variantOptions(); track v.id) {
                <option [value]="v.id">{{ v.label }}</option>
              }
            </select>
          </div>


        </div>

        <!-- Explore button -->
        <button (click)="onSearch()" [disabled]="!selectedModelId()"
                class="w-full mt-7 py-4 rounded-xl text-[15px] font-bold text-white flex items-center justify-center gap-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
                style="background:#006874;box-shadow:0 4px 16px rgba(0,104,116,0.3)">
          Explore Policies
          <svg viewBox="0 0 256 256" fill="currentColor" style="width:18px;height:18px">
            <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"/>
          </svg>
        </button>
      </div>

      <!-- Right info cards -->
      <div class="flex flex-col gap-4">

        <!-- EV card -->
        <div class="rounded-2xl overflow-hidden relative text-white"
             style="background:linear-gradient(150deg,#004d58,#006874 50%,#1a7a6e);min-height:200px;box-shadow:0 4px 20px rgba(0,104,116,0.3)">
          <div class="absolute inset-0 opacity-20"
               style="background:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22><circle cx=%22150%22 cy=%2250%22 r=%22100%22 fill=%22%2349b2c1%22 opacity=%220.4%22/></svg>') center/cover"></div>
          <div class="relative p-5 flex flex-col h-full justify-end" style="min-height:200px">
            <div class="mb-2">
              <span class="text-[10px] font-bold tracking-widest px-2 py-1 rounded"
                    style="background:#f7941d;color:white">MEMBER EXCLUSIVE</span>
            </div>
            <div class="text-[18px] font-black leading-snug mb-1"
                 style="font-family:'Plus Jakarta Sans',sans-serif">
              EV Insurance:<br>The Future is Here
            </div>
            <p class="text-[11px] leading-relaxed" style="color:rgba(255,255,255,0.75)">
              Specialized coverage for high-capacity battery units and specialized motors.
            </p>
          </div>
        </div>

        <!-- Need Assistance card -->
        <div class="rounded-2xl p-5" style="background:#ffffff;box-shadow:0 2px 12px rgba(17,48,105,0.07)">
          <div class="text-[14px] font-extrabold mb-4" style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
            Need Assistance?
          </div>
          <div class="flex flex-col gap-4">
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                   style="background:rgba(246,146,29,0.1)">
                <svg viewBox="0 0 256 256" fill="#f7941d" style="width:16px;height:16px">
                  <path d="M222.37,158.46l-47.11-21.11-.13-.06a16,16,0,0,0-15.17,1.4,8.12,8.12,0,0,0-.75.56L134.87,160c-15.42-7.49-31.34-23.29-38.83-38.51l20.78-24.71c.2-.23.39-.47.57-.72a16,16,0,0,0,1.32-15.06l-.06-.13L97.54,33.64a16,16,0,0,0-16.62-9.52A56.26,56.26,0,0,0,32,80c0,79.4,64.6,144,144,144a56.26,56.26,0,0,0,55.88-48.92A16,16,0,0,0,222.37,158.46Z"/>
                </svg>
              </div>
              <div>
                <div class="text-[13px] font-bold" style="color:#171c22">24/7 Expert Chat</div>
                <div class="text-[11px]" style="color:#9aa5b4">Connect with our insurance advisors instantly.</div>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                   style="background:rgba(0,104,116,0.08)">
                <svg viewBox="0 0 256 256" fill="#006874" style="width:16px;height:16px">
                  <path d="M201.54,54.46A104,104,0,1,0,54.46,201.54,104,104,0,1,0,201.54,54.46ZM128,216a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a16,16,0,1,1,16,16A16,16,0,0,1,112,84Z"/>
                </svg>
              </div>
              <div>
                <div class="text-[13px] font-bold" style="color:#171c22">Help Center</div>
                <div class="text-[11px]" style="color:#9aa5b4">Browse our comprehensive policy guide.</div>
              </div>
            </div>
          </div>
        </div>

      </div><!-- end right cards -->
    </div><!-- end 2-col grid -->

    <!-- ── Recently Viewed Configurations ────────────────────────────── -->
    @if (recentVehicles().length > 0) {
      <div class="mt-10">
        <div class="text-[11px] font-bold tracking-widest uppercase mb-4" style="color:#9aa5b4">
          Recently Viewed Configurations
        </div>
        <div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
          @for (v of recentVehicles(); track v.modelId) {
            <button (click)="loadRecent(v)"
                    class="text-left rounded-xl p-4 transition-all active:scale-[0.98] group"
                    style="background:#ffffff;border:1.5px solid #e8eef4;box-shadow:0 1px 6px rgba(17,48,105,0.05)">
              <div class="text-[11px] font-bold mb-1" style="color:#006874">{{ v.makeName }}</div>
              <div class="text-[15px] font-extrabold leading-snug mb-2" style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
                {{ v.modelName }} {{ v.year ?? '' }}
              </div>
              <div class="flex items-center justify-between">
                <div class="text-[11px]" style="color:#9aa5b4">
                  {{ v.gearType ?? 'Auto' }} • {{ v.subModel ?? '—' }}
                </div>
                <svg viewBox="0 0 256 256" fill="#b0b9c6" style="width:14px;height:14px;flex-shrink:0">
                  <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"/>
                </svg>
              </div>
            </button>
          }
        </div>
      </div>
    }

  </div>
</div>
  `
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

  // ── Form state ────────────────────────────────────────────────────────────
  selectedMakeId = '';
  readonly selectedModelName = signal('');
  readonly selectedYear      = signal(0);
  readonly selectedVariantId = signal('');
  readonly searchId = randomSearchId();

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

  readonly yearOptions = computed<number[]>(() => {
    const g = this.selectedGroup();
    if (!g) return [];
    const all = [...(g.umbrella ? [g.umbrella] : []), ...g.trims];
    const mins = all.map(m => m.minYear).filter((y): y is number => y != null);
    const maxs = all.map(m => m.maxYear).filter((y): y is number => y != null);
    if (mins.length === 0 || maxs.length === 0) return [];
    const lo = Math.min(...mins);   // smallest age → newest car
    const hi = Math.max(...maxs);   // largest age  → oldest car
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let age = lo; age <= hi; age++) years.push(currentYear - age);
    return years.sort((a, b) => b - a);
  });

  readonly variantOptions = computed(() => {
    const g = this.selectedGroup();
    if (!g) return [];
    const yr = this.selectedYear();
    const currentYear = new Date().getFullYear();

    const coversYear = (m: VehicleModel) => {
      if (!yr) return true;
      const newest = m.minYear != null ? currentYear - m.minYear : 9999;
      const oldest = m.maxYear != null ? currentYear - m.maxYear : 0;
      return yr <= newest && yr >= oldest;
    };

    let trims = g.trims.filter(coversYear);
    // Fallback: if year filter leaves nothing, show all trims
    if (yr && trims.length === 0) trims = g.trims;

    const opts: { id: string; label: string }[] = [];
    // Empty string = "All Variants" sentinel (maps to umbrella/first model in selectedModelId)
    opts.push({ id: '', label: 'All Variants' });
    for (const t of trims)
      opts.push({ id: t.id, label: [t.subModel, t.gearType].filter(Boolean).join(' · ') });
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
      vehicleYear: year,
      planType: '',
      repairType: 'Garage',
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
