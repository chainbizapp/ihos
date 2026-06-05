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
  
  templateUrl: './compare.component.html',
  styleUrl: './compare.component.scss'
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

  generateQuotation(): void {
    const planIds = this.plans().map(p => p.id).join(',');
    this.router.navigate(['/quotation/new'], { queryParams: { planIds } });
  }
}
