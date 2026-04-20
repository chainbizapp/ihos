import { Component, inject, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { InsurancePlanSummary, SearchResult } from '../../core/search-api.service';

type Toast = { text: string; id: number };

// A plan row as it appears in the table — the "representative" of a group
interface GroupedPlan extends InsurancePlanSummary {
  groupSize: number;             // 1 = unique plan, >1 = multiple sum-insured tiers
  peers: InsurancePlanSummary[]; // all tiers sorted by premiumTotal asc (includes self at [0])
}

const PLAN_TYPE_LABELS: Record<string, string> = {
  Type1:    'ชั้น 1',
  Type2Plus:'ชั้น 2+',
  Type2:    'ชั้น 2',
  Type3Plus:'ชั้น 3+',
  Type3:    'ชั้น 3',
};

const SEARCH_ICON  = `<path d="M229.66,218.34l-50.07-50.06a88.21,88.21,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/>`;
const SHIELD_ICON  = `<path d="M208,40H48A16,16,0,0,0,32,56v58.77c0,89.61,75.82,119.34,91,124.39a15.53,15.53,0,0,0,10,0c15.2-5.05,91-34.78,91-124.39V56A16,16,0,0,0,208,40Zm0,74.77c0,71.92-55.76,99.08-80,107.15C103.76,213.85,48,186.69,48,114.77V56H208Z"/>`;
const LIST_ICON    = `<path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z"/>`;
const CHART_ICON   = `<path d="M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1,0-16H224A8,8,0,0,1,232,208ZM48,176a8,8,0,0,0,8-8V104a8,8,0,0,0-16,0v64A8,8,0,0,0,48,176Zm40,0a8,8,0,0,0,8-8V64a8,8,0,0,0-16,0V168A8,8,0,0,0,88,176Zm40,0a8,8,0,0,0,8-8V128a8,8,0,0,0-16,0v40A8,8,0,0,0,128,176Zm40,0a8,8,0,0,0,8-8V80a8,8,0,0,0-16,0v88A8,8,0,0,0,168,176Zm40,0a8,8,0,0,0,8-8V40a8,8,0,0,0-16,0V168A8,8,0,0,0,208,176Z"/>`;
const CLOSE_ICON   = `<path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/>`;
const CARET_DOWN   = `<path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"/>`;
const CARET_UP     = `<path d="M213.66,165.66a8,8,0,0,1-11.32,0L128,91.31,53.66,165.66a8,8,0,0,1-11.32-11.32l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,213.66,165.66Z"/>`;

function svgIcon(path: string, cls = 'w-4 h-4'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="${cls}">${path}</svg>`;
}

function yearRangeLabel(min: number, max: number): string {
  return min === max ? `อายุรถ ${min} ปี` : `อายุรถ ${min}–${max} ปี`;
}

/**
 * Within a sorted peer list, merge consecutive records that share the same
 * sumInsured + premiumTotal + excessAmount AND both have min === max (single-year bands).
 * The merged record spans from the lowest to the highest year in the group.
 */
function mergeSingleYearPeers(peers: InsurancePlanSummary[]): InsurancePlanSummary[] {
  const priceKey = (p: InsurancePlanSummary) =>
    `${p.sumInsured}__${p.premiumTotal}__${p.excessAmount}`;

  // Group by price key, preserving insertion order
  const byPrice = new Map<string, InsurancePlanSummary[]>();
  for (const p of peers) {
    const k = priceKey(p);
    if (!byPrice.has(k)) byPrice.set(k, []);
    byPrice.get(k)!.push(p);
  }

  const out: InsurancePlanSummary[] = [];
  for (const [, group] of byPrice) {
    const singles = group.filter(p => p.minYear === p.maxYear);
    const ranges  = group.filter(p => p.minYear !== p.maxYear);

    // Merge all single-year records into one spanning entry
    if (singles.length > 1) {
      const minY = Math.min(...singles.map(p => p.minYear));
      const maxY = Math.max(...singles.map(p => p.maxYear));
      out.push({ ...singles[0], minYear: minY, maxYear: maxY });
    } else {
      out.push(...singles);
    }

    // Keep range records as-is
    out.push(...ranges);
  }

  // Re-sort merged result by minYear asc, then premium asc
  return out.sort((a, b) => a.minYear - b.minYear || a.premiumTotal - b.premiumTotal);
}

// Deterministic palette per company name — all within design system colors
const COMPANY_PALETTES = [
  { bg: '#e6f4f5', text: '#006874' },
  { bg: '#e8eef8', text: '#435d98' },
  { bg: '#fef3e8', text: '#8c4f00' },
  { bg: '#e6f4f5', text: '#0a7a85' },
  { bg: '#eef0fb', text: '#3a4f88' },
  { bg: '#fdf5ec', text: '#a05c00' },
];
function companyPalette(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COMPANY_PALETTES[Math.abs(h) % COMPANY_PALETTES.length];
}

// Group key: same company + planType + repairType + variant → collapse rows that differ ONLY in sumInsured.
// Different submodels or engineCC are kept as separate rows.
function groupKey(p: InsurancePlanSummary): string {
  return `${p.companyName}__${p.planType}__${p.repairType}__${p.vehicleSubModel ?? ''}__${p.vehicleEngineCC ?? ''}`;
}

@Component({
  selector: 'app-search-results',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    .row-hover:hover { background: #f8f9ff; }
    .row-selected    { background: #e6f4f5 !important; }
    .check-active    { background: linear-gradient(135deg,#006874,#49b2c1); border-color: #006874 !important; }
    .badge-pill      { display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:999px;
                       font-size:11px;font-weight:600;background:#e6f4f5;color:#006874; }
    .tier-row        { background:#f8f9ff; }
    .tier-row:hover  { background:#f0f4fd; }
  `],
  template: `

<!-- ── Empty state ───────────────────────────────────────────────────── -->
@if (!result() && !loading()) {
  <div class="flex flex-col items-center justify-center py-24 text-center">
    <div class="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
         style="background:#e6f4f5;color:#006874">
      <span class="w-8 h-8" [innerHTML]="safe(SEARCH_ICON,'w-8 h-8')"></span>
    </div>
    <h3 class="text-[18px] font-black mb-2"
        style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">ยังไม่มีผลการค้นหา</h3>
    <p class="text-[14px]" style="color:#5a6270">เลือกรถและกดค้นหาเพื่อดูแผนประกัน</p>
  </div>
}

<!-- ── No results ────────────────────────────────────────────────────── -->
@if (result() && !loading() && result()!.items.length === 0) {
  <div class="flex flex-col items-center justify-center py-20 text-center rounded-3xl"
       style="background:#ffffff;box-shadow:0px 12px 32px rgba(17,48,105,0.06)">
    <div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
         style="background:#f0f4fd;color:#435d98">
      <span class="w-7 h-7" [innerHTML]="safe(SHIELD_ICON,'w-7 h-7')"></span>
    </div>
    <h3 class="text-[16px] font-bold mb-1" style="color:#171c22">ไม่พบแผนประกัน</h3>
    <p class="text-[13px]" style="color:#5a6270">ลองปรับตัวกรองหรือเปลี่ยนรุ่นรถ</p>
  </div>
}

<!-- ── Table ──────────────────────────────────────────────────────────── -->
@if (loading() || (result() && result()!.items.length > 0)) {
  <div class="rounded-3xl overflow-hidden"
       style="background:#ffffff;box-shadow:0px 12px 32px rgba(17,48,105,0.06)">
    <table class="w-full border-collapse">

      <!-- Header -->
      <thead>
        <tr style="background:#f8f9ff;border-bottom:1px solid rgba(17,48,105,0.07)">
          <th class="w-12 px-5 py-4">
            <div class="w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all"
                 (click)="toggleSelectAll()"
                 [class]="allSelected() ? 'check-active' : ''"
                 [style]="!allSelected() ? 'border-color:rgba(17,48,105,0.25)' : ''">
              @if (allSelected()) {
                <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
              }
            </div>
          </th>
          <th class="text-left px-4 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">ผู้ให้บริการ</th>
          <th class="text-right px-4 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">ทุนประกัน</th>
          <th class="text-right px-4 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">ค่าเสียหาย</th>
          <th class="px-4 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">ความคุ้มครอง</th>
          <th class="text-right px-5 py-4 text-[11px] font-bold uppercase tracking-widest" style="color:#8b95a6">เบี้ยประกัน / ปี</th>
          <th class="w-28 px-4 py-4"></th>
        </tr>
      </thead>

      <tbody>

        <!-- ── Loading skeletons ── -->
        @if (loading()) {
          @for (s of skeletons; track s) {
            <tr style="border-bottom:1px solid rgba(17,48,105,0.06)" class="animate-pulse">
              <td class="px-5 py-5"><div class="w-4 h-4 rounded" style="background:#f0f4fd"></div></td>
              <td class="px-4 py-5">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-2xl flex-shrink-0" style="background:#f0f4fd"></div>
                  <div>
                    <div class="h-3.5 rounded-lg w-36 mb-2" style="background:#f0f4fd"></div>
                    <div class="h-2.5 rounded-lg w-24" style="background:#f8f9ff"></div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-5 text-right"><div class="h-3.5 rounded-lg w-24 ml-auto" style="background:#f0f4fd"></div></td>
              <td class="px-4 py-5 text-right"><div class="h-3.5 rounded-lg w-16 ml-auto" style="background:#f0f4fd"></div></td>
              <td class="px-4 py-5">
                <div class="flex gap-2">
                  <div class="h-5 rounded-full w-20" style="background:#f0f4fd"></div>
                  <div class="h-5 rounded-full w-16" style="background:#f0f4fd"></div>
                </div>
              </td>
              <td class="px-5 py-5 text-right">
                <div class="h-5 rounded-lg w-28 ml-auto mb-1.5" style="background:#f0f4fd"></div>
                <div class="h-3 rounded-lg w-16 ml-auto" style="background:#f8f9ff"></div>
              </td>
              <td class="px-4 py-5"><div class="h-9 rounded-2xl w-20 ml-auto" style="background:#f0f4fd"></div></td>
            </tr>
          }
        }

        <!-- ── Grouped plan rows ── -->
        @if (!loading() && result()) {
          @for (plan of groupedItems(); track plan.id) {

            <!-- Main representative row -->
            <tr style="border-bottom:1px solid rgba(17,48,105,0.06);cursor:pointer;transition:background 0.15s"
                [class]="isSelected(plan.id) ? 'row-selected' : 'row-hover'">

              <!-- Checkbox -->
              <td class="px-5 py-5" (click)="$event.stopPropagation(); selectForCompare(plan)">
                <div class="w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0"
                     [class]="isSelected(plan.id) ? 'check-active' : ''"
                     [style]="isSelected(plan.id) ? '' :
                              isVariantBlocked(plan) ? 'border-color:rgba(17,48,105,0.1);cursor:not-allowed;opacity:0.3' :
                              'border-color:rgba(17,48,105,0.25)'">
                  @if (isSelected(plan.id)) {
                    <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                  }
                </div>
              </td>

              <!-- Provider -->
              <td class="px-4 py-5" (click)="generateQuotation(plan)">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                       [style]="'background:' + palette(plan.companyName).bg">
                    <img [src]="'assets/logos/' + plan.companyShortCode.toLowerCase() + '.png'"
                         [alt]="plan.companyName"
                         class="w-9 h-9 object-contain"
                         (error)="onLogoError($event, plan.companyShortCode, palette(plan.companyName))" />
                  </div>
                  <div>
                    <div class="text-[13px] font-bold leading-tight" style="color:#171c22;font-family:'Noto Sans Thai',sans-serif">
                      {{ plan.companyName }}
                    </div>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      <div class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                           [style]="plan.repairType === 'Dealer' ? 'background:#006874' : 'background:#49b2c1'"></div>
                      <span class="text-[11px] font-medium" style="color:#8b95a6">
                        {{ planTypeLabel(plan.planType) }} · {{ repairTypeLabel(plan.repairType) }}
                      </span>
                    </div>
                    <!-- Vehicle model + variant -->
                    <div class="flex flex-wrap items-center gap-1 mt-1.5">
                      <span class="text-[11px] font-semibold" style="color:#435d98">
                        {{ plan.vehicleMake }} {{ plan.vehicleModel }}
                      </span>
                      @if (plan.vehicleSubModel) {
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold"
                              style="background:#e6f4f5;color:#006874">
                          {{ plan.vehicleSubModel }}
                        </span>
                      }
                      @if (plan.vehicleEngineCC) {
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                              style="background:#f0f4fd;color:#435d98">
                          {{ plan.vehicleEngineCC }}
                        </span>
                      }
                      @if (plan.minYear != null && plan.maxYear != null) {
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                              style="background:#fff3e0;color:#e65100">
                          {{ yearRangeLabel(plan.minYear, plan.maxYear) }}
                        </span>
                      }
                    </div>
                  </div>
                </div>
              </td>

              <!-- Sum insured -->
              <td class="px-4 py-5 text-right" (click)="generateQuotation(plan)">
                <span class="text-[13px] font-semibold" style="color:#171c22">
                  ฿{{ plan.sumInsured | number:'1.0-0' }}
                </span>
              </td>

              <!-- Excess -->
              <td class="px-4 py-5 text-right" (click)="generateQuotation(plan)">
                <span class="text-[13px] font-semibold" style="color:#171c22">
                  {{ plan.excessAmount > 0 ? '฿' + (plan.excessAmount | number:'1.0-0') : 'ไม่มี' }}
                </span>
              </td>

              <!-- Coverage badges -->
              <td class="px-4 py-5" (click)="generateQuotation(plan)">
                <div class="flex flex-wrap gap-1.5">
                  @for (badge of coverageBadges(plan); track badge) {
                    <span class="badge-pill">{{ badge }}</span>
                  }
                  @if (coverageBadges(plan).length === 0) {
                    <span class="text-[12px]" style="color:#c5cdd8">—</span>
                  }
                </div>
              </td>

              <!-- Premium — "เริ่มต้น" when multiple tiers exist -->
              <td class="px-5 py-5 text-right">
                <div (click)="generateQuotation(plan)">
                  @if (plan.groupSize > 1) {
                    <div class="text-[10px] font-bold uppercase tracking-wider mb-0.5" style="color:#8b95a6">เริ่มต้น</div>
                  }
                  <div class="text-[20px] font-black leading-tight"
                       style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
                    ฿{{ plan.premiumTotal | number:'1.0-0' }}
                  </div>
                  <div class="text-[11px] font-medium mt-0.5" style="color:#8b95a6">บาท / ปี</div>
                </div>
                <!-- Expand tiers button -->
                @if (plan.groupSize > 1) {
                  <button (click)="$event.stopPropagation(); toggleTiers(plan.id)"
                          class="flex items-center gap-1 mt-2 ml-auto text-[11px] font-bold rounded-full px-2.5 py-1 transition-all"
                          [style]="expandedGroupId() === plan.id
                            ? 'background:#e6f4f5;color:#006874'
                            : 'background:#f0f4fd;color:#435d98'">
                    {{ plan.groupSize }} ตัวเลือก
                    <span class="w-3 h-3" [innerHTML]="safe(expandedGroupId() === plan.id ? CARET_UP : CARET_DOWN,'w-3 h-3')"></span>
                  </button>
                }
              </td>

              <!-- CTA -->
              <td class="px-4 py-5">
                <div class="flex flex-col items-end gap-2">
                  <button (click)="generateQuotation(plan)"
                          class="px-4 py-2.5 rounded-2xl text-[12px] font-bold text-white transition-all hover:opacity-90 active:scale-95 flex-shrink-0 w-full text-center"
                          style="background:linear-gradient(135deg,#f7941d,#e5850a);box-shadow:0 2px 8px rgba(247,148,29,0.28)">
                    เลือกแผน
                  </button>
                  <button (click)="toggleDetail(plan.id)"
                          class="flex items-center justify-center gap-1 text-[11px] font-bold transition-colors w-full"
                          [style]="expandedPlanId() === plan.id ? 'color:#006874' : 'color:#8b95a6'">
                    <span class="w-3 h-3" [innerHTML]="safe(LIST_ICON,'w-3 h-3')"></span>
                    ดูรายละเอียด
                  </button>
                </div>
              </td>
            </tr>

            <!-- Detail expansion row (coverage breakdown) -->
            @if (expandedPlanId() === plan.id) {
              <tr style="background:#f8f9ff;border-bottom:1px solid rgba(17,48,105,0.06)">
                <td colspan="7" class="px-8 py-5">
                  <div class="grid grid-cols-3 gap-x-8 gap-y-3 text-[12px]">
                    @if (plan.tpbiPerPerson) {
                      <div class="flex justify-between">
                        <span style="color:#8b95a6">ความรับผิดต่อบุคคล/ครั้ง</span>
                        <span class="font-bold" style="color:#171c22">฿{{ plan.tpbiPerPerson | number:'1.0-0' }}</span>
                      </div>
                    }
                    @if (plan.tpbiPerAccident) {
                      <div class="flex justify-between">
                        <span style="color:#8b95a6">ความรับผิดต่อบุคคล/อุบัติ</span>
                        <span class="font-bold" style="color:#171c22">฿{{ plan.tpbiPerAccident | number:'1.0-0' }}</span>
                      </div>
                    }
                    @if (plan.tppd) {
                      <div class="flex justify-between">
                        <span style="color:#8b95a6">ความเสียหายต่อทรัพย์สิน</span>
                        <span class="font-bold" style="color:#171c22">฿{{ plan.tppd | number:'1.0-0' }}</span>
                      </div>
                    }
                    @if (plan.fireTheft) {
                      <div class="flex justify-between">
                        <span style="color:#8b95a6">ไฟไหม้ / โจรกรรม</span>
                        <span class="font-bold" style="color:#171c22">฿{{ plan.fireTheft | number:'1.0-0' }}</span>
                      </div>
                    }
                    @if (plan.personalAccident) {
                      <div class="flex justify-between">
                        <span style="color:#8b95a6">อุบัติเหตุส่วนบุคคล</span>
                        <span class="font-bold" style="color:#171c22">฿{{ plan.personalAccident | number:'1.0-0' }}</span>
                      </div>
                    }
                    @if (plan.passengerAccident) {
                      <div class="flex justify-between">
                        <span style="color:#8b95a6">อุบัติเหตุผู้โดยสาร</span>
                        <span class="font-bold" style="color:#171c22">฿{{ plan.passengerAccident | number:'1.0-0' }}</span>
                      </div>
                    }
                    @if (plan.medicalExpenses) {
                      <div class="flex justify-between">
                        <span style="color:#8b95a6">ค่ารักษาพยาบาล</span>
                        <span class="font-bold" style="color:#171c22">฿{{ plan.medicalExpenses | number:'1.0-0' }}</span>
                      </div>
                    }
                    @if (plan.bailBond) {
                      <div class="flex justify-between">
                        <span style="color:#8b95a6">ประกันตัว</span>
                        <span class="font-bold" style="color:#171c22">฿{{ plan.bailBond | number:'1.0-0' }}</span>
                      </div>
                    }
                    <div class="flex justify-between">
                      <span style="color:#8b95a6">อายุรถที่รับประกัน</span>
                      <span class="font-bold" style="color:#171c22">{{ yearRangeLabel(plan.minYear, plan.maxYear) }}</span>
                    </div>
                  </div>
                  @if (plan.remarks) {
                    <div class="mt-3 pt-3 text-[12px] font-medium"
                         style="border-top:1px solid rgba(17,48,105,0.07);color:#8b95a6">
                      หมายเหตุ: {{ plan.remarks }}
                    </div>
                  }
                </td>
              </tr>
            }

            <!-- Tier expansion rows (other sum-insured options) -->
            @if (expandedGroupId() === plan.id) {
              <!-- Header for tiers -->
              <tr style="background:#f0f4fd;border-bottom:1px solid rgba(17,48,105,0.06)">
                <td colspan="2" class="pl-16 pr-4 py-2">
                  <span class="text-[10px] font-bold uppercase tracking-widest" style="color:#8b95a6">
                    ตัวเลือกทุนประกัน ({{ plan.groupSize }} ตัวเลือก)
                  </span>
                </td>
                <td class="text-right px-4 py-2 text-[10px] font-bold uppercase tracking-widest" style="color:#8b95a6">ทุนประกัน</td>
                <td class="text-right px-4 py-2 text-[10px] font-bold uppercase tracking-widest" style="color:#8b95a6">ค่าเสียหาย</td>
                <td class="px-4 py-2"></td>
                <td class="text-right px-5 py-2 text-[10px] font-bold uppercase tracking-widest" style="color:#8b95a6">เบี้ยประกัน</td>
                <td class="px-4 py-2"></td>
              </tr>

              @for (tier of plan.peers; track tier.id) {
                <tr class="tier-row" style="border-bottom:1px solid rgba(17,48,105,0.05);transition:background 0.12s"
                    [class]="isSelected(tier.id) ? 'row-selected' : ''">

                  <!-- Tier checkbox -->
                  <td class="px-5 py-3.5" (click)="$event.stopPropagation(); selectForCompare(tier)">
                    <div class="w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 cursor-pointer"
                         [class]="isSelected(tier.id) ? 'check-active' : ''"
                         [style]="isSelected(tier.id) ? '' :
                                  isVariantBlocked(tier) ? 'border-color:rgba(17,48,105,0.1);cursor:not-allowed;opacity:0.3' :
                                  'border-color:rgba(17,48,105,0.25)'">
                      @if (isSelected(tier.id)) {
                        <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                      }
                    </div>
                  </td>

                  <!-- Indent + tier label -->
                  <td class="pl-16 pr-4 py-3.5">
                    <div class="flex flex-wrap items-center gap-2">
                      <div class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:#49b2c1"></div>
                      @if (tier.vehicleSubModel) {
                        <span class="text-[12px] font-medium" style="color:#5a6270">{{ tier.vehicleSubModel }}</span>
                      } @else {
                        <span class="text-[12px] font-medium" style="color:#5a6270">ตัวเลือกที่ {{ $index + 1 }}</span>
                      }
                      @if (tier.minYear != null && tier.maxYear != null) {
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                              style="background:#f0f4fd;color:#435d98">
                          {{ yearRangeLabel(tier.minYear, tier.maxYear) }}
                        </span>
                      }
                    </div>
                  </td>

                  <td class="text-right px-4 py-3.5">
                    <span class="text-[13px] font-semibold" style="color:#171c22">฿{{ tier.sumInsured | number:'1.0-0' }}</span>
                  </td>
                  <td class="text-right px-4 py-3.5">
                    <span class="text-[13px] font-semibold" style="color:#171c22">
                      {{ tier.excessAmount > 0 ? '฿' + (tier.excessAmount | number:'1.0-0') : 'ไม่มี' }}
                    </span>
                  </td>
                  <td class="px-4 py-3.5"></td>
                  <td class="text-right px-5 py-3.5">
                    <div class="text-[16px] font-black" style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
                      ฿{{ tier.premiumTotal | number:'1.0-0' }}
                    </div>
                  </td>
                  <td class="px-4 py-3.5">
                    <button (click)="generateQuotation(tier)"
                            class="px-3.5 py-2 rounded-xl text-[12px] font-bold text-white transition-all hover:opacity-90 active:scale-95"
                            style="background:linear-gradient(135deg,#f7941d,#e5850a)">
                      เลือก
                    </button>
                  </td>
                </tr>
              }
            }

          }
        }

      </tbody>
    </table>

    <!-- Pagination footer -->
    @if (result() && !loading()) {
      <div class="flex items-center justify-between px-6 py-4"
           style="background:#f8f9ff;border-top:1px solid rgba(17,48,105,0.07)">
        <span class="text-[12px] font-medium" style="color:#8b95a6">{{ paginationLabel() }}</span>
        <div class="flex gap-2">
          <button (click)="prevPage()"
                  [disabled]="result()!.page <= 1"
                  class="px-4 py-2 rounded-2xl text-[12px] font-bold transition-all disabled:opacity-30"
                  style="background:#f0f4fd;color:#006874">
            ← ก่อนหน้า
          </button>
          <button (click)="nextPage()"
                  [disabled]="result()!.page * result()!.pageSize >= result()!.totalCount"
                  class="px-4 py-2 rounded-2xl text-[12px] font-bold transition-all disabled:opacity-30"
                  style="background:#f0f4fd;color:#006874">
            ถัดไป →
          </button>
        </div>
      </div>
    }
  </div>
}

<!-- ── Toast notifications ────────────────────────────────────────────── -->
@for (toast of toasts(); track toast.id) {
  <div class="fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl text-[13px] font-bold text-white"
       style="background:#171c22;box-shadow:0 8px 24px rgba(17,28,34,0.18)">
    {{ toast.text }}
  </div>
}

<!-- ── Compare / action bar ──────────────────────────────────────────── -->
@if (compareSelection().length > 0) {
  <div class="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
    <div class="pointer-events-auto w-full max-w-3xl mx-auto mb-4 rounded-3xl px-6 py-4 flex items-center gap-4"
         style="background:rgba(0,70,82,0.92);backdrop-filter:blur(24px);box-shadow:0 -4px 40px rgba(0,104,116,0.25)">
      <div class="flex-1 min-w-0">
        <div class="text-[10px] font-bold uppercase tracking-widest mb-0.5" style="color:#49b2c1">
          เลือกแล้ว {{ compareSelection().length }}/3 แผน
        </div>
        <div class="text-[13px] font-semibold text-white truncate">
          {{ compareSelection().map(p => p.companyName + ' ฿' + p.sumInsured.toLocaleString()).join(' · ') }}
        </div>
      </div>
      <div class="text-center hidden sm:block flex-shrink-0">
        <div class="text-[10px] uppercase tracking-widest font-bold mb-0.5" style="color:rgba(255,255,255,0.45)">รวมเบี้ย</div>
        <div class="text-[18px] font-black" style="color:#49b2c1;font-family:'Plus Jakarta Sans',sans-serif">
          ฿{{ totalPremium() | number:'1.0-0' }}
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <button (click)="clearCompare()"
                class="p-2 rounded-xl transition-colors"
                style="color:rgba(255,255,255,0.5);background:rgba(255,255,255,0.08)"
                [innerHTML]="safe(CLOSE_ICON,'w-4 h-4')">
        </button>
        <button (click)="compareNow()"
                [disabled]="compareSelection().length < 2"
                class="px-5 py-2.5 rounded-2xl text-[13px] font-bold text-white disabled:opacity-40 flex items-center gap-1.5 transition-all"
                style="background:linear-gradient(135deg,#006874,#49b2c1);box-shadow:0 2px 12px rgba(0,104,116,0.4)">
          <span [innerHTML]="safe(CHART_ICON,'w-3.5 h-3.5')"></span>
          เปรียบเทียบ {{ compareSelection().length }} แผน
        </button>
      </div>
    </div>
  </div>
}
  `,
})
export class ResultsComponent {
  result  = input<SearchResult | null>(null);
  loading = input<boolean>(false);

  readonly pageChange        = output<number>();
  readonly compareNavigate   = output<string[]>();
  readonly quotationNavigate = output<string>();

  readonly #san = inject(DomSanitizer);

  readonly SEARCH_ICON = SEARCH_ICON;
  readonly SHIELD_ICON = SHIELD_ICON;
  readonly CHART_ICON  = CHART_ICON;
  readonly CLOSE_ICON  = CLOSE_ICON;
  readonly LIST_ICON   = LIST_ICON;
  readonly CARET_DOWN  = CARET_DOWN;
  readonly CARET_UP    = CARET_UP;
  readonly yearRangeLabel = yearRangeLabel;

  skeletons        = [1, 2, 3, 4, 5, 6];
  compareSelection = signal<InsurancePlanSummary[]>([]);
  toasts           = signal<Toast[]>([]);
  expandedPlanId   = signal<string | null>(null);   // coverage detail row
  expandedGroupId  = signal<string | null>(null);   // sum-insured tier rows
  private toastId  = 0;

  // ── Grouping ────────────────────────────────────────────────────────────────
  // Collapse rows with same company + planType + repairType.
  // Show cheapest as the representative ("เริ่มต้น ฿X,XXX").
  groupedItems = computed((): GroupedPlan[] => {
    const items = this.result()?.items ?? [];
    const map = new Map<string, InsurancePlanSummary[]>();

    for (const plan of items) {
      const k = groupKey(plan);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(plan);
    }

    const result: GroupedPlan[] = [];
    for (const [, group] of map) {
      const sorted = [...group].sort((a, b) => a.minYear - b.minYear || a.premiumTotal - b.premiumTotal);
      const merged = mergeSingleYearPeers(sorted);
      result.push({ ...merged[0], groupSize: merged.length, peers: merged });
    }
    return result;
  });

  allSelected = computed(() => {
    const items = this.groupedItems();
    return items.length > 0 && items.every(p => this.isSelected(p.id));
  });

  // Returns true when a plan cannot be added because its variant differs from the current selection
  isVariantBlocked(plan: InsurancePlanSummary): boolean {
    const cur = this.compareSelection();
    if (cur.length === 0 || this.isSelected(plan.id)) return false;
    const ref = cur[0];
    return (ref.vehicleSubModel ?? '') !== (plan.vehicleSubModel ?? '') ||
           (ref.vehicleEngineCC  ?? '') !== (plan.vehicleEngineCC  ?? '');
  }

  totalPremium = computed(() =>
    this.compareSelection().reduce((s, p) => s + p.premiumTotal, 0)
  );

  safe(path: string, cls: string): SafeHtml {
    return this.#san.bypassSecurityTrustHtml(svgIcon(path, cls));
  }

  palette(name: string) { return companyPalette(name); }
  planTypeLabel(t: string): string { return PLAN_TYPE_LABELS[t] ?? t; }
  repairTypeLabel(t: string): string { return t === 'Dealer' ? 'ซ่อมศูนย์' : 'ซ่อมอู่'; }

  coverageBadges(plan: InsurancePlanSummary): string[] {
    const b: string[] = [];
    if (plan.tpbiPerPerson)     b.push('บุคคลภายนอก');
    if (plan.fireTheft)         b.push('ไฟไหม้/โจรกรรม');
    if (plan.personalAccident)  b.push('อุบัติเหตุ');
    if (plan.passengerAccident) b.push('ผู้โดยสาร');
    if (plan.medicalExpenses)   b.push('ค่ารักษา');
    if (plan.tppd)              b.push('ทรัพย์สิน');
    return b.slice(0, 3);
  }

  paginationLabel(): string {
    const r = this.result();
    if (!r) return '';
    const total = this.groupedItems().length;
    return `${total} บริษัท (${r.totalCount} แผน)`;
  }

  prevPage(): void {
    const r = this.result();
    if (r && r.page > 1) this.pageChange.emit(r.page - 1);
  }

  nextPage(): void {
    const r = this.result();
    if (r && r.page * r.pageSize < r.totalCount) this.pageChange.emit(r.page + 1);
  }

  toggleDetail(planId: string): void {
    this.expandedPlanId.update(id => id === planId ? null : planId);
  }

  toggleTiers(planId: string): void {
    this.expandedGroupId.update(id => id === planId ? null : planId);
  }

  isSelected(planId: string): boolean {
    return this.compareSelection().some(p => p.id === planId);
  }

  toggleSelectAll(): void {
    const items = this.groupedItems();
    if (this.allSelected()) {
      this.compareSelection.set([]);
      return;
    }
    // Select up to 3 plans — but only from the same variant as the first item
    const first = items[0];
    if (!first) return;
    const sameVariant = items.filter(p =>
      (p.vehicleSubModel ?? '') === (first.vehicleSubModel ?? '') &&
      (p.vehicleEngineCC  ?? '') === (first.vehicleEngineCC  ?? '')
    );
    this.compareSelection.set(sameVariant.slice(0, 3));
  }

  selectForCompare(plan: InsurancePlanSummary): void {
    const cur = this.compareSelection();
    if (this.isSelected(plan.id)) {
      this.compareSelection.set(cur.filter(p => p.id !== plan.id));
      return;
    }
    if (cur.length >= 3) {
      this.showToast('เลือกได้สูงสุด 3 แผนเท่านั้น');
      return;
    }
    // Enforce same variant — subModel + engineCC must match the first selection
    if (cur.length > 0) {
      const ref = cur[0];
      const sameVariant =
        (ref.vehicleSubModel ?? '') === (plan.vehicleSubModel ?? '') &&
        (ref.vehicleEngineCC  ?? '') === (plan.vehicleEngineCC  ?? '');
      if (!sameVariant) {
        const refLabel  = [ref.vehicleSubModel,  ref.vehicleEngineCC ].filter(Boolean).join(' ') || 'รุ่นมาตรฐาน';
        const planLabel = [plan.vehicleSubModel, plan.vehicleEngineCC].filter(Boolean).join(' ') || 'รุ่นมาตรฐาน';
        this.showToast(`เปรียบเทียบได้เฉพาะรุ่นเดียวกัน (${refLabel} ≠ ${planLabel})`);
        return;
      }
    }
    this.compareSelection.set([...cur, plan]);
  }

  clearCompare(): void { this.compareSelection.set([]); }

  compareNow(): void {
    this.compareNavigate.emit(this.compareSelection().map(p => p.id));
  }

  generateQuotation(plan: InsurancePlanSummary): void {
    this.quotationNavigate.emit(plan.id);
  }

  onLogoError(event: Event, code: string, pal: { bg: string; text: string }): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    const parent = img.parentElement!;
    parent.style.background = pal.bg;
    parent.innerHTML = `<span style="font-size:11px;font-weight:900;letter-spacing:-0.5px;color:${pal.text}">${code.slice(0,2).toUpperCase()}</span>`;
  }

  private showToast(text: string): void {
    const id = ++this.toastId;
    this.toasts.update(t => [...t, { text, id }]);
    setTimeout(() => this.toasts.update(t => t.filter(m => m.id !== id)), 3000);
  }
}
