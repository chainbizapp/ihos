import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SearchApiService, InsurancePlanDetail } from '../../core/search-api.service';

interface CoverageRow {
  section?: string;
  label: string;
  thai?: string;
  get: (p: InsurancePlanDetail) => number | null | undefined;
}

const COVERAGE_ROWS: CoverageRow[] = [
  { section: 'ความรับผิดชอบต่อคู่กรณี (Third Party Liability)', label: '', thai: '', get: () => null },
  { label: '1. เสียชีวิต/บาดเจ็บทางร่างกาย ต่อ คน',     thai: 'TPBI / person',     get: p => p.tpbiPerPerson },
  { label: '   ต่อ ครั้ง',                                  thai: 'TPBI / accident',   get: p => p.tpbiPerAccident },
  { label: '2. ความเสียหายต่อทรัพย์สินคู่กรณี',            thai: 'TPPD',              get: p => p.tppd },
  { section: 'ความคุ้มครองต่อทรัพย์สิน (Own Damage)', label: '', thai: '', get: () => null },
  { label: '3. ความเสียหาย (ทุนประกันภัย)',                 thai: 'Sum Insured',       get: p => p.sumInsured },
  { label: '4. ความเสียหายส่วนแรก (Deductible)',            thai: 'Excess',            get: p => p.excessAmount },
  { label: '5. รถยนต์สูญหาย/ไฟไหม้',                       thai: 'Fire & Theft',      get: p => p.fireTheft },
  { section: 'ความคุ้มครองเพิ่มเติม (Additional Coverage)', label: '', thai: '', get: () => null },
  { label: '6. อุบัติเหตุส่วนบุคคล (ผู้ขับขี่)',            thai: 'Driver PA',         get: p => p.personalAccident },
  { label: '   อุบัติเหตุส่วนบุคคล (ผู้โดยสาร)',            thai: 'Passenger PA',      get: p => p.passengerAccident },
  { label: '7. ค่ารักษาพยาบาล',                             thai: 'Medical',           get: p => p.medicalExpenses },
  { label: '8. ประกันตัวผู้ขับขี่',                          thai: 'Bail Bond',         get: p => p.bailBond },
  { section: 'เบี้ยประกัน (Premium)', label: '', thai: '', get: () => null },
  { label: 'เบี้ยประกันภัยรวมภาษีอากร',                      thai: 'Total Premium',     get: p => p.premiumTotal },
];

const QUOTE_STEPS = [
  { icon: 'car',    label: 'Vehicle Info',   sub: 'Tell us about your car',   active: false },
  { icon: 'shield', label: 'Coverage Plan',  sub: 'Choose your protection',   active: true  },
  { icon: 'user',   label: 'Driver Details', sub: 'Age, experience & record', active: false },
  { icon: 'list',   label: 'Quotation Review', sub: 'Review your quote',        active: false },
  { icon: 'check',  label: 'Review & Pay',   sub: 'Confirm & complete',       active: false },
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

const SAVE_PATH = `<path d="M219.31,68.69l-40-40A16,16,0,0,0,168,24H48A16,16,0,0,0,32,40V216a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V80A16,16,0,0,0,219.31,68.69ZM168,208H88V160h80Zm32,0H184V160a16,16,0,0,0-16-16H88a16,16,0,0,0-16,16v48H48V40H168l32,32Z"/>`;

function svg(path: string, cls = 'w-4 h-4'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="${cls}">${path}</svg>`;
}

@Component({
  selector: 'app-compare',
  standalone: true,
  imports: [CommonModule, RouterLink],
  styles: [`
    .step-connector { width: 2px; height: 24px; margin: 2px auto; border-radius: 1px; }
  `],
  template: `
<div style="background:#f0f4fd;font-family:'Noto Sans Thai',sans-serif;min-height:calc(100vh - 4rem)">

  <!-- ════════ Persistent 3-column shell ════════ -->
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
                <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
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

    <!-- ── Center: compare content ────────────────────────────────────── -->
    <main class="flex-1 min-w-0 px-5 md:px-8 py-8">

      <!-- Page header -->
      <div class="flex items-center gap-3 mb-6">
        <a routerLink="/search"
           class="flex items-center gap-1.5 text-[13px] font-semibold transition-colors"
           style="color:#6b7a8d">
          <svg viewBox="0 0 256 256" fill="currentColor" style="width:14px;height:14px">
            <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"/>
          </svg>
          Back to Search
        </a>
        <div class="h-4 w-px" style="background:rgba(17,48,105,0.15)"></div>
        <h1 class="text-[18px] font-extrabold" style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
          เปรียบเทียบแผนประกัน
        </h1>
        @if (plans().length > 0) {
          <span class="ml-auto text-[12px] font-semibold px-3 py-1 rounded-full"
                style="background:rgba(0,104,116,0.08);color:#006874">
            {{ plans().length }} plans
          </span>
        }
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="flex flex-col items-center justify-center py-24 gap-3">
          <svg class="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none" style="color:#006874">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <div class="text-[13px] font-semibold" style="color:#9aa5b4">Loading comparison...</div>
        </div>
      }

      <!-- Error -->
      @if (!loading() && error()) {
        <div class="px-4 py-3 rounded-xl text-[13px] font-semibold"
             style="background:#fff2f2;color:#c0392b;border:1px solid rgba(192,57,43,0.15)">
          {{ error() }}
        </div>
      }

      <!-- Compare table -->
      @if (!loading() && plans().length > 0) {

        <div class="rounded-2xl overflow-hidden"
             style="box-shadow:0 2px 16px rgba(17,48,105,0.07);border:1px solid rgba(17,48,105,0.09)">
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-sm" style="background:#ffffff">

              <!-- Plan header row -->
              <thead>
                <tr>
                  <th class="text-left px-4 py-3.5 border-b border-r text-[11px] font-bold uppercase tracking-wide w-52"
                      style="background:#f8f9ff;border-color:rgba(17,48,105,0.09);color:#8b95a6">
                    รายละเอียดความคุ้มครอง
                  </th>
                  @for (plan of plans(); track plan.id) {
                    <th class="px-4 py-3.5 border-b border-r text-center"
                        style="background:rgba(246,146,29,0.06);border-color:rgba(17,48,105,0.09)">
                      <div class="text-[14px] font-extrabold" style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
                        {{ plan.companyName }}
                      </div>
                      <div class="text-[11px] font-semibold mt-0.5" style="color:#006874">{{ planLabel(plan) }}</div>
                      <div class="text-[11px] mt-0.5" style="color:#9aa5b4">
                        {{ plan.repairType === 'Dealer' ? 'ซ่อมศูนย์' : 'ซ่อมอู่' }}
                      </div>
                    </th>
                  }
                </tr>
              </thead>

              <tbody>
                @for (row of rows; track $index) {
                  @if (row.section) {
                    <tr>
                      <td [attr.colspan]="plans().length + 1"
                          class="px-4 py-2 text-[11px] font-bold uppercase tracking-wide border-b"
                          style="background:rgba(0,104,116,0.05);color:#006874;border-color:rgba(17,48,105,0.09)">
                        {{ row.section }}
                      </td>
                    </tr>
                  } @else {
                    <tr class="border-b transition-colors"
                        [style]="differs(row)
                          ? 'background:#fffbf0;border-color:rgba(17,48,105,0.07)'
                          : 'background:#ffffff;border-color:rgba(17,48,105,0.06)'"
                        style="border-bottom-style:solid">
                      <td class="px-4 py-2.5 border-r" style="border-color:rgba(17,48,105,0.09)">
                        <div class="text-[13px]" style="color:#4a5568">{{ row.label }}</div>
                        @if (row.thai) {
                          <div class="text-[10px]" style="color:#b0b9c6">{{ row.thai }}</div>
                        }
                      </td>
                      @for (plan of plans(); track plan.id) {
                        <td class="px-4 py-2.5 border-r text-center" style="border-color:rgba(17,48,105,0.06)">
                          <span [class]="cellClass(row, plan)">{{ cellValue(row, plan) }}</span>
                        </td>
                      }
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Get Quote buttons -->
        <div class="mt-5 grid gap-3" [style.grid-template-columns]="'13rem repeat(' + plans().length + ', 1fr)'">
          <div class="flex items-center text-[12px] font-bold uppercase tracking-wide" style="color:#9aa5b4">
            Ready to buy?
          </div>
          @for (plan of plans(); track plan.id) {
            <button (click)="generateQuotation(plan.id)"
                    class="py-3.5 rounded-xl font-bold text-[13px] text-white transition-all active:scale-[0.98]"
                    style="background:linear-gradient(135deg,#f7941d,#e08419);box-shadow:0 3px 12px rgba(247,148,29,0.35)">
              Get Quote<br>
              <span class="text-[11px] font-semibold opacity-85">{{ plan.companyName }}</span>
            </button>
          }
        </div>

      }
    </main>

  </div><!-- end 3-column shell -->

</div>
  `
})
export class CompareComponent implements OnInit {
  private readonly route     = inject(ActivatedRoute);
  private readonly router    = inject(Router);
  private readonly searchApi = inject(SearchApiService);

  plans   = signal<InsurancePlanDetail[]>([]);
  loading = signal(true);
  error   = signal<string | null>(null);

  readonly rows          = COVERAGE_ROWS;
  readonly quoteSteps    = QUOTE_STEPS;
  readonly trustItems    = TRUST_ITEMS;
  readonly stepIcon      = stepIcon;
  readonly svg           = svg;
  readonly SAVE_PATH     = SAVE_PATH;
  readonly avatarColors  = ['#006874','#f7941d','#435d98','#49b2c1'];
  readonly avatarInitials = ['A','B','C','D'];

  async ngOnInit(): Promise<void> {
    const idsParam = this.route.snapshot.queryParamMap.get('ids');
    if (!idsParam) { this.error.set('No plan IDs provided.'); this.loading.set(false); return; }

    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length < 2 || ids.length > 3) {
      this.error.set('Please select 2 or 3 plans to compare.');
      this.loading.set(false);
      return;
    }

    try {
      const result = await this.searchApi.compare(ids);
      this.plans.set(result.plans);
    } catch {
      this.error.set('Failed to load comparison. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  planLabel(plan: InsurancePlanDetail): string {
    const map: Record<string, string> = {
      Type1: 'ชั้น 1', Type2: 'ชั้น 2', Type3: 'ชั้น 3',
      Type2Plus: 'ชั้น 2+', Type3Plus: 'ชั้น 3+'
    };
    return map[plan.planType] ?? plan.planType;
  }

  cellValue(row: CoverageRow, plan: InsurancePlanDetail): string {
    const v = row.get(plan);
    if (v == null) return '—';
    if (v === 0) return '0';
    return v.toLocaleString('th-TH', { maximumFractionDigits: 0 });
  }

  cellClass(row: CoverageRow, plan: InsurancePlanDetail): string {
    const v = row.get(plan);
    if (v == null) return 'text-gray-300 text-[13px]';
    if (v === 0) return 'text-gray-400 text-[13px]';
    if (row.label.includes('เบี้ย'))
      return 'font-bold text-[15px] text-[#1a202c]';
    return 'font-semibold text-[13px] text-[#1a202c]';
  }

  differs(row: CoverageRow): boolean {
    const vals = this.plans().map(p => this.cellValue(row, p));
    return vals.length > 1 && vals.some(v => v !== vals[0]);
  }

  generateQuotation(planId: string): void {
    this.router.navigate(['/quotation/new'], { queryParams: { planId } });
  }
}
