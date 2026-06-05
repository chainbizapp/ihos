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
const FILTER_ICON  = `<path d="M230.6,49.53A8,8,0,0,0,224,40H32a8,8,0,0,0-5.93,13.35L96,124.69V208a8,8,0,0,0,11.58,7.16l48-24A8,8,0,0,0,160,184V124.69l69.93-71.34A8,8,0,0,0,230.6,49.53ZM145.37,111.48A8,8,0,0,0,144,116v63.48l-32,16V116a8,8,0,0,0-2.37-5.65L48.17,56H207.83Z"/>`;

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
  
  templateUrl: './results.component.html',
  styleUrl: './results.component.scss',
})
export class ResultsComponent {
  result  = input<SearchResult | null>(null);
  loading = input<boolean>(false);

  readonly pageChange        = output<number>();
  readonly compareNavigate   = output<string[]>();
  readonly quotationNavigate = output<string>();

  readonly #san = inject(DomSanitizer);

  readonly SEARCH_ICON  = SEARCH_ICON;
  readonly SHIELD_ICON  = SHIELD_ICON;
  readonly CHART_ICON   = CHART_ICON;
  readonly CLOSE_ICON   = CLOSE_ICON;
  readonly LIST_ICON    = LIST_ICON;
  readonly CARET_DOWN   = CARET_DOWN;
  readonly CARET_UP     = CARET_UP;
  readonly FILTER_ICON  = FILTER_ICON;
  readonly yearRangeLabel = yearRangeLabel;

  skeletons        = [1, 2, 3, 4, 5, 6];
  compareSelection = signal<InsurancePlanSummary[]>([]);
  toasts           = signal<Toast[]>([]);
  expandedPlanId   = signal<string | null>(null);   // coverage detail row
  expandedGroupId  = signal<string | null>(null);   // sum-insured tier rows
  private toastId  = 0;

  // ── Company filter ───────────────────────────────────────────────────────────
  companyFilterOpen  = signal(false);
  activeCompanyFilter = signal<Set<string>>(new Set()); // empty = show all
  draftSelected      = signal<Set<string>>(new Set()); // working copy inside dialog

  allCompanies = computed((): string[] => {
    const items = this.result()?.items ?? [];
    const seen = new Set<string>();
    const names: string[] = [];
    for (const p of items) {
      if (!seen.has(p.companyName)) { seen.add(p.companyName); names.push(p.companyName); }
    }
    return names.sort((a, b) => a.localeCompare(b, 'th'));
  });

  draftAllSelected = computed(() => {
    const draft = this.draftSelected();
    const all   = this.allCompanies();
    return all.length > 0 && all.every(c => draft.has(c));
  });

  // ── Grouping ────────────────────────────────────────────────────────────────
  // Collapse rows with same company + planType + repairType.
  // Show cheapest as the representative ("เริ่มต้น ฿X,XXX").
  groupedItems = computed((): GroupedPlan[] => {
    const items  = this.result()?.items ?? [];
    const filter = this.activeCompanyFilter();
    const map    = new Map<string, InsurancePlanSummary[]>();

    for (const plan of items) {
      if (filter.size > 0 && !filter.has(plan.companyName)) continue;
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

  regionGroupLabel(code: string | null | undefined): string | null {
    if (!code) return null;
    const map: Record<string, string> = {
      BKK: 'กรุงเทพและปริมณฑล',
      NE:  'ภาคตะวันออกเฉียงเหนือ',
      UPC: 'ต่างจังหวัด (ยกเว้นภาคตะวันออกเฉียงเหนือ)',
    };
    return map[code] ?? code;
  }

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

  // ── Company filter dialog methods ────────────────────────────────────────────
  openCompanyFilter(): void {
    // Pre-populate draft from current active filter (or all if none)
    const active = this.activeCompanyFilter();
    this.draftSelected.set(new Set(active.size > 0 ? active : []));
    this.companyFilterOpen.set(true);
  }

  closeCompanyFilter(): void {
    this.companyFilterOpen.set(false);
  }

  toggleDraftCompany(name: string): void {
    const draft = new Set(this.draftSelected());
    if (draft.has(name)) draft.delete(name); else draft.add(name);
    this.draftSelected.set(draft);
  }

  toggleAllCompanies(): void {
    if (this.draftAllSelected()) {
      this.draftSelected.set(new Set());
    } else {
      this.draftSelected.set(new Set(this.allCompanies()));
    }
  }

  applyCompanyFilter(): void {
    const draft = this.draftSelected();
    // If all or none selected → clear filter (show all)
    const all = this.allCompanies();
    if (draft.size === 0 || draft.size === all.length) {
      this.activeCompanyFilter.set(new Set());
    } else {
      this.activeCompanyFilter.set(new Set(draft));
    }
    this.companyFilterOpen.set(false);
  }

  clearCompanyFilter(): void {
    this.activeCompanyFilter.set(new Set());
    this.draftSelected.set(new Set());
    this.companyFilterOpen.set(false);
  }

  /** Look up a short code for a company by scanning result items */
  companyShortCode(name: string): string {
    const found = this.result()?.items.find(p => p.companyName === name);
    return found?.companyShortCode ?? name.slice(0, 2).toUpperCase();
  }

  onDialogLogoError(event: Event, name: string): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    const pal = companyPalette(name);
    const parent = img.parentElement!;
    parent.style.background = pal.bg;
    parent.innerHTML = `<span style="font-size:11px;font-weight:900;letter-spacing:-0.5px;color:${pal.text}">${name.slice(0,2).toUpperCase()}</span>`;
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
