import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SearchApiService, SearchResult } from '../../core/search-api.service';
import { SearchStateService } from '../../core/search-state.service';
import { SearchPreferencesService } from '../../core/search-preferences.service';
import { ResultsComponent } from '../results/results.component';
import { VehicleSelectorComponent, VehicleSelection } from '../../shared/vehicle-selector/vehicle-selector.component';

// ── Design tokens ─────────────────────────────────────────────────────────────

const PLAN_TABS = [
  { value: '', label: 'ทุกชั้น' },
  { value: 'Type1', label: 'ชั้น 1' },
  { value: 'Type2Plus', label: 'ชั้น 2+' },
  { value: 'Type2', label: 'ชั้น 2' },
  { value: 'Type3Plus', label: 'ชั้น 3+' },
  { value: 'Type3', label: 'ชั้น 3' },
];

const SORT_OPTIONS = [
  { value: 'price_asc',        label: 'ราคาต่ำไปสูง' },
  { value: 'sum_insured_desc', label: 'ทุนประกันสูงสุด' },
];

const EXCESS_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'ค่าเสียหาย: ทั้งหมด' },
  { value: 0,    label: 'ไม่มีค่าเสียหาย' },
  { value: 3000, label: 'สูงสุด ฿3,000' },
  { value: 5000, label: 'สูงสุด ฿5,000' },
];

const REPAIR_OPTIONS = [
  { value: 'Garage', label: 'ซ่อมอู่' },
  { value: 'Dealer', label: 'ซ่อมศูนย์' },
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

// ── Step sidebar ──────────────────────────────────────────────────────────────

const QUOTE_STEPS = [
  { icon: 'car',    label: 'Vehicle Info',     sub: 'Tell us about your car',   active: true  },
  { icon: 'shield', label: 'Coverage Plan',    sub: 'Choose your protection',   active: false },
  { icon: 'user',   label: 'Driver Details',   sub: 'Age, experience & record', active: false },
  { icon: 'list',   label: 'Quotation Review', sub: 'Review your quote',        active: false },
  { icon: 'check',  label: 'Review & Pay',     sub: 'Confirm & complete',       active: false },
];

const TRUST_ITEMS = [
  '✓  Instant premium comparison',
  '✓  Licensed insurers only',
  '✓  OIC-approved coverages',
  '✓  24 / 7 claims support',
];

function stepIcon(name: string): string {
  const icons: Record<string, string> = {
    car:    `<path d="M240,112H229.2L201.42,49.5A16,16,0,0,0,186.8,40H69.2a16,16,0,0,0-14.62,9.5L26.8,112H16a8,8,0,0,0,0,16h8v80a16,16,0,0,0,16,16H64a16,16,0,0,0,16-16V192h96v16a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V128h8a8,8,0,0,0,0-16ZM69.2,56H186.8l24.89,56H44.31ZM64,208H40V192H64Zm128,0V192h24v16Zm24-32H40V128H216ZM72,160a12,12,0,1,1,12,12A12,12,0,0,1,72,160Zm100,0a12,12,0,1,1,12,12A12,12,0,0,1,172,160Z"/>`,
    user:   `<path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8C56.32,191.66,80.77,176,128,176s71.68,15.66,89.07,44a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"/>`,
    shield: `<path d="M208,40H48A16,16,0,0,0,32,56V96c0,89.44,75.82,119.34,91,124.39a16,16,0,0,0,10,0C149.18,215.34,225,185.44,225,96V56A16,16,0,0,0,208,40Zm0,56c0,72.34-61.78,99.18-80,105.77C109.78,195.18,48,168.34,48,96V56H208Z"/>`,
    list:   `<path d="M224,128a8,8,0,0,1-8,8H104a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM104,72H216a8,8,0,0,0,0-16H104a8,8,0,0,0,0,16ZM216,184H104a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16ZM44,116a12,12,0,1,0,12,12A12,12,0,0,0,44,116Zm0-56a12,12,0,1,0,12,12A12,12,0,0,0,44,60Zm0,112a12,12,0,1,0,12,12A12,12,0,0,0,44,172Z"/>`,
    check:  `<path d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"/>`,
  };
  const p = icons[name] ?? '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" style="width:100%;height:100%">${p}</svg>`;
}

const CAR_PATH    = `<path d="M240,112H229.2L201.42,49.5A16,16,0,0,0,186.8,40H69.2a16,16,0,0,0-14.62,9.5L26.8,112H16a8,8,0,0,0,0,16h8v80a16,16,0,0,0,16,16H64a16,16,0,0,0,16-16V192h96v16a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V128h8a8,8,0,0,0,0-16ZM69.2,56H186.8l24.89,56H44.31ZM64,208H40V192H64Zm128,0V192h24v16Zm24-32H40V128H216ZM72,160a12,12,0,1,1,12,12A12,12,0,0,1,72,160Zm100,0a12,12,0,1,1,12,12A12,12,0,0,1,172,160Z"/>`;
const PENCIL_PATH = `<path d="M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z"/>`;
const SAVE_PATH   = `<path d="M219.31,68.69l-40-40A16,16,0,0,0,168,24H48A16,16,0,0,0,32,40V216a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V80A16,16,0,0,0,219.31,68.69ZM168,208H88V160h80Zm32,0H184V160a16,16,0,0,0-16-16H88a16,16,0,0,0-16,16v48H48V40H168l32,32Z"/>`;

function svg(path: string, cls = 'w-4 h-4'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="${cls}">${path}</svg>`;
}

// nav = 4rem = 64px; vehicle bar ~53px → filter starts at 117px
@Component({
  selector: 'app-search-page',
  standalone: true,
  imports: [CommonModule, FormsModule, VehicleSelectorComponent, ResultsComponent],
  styles: [`
    .filter-select {
      appearance: none; -webkit-appearance: none;
      background-color: #f0f4fd; border: none; border-radius: 0.75rem;
      padding: 0.5rem 2.25rem 0.5rem 0.875rem;
      font-size: 13px; font-weight: 600; color: #171c22;
      font-family: 'Noto Sans Thai', sans-serif;
      cursor: pointer; outline: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256' fill='%23006874'%3E%3Cpath d='M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 0.625rem center;
      background-size: 14px; transition: background-color 0.15s;
    }
    .filter-select:hover { background-color: #e8eef8; }
    .filter-select:focus { outline: 2px solid rgba(0,104,116,0.2); outline-offset: 1px; }
    .step-connector { width: 2px; height: 24px; margin: 2px auto; border-radius: 1px; }
  `],
  template: `
<div style="background:#f0f4fd;font-family:'Noto Sans Thai',sans-serif;min-height:calc(100vh - 4rem)">
  <div class="flex" style="min-height:calc(100vh - 4rem)">

    <!-- ── Left: Quote Steps sidebar ──────────────────────────────────── -->
    <aside class="hidden lg:flex flex-col w-64 xl:w-72 flex-shrink-0 border-r sticky top-16 self-start overflow-y-auto"
           style="background:#ffffff;border-color:rgba(17,48,105,0.08);height:calc(100vh - 4rem)">
      <div class="flex-1 px-6 pt-8 pb-6">
        <div class="mb-7">
          <div class="text-[10px] font-bold tracking-widest uppercase mb-1" style="color:#49b2c1">Motor Insurance</div>
          <div class="text-[17px] font-extrabold leading-tight" style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
            Complete your<br>motor quote
          </div>
        </div>
        <div class="flex flex-col">
          @for (step of quoteSteps; track step.label; let last = $last) {
            <div class="flex gap-3">
              <div class="flex flex-col items-center">
                <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                     [style]="step.active
                       ? 'background:#006874;color:white;box-shadow:0 2px 8px rgba(0,104,116,0.35)'
                       : 'background:#f0f4fd;color:#a0aec0'">
                  <span class="w-4 h-4" [innerHTML]="stepIcon(step.icon)"></span>
                </div>
                @if (!last) {
                  <div class="step-connector"
                       [style]="step.active ? 'background:#006874;opacity:0.3' : 'background:#e2e8f0'"></div>
                }
              </div>
              <div [class]="last ? 'pb-0 pt-1' : 'pb-5 pt-1'">
                <div class="text-[13px] font-bold leading-tight"
                     [style]="step.active ? 'color:#006874' : 'color:#a0aec0'">{{ step.label }}</div>
                <div class="text-[11px] mt-0.5"
                     [style]="step.active ? 'color:#49b2c1' : 'color:#c4cdd6'">{{ step.sub }}</div>
              </div>
            </div>
          }
        </div>
      </div>
      <div class="px-6 pb-7">
        <div class="h-px mb-5" style="background:rgba(17,48,105,0.07)"></div>
        <button class="w-full py-2.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2"
                style="background:#f0f4fd;color:#5a6270;border:1px solid rgba(17,48,105,0.1)">
          <span [innerHTML]="svg(SAVE_PATH,'w-3.5 h-3.5')"></span>
          Save Progress
        </button>
        <p class="text-center text-[10px] mt-2" style="color:#b0b9c6">Login required to save</p>
      </div>
    </aside>

    <!-- ── Center: results ────────────────────────────────────────────── -->
    <main class="flex-1 min-w-0">

      <!-- Sticky vehicle bar (top-16 = below 64px nav) -->
      <div class="sticky top-16 z-30"
           style="background:rgba(255,255,255,0.9);backdrop-filter:blur(20px);border-bottom:1px solid rgba(17,48,105,0.07);box-shadow:0 2px 12px rgba(17,48,105,0.05)">
        <div class="px-5 py-3.5">
          <div class="flex items-center gap-3 flex-wrap">
            <div class="flex items-center justify-center w-7 h-7 rounded-xl flex-shrink-0"
                 style="background:linear-gradient(135deg,#006874,#49b2c1)">
              <span class="text-white" [innerHTML]="svg(CAR_PATH,'w-4 h-4')"></span>
            </div>
            <span class="font-bold text-[14px]" style="color:#171c22">{{ vehicleDisplayName() }}</span>
            @if (vehicleSelection()?.year) {
              <span class="text-[12px] font-semibold px-2.5 py-0.5 rounded-full"
                    style="background:#e6f4f5;color:#006874">ปี {{ vehicleSelection()!.year }}</span>
            }
            @if (vehicleSelection()?.gearType) {
              <span class="text-[12px] font-medium px-2.5 py-0.5 rounded-full"
                    style="background:#f0f4fd;color:#435d98">{{ vehicleSelection()!.gearType }}</span>
            }
            <button (click)="showSelector.set(!showSelector())"
                    class="ml-auto flex items-center gap-1.5 text-[13px] font-bold"
                    style="color:#006874">
              <span [innerHTML]="svg(PENCIL_PATH,'w-3.5 h-3.5')"></span>
              เปลี่ยนรถ
            </button>
          </div>

          @if (showSelector()) {
            <div class="mt-4 pt-4" style="border-top:1px solid rgba(17,48,105,0.07)">
              <app-vehicle-selector
                layout="horizontal"
                [initialSelection]="vehicleSelection()"
                (selectionChange)="vehicleSelection.set($event)">
              </app-vehicle-selector>
              <div class="flex gap-2 mt-4">
                <button (click)="onSearchClick()"
                        [disabled]="loading() || !vehicleSelection()?.modelId"
                        class="px-6 py-2.5 rounded-2xl text-[13px] font-bold text-white disabled:opacity-50"
                        style="background:linear-gradient(135deg,#006874,#49b2c1);box-shadow:0 2px 8px rgba(0,104,116,0.25)">
                  {{ loading() ? 'กำลังค้นหา...' : 'ค้นหา' }}
                </button>
                <button (click)="showSelector.set(false)"
                        class="px-6 py-2.5 rounded-2xl text-[13px] font-semibold"
                        style="background:#f0f4fd;color:#5a6270">
                  ยกเลิก
                </button>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Sticky filter bar (64 + 53 = 117px) -->
      <div class="sticky z-20 px-5 py-3 flex items-center gap-3 flex-wrap"
           style="top:117px;background:#f0f4fd;border-bottom:1px solid rgba(17,48,105,0.07)">

        <div class="flex items-center gap-1.5 flex-wrap">
          @for (tab of planTabs; track tab.value) {
            <button (click)="onPlanTypeChange(tab.value)"
                    class="px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-all"
                    [style]="activePlanType() === tab.value
                      ? 'background:linear-gradient(135deg,#006874,#49b2c1);color:white;box-shadow:0 2px 8px rgba(0,104,116,0.25)'
                      : 'background:#ffffff;color:#5a6270'">
              {{ tab.label }}
            </button>
          }
        </div>

        <div class="h-5 w-px hidden sm:block" style="background:rgba(17,48,105,0.12)"></div>

        <select [(ngModel)]="repairTypeValue" (ngModelChange)="onRepairTypeChange($event)" class="filter-select">
          @for (opt of repairOptions; track opt.value) { <option [value]="opt.value">{{ opt.label }}</option> }
        </select>

        <select [(ngModel)]="excessIndex" (ngModelChange)="onExcessChange(+$event)" class="filter-select">
          @for (opt of excessOptions; track opt.label; let i = $index) { <option [value]="i">{{ opt.label }}</option> }
        </select>

        <select [(ngModel)]="provinceValue" (ngModelChange)="onProvinceChange($event)" class="filter-select">
          <option value="">จังหวัด: ทั้งหมด</option>
          @for (p of allProvinces; track p) { <option [value]="p">{{ p }}</option> }
        </select>

        <select [(ngModel)]="sortValue" (ngModelChange)="onSortChange($event)" class="filter-select">
          @for (opt of sortOptions; track opt.value) { <option [value]="opt.value">{{ opt.label }}</option> }
        </select>

        <div class="ml-auto text-[13px] font-semibold flex-shrink-0" style="color:#8b95a6">
          @if (result() && !loading()) {
            พบ <span class="font-black" style="color:#171c22">{{ result()!.totalCount }}</span> แผน
          }
        </div>
      </div>

      <!-- Results -->
      <div class="px-5 py-5">
        @if (error()) {
          <div class="px-5 py-4 rounded-2xl text-[14px] font-semibold mb-5"
               style="background:#fff2f2;color:#c0392b;border:1px solid rgba(192,57,43,0.12)">
            {{ error() }}
          </div>
        }
        <app-search-results
          [result]="result()"
          [loading]="loading()"
          (pageChange)="onPageChange($event)"
          (compareNavigate)="onCompareNavigate($event)"
          (quotationNavigate)="onQuotationNavigate($event)" />
      </div>

    </main>

  </div>
</div>
  `,
})
export class SearchPageComponent implements OnInit {
  private readonly searchApi   = inject(SearchApiService);
  private readonly router      = inject(Router);
  private readonly searchState = inject(SearchStateService);
  private readonly prefs       = inject(SearchPreferencesService);

  readonly CAR_PATH    = CAR_PATH;
  readonly PENCIL_PATH = PENCIL_PATH;
  readonly SAVE_PATH   = SAVE_PATH;
  readonly svg         = svg;
  readonly stepIcon    = stepIcon;
  readonly planTabs    = PLAN_TABS;
  readonly sortOptions = SORT_OPTIONS;
  readonly excessOptions = EXCESS_OPTIONS;
  readonly repairOptions = REPAIR_OPTIONS;
  readonly quoteSteps  = QUOTE_STEPS;
  readonly trustItems  = TRUST_ITEMS;
  readonly avatarColors   = ['#006874','#f7941d','#435d98','#49b2c1'];
  readonly avatarInitials = ['A','B','C','D'];

  vehicleSelection = signal<VehicleSelection | null>(null);
  result           = signal<SearchResult | null>(null);
  loading          = signal(false);
  error            = signal<string | null>(null);
  showSelector     = signal(false);

  activePlanType   = signal('');
  activeRepairType = signal('Garage');
  activeExcess     = signal<number | null>(null);
  currentSort      = signal('price_asc');
  currentPage      = signal(1);

  repairTypeValue  = 'Garage';
  excessIndex      = 0;
  sortValue        = 'price_asc';
  provinceValue    = '';
  readonly allProvinces = ALL_PROVINCES;

  vehicleDisplayName = computed(() => {
    const s = this.vehicleSelection();
    if (!s) return '';
    return [s.makeName, s.modelName].filter(Boolean).join(' · ');
  });

  ngOnInit(): void {
    const savedPrefs = this.prefs.load();
    const savedResult = this.searchState.lastResult();
    const lastParams  = this.searchState.lastParams();

    if (!savedPrefs?.modelId) {
      // Nothing selected — go back to home
      this.router.navigate(['/search']);
      return;
    }

    this.vehicleSelection.set({
      makeId:      savedPrefs.makeId,   makeName:    savedPrefs.makeName,
      modelId:     savedPrefs.modelId,  modelName:   savedPrefs.modelName,
      engineCC:    savedPrefs.engineCC, gearType:    savedPrefs.gearType,
      allVariants: savedPrefs.allVariants,
      year:        savedPrefs.vehicleYear,
    });
    this.provinceValue = savedPrefs.province ?? '';

    const sameVehicle = savedResult && lastParams &&
      lastParams.vehicleModelId === savedPrefs.modelId &&
      (lastParams.registrationYear ?? 0) === (savedPrefs.vehicleYear ?? 0);

    if (sameVehicle) {
      // Same vehicle — restore cached result and filters
      this.activePlanType.set(lastParams!.planType ?? '');
      const repair = lastParams!.repairType ?? 'Garage';
      this.activeRepairType.set(repair);
      this.repairTypeValue = repair;
      const excess = (lastParams as any).excessMax ?? null;
      this.activeExcess.set(excess);
      const excessIdx = EXCESS_OPTIONS.findIndex(o => o.value === excess);
      this.excessIndex = excessIdx >= 0 ? excessIdx : 0;
      const sort = this.searchState.lastSort();
      this.currentSort.set(sort);
      this.sortValue = sort;
      this.currentPage.set(this.searchState.lastPage());
      this.result.set(savedResult!);
    } else {
      // Vehicle changed or first arrival — execute fresh search
      this.executeSearch();
    }
  }

  private buildParams() {
    const sel = this.vehicleSelection();
    if (!sel?.modelId) return null;
    return {
      vehicleModelId:   sel.modelId,
      registrationYear: sel.year || 0,
      planType:         this.activePlanType() || undefined,
      repairType:       this.activeRepairType(),
      excessMax:        this.activeExcess() !== null ? this.activeExcess()! : undefined,
      engineCC:         sel.engineCC  || undefined,
      gearType:         sel.gearType  || undefined,
      allVariants:      sel.allVariants || undefined,
      sort:             this.currentSort(),
      page:             this.currentPage(),
    };
  }

  private async executeSearch(): Promise<void> {
    const params = this.buildParams();
    if (!params) return;
    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);
    try {
      const data = await this.searchApi.search(params);
      this.result.set(data);
      this.searchState.save(params, data, this.currentSort(), this.currentPage());
      const sel = this.vehicleSelection()!;
      this.prefs.save({
        makeId: sel.makeId, makeName: sel.makeName,
        modelId: sel.modelId, modelName: sel.modelName,
        engineCC: sel.engineCC, gearType: sel.gearType,
        allVariants: sel.allVariants, vehicleYear: sel.year,
        planType: this.activePlanType(), repairType: this.activeRepairType(),
      });
    } catch (err: any) {
      this.error.set(err?.error?.error ?? 'ค้นหาไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      this.loading.set(false);
    }
  }

  onSearchClick(): void {
    if (!this.vehicleSelection()?.modelId) return;
    this.currentPage.set(1);
    this.showSelector.set(false);
    this.executeSearch();
  }

  onPlanTypeChange(type: string): void {
    this.activePlanType.set(type); this.currentPage.set(1); this.executeSearch();
  }
  onRepairTypeChange(val: string): void {
    this.activeRepairType.set(val); this.currentPage.set(1); this.executeSearch();
  }
  onExcessChange(idx: number): void {
    this.activeExcess.set(EXCESS_OPTIONS[idx]?.value ?? null); this.currentPage.set(1); this.executeSearch();
  }
  onSortChange(sort: string): void {
    this.currentSort.set(sort); this.currentPage.set(1); this.executeSearch();
  }
  onProvinceChange(province: string): void {
    this.provinceValue = province;
    const saved = this.prefs.load();
    if (saved) this.prefs.save({ ...saved, province: province || undefined });
  }
  onPageChange(page: number): void {
    this.currentPage.set(page); this.executeSearch();
  }

  onCompareNavigate(ids: string[]): void {
    this.router.navigate(['/search/compare'], { queryParams: { ids: ids.join(',') } });
  }
  onQuotationNavigate(planId: string): void {
    this.router.navigate(['/quotation/new'], { queryParams: { planId } });
  }
}
