import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SearchApiService, InsurancePlanDetail } from '../../core/search-api.service';
import { QuotationService } from '../quotation.service';
import { CustomerApiService, CustomerSuggestion } from '../../core/customer-api.service';

// ── shared sidebar helpers ────────────────────────────────────────────────────

const QUOTE_STEPS = [
  { icon: 'car', label: 'Vehicle Info', sub: 'Tell us about your car', active: false },
  { icon: 'shield', label: 'Coverage Plan', sub: 'Choose your protection', active: false },
  { icon: 'user', label: 'Driver Details', sub: 'Age, experience & record', active: true },
  { icon: 'list', label: 'Quotation Review', sub: 'Review your quote', active: false },
  { icon: 'check', label: 'Review & Pay', sub: 'Confirm & complete', active: false },
];

const TRUST_ITEMS = [
  '✓  Instant premium comparison',
  '✓  Licensed insurers only',
  '✓  OIC-approved coverages',
  '✓  24 / 7 claims support',
];

function stepIcon(name: string): string {
  const icons: Record<string, string> = {
    car: `<path d="M240,112H229.2L201.42,49.5A16,16,0,0,0,186.8,40H69.2a16,16,0,0,0-14.62,9.5L26.8,112H16a8,8,0,0,0,0,16h8v80a16,16,0,0,0,16,16H64a16,16,0,0,0,16-16V192h96v16a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V128h8a8,8,0,0,0,0-16ZM69.2,56H186.8l24.89,56H44.31ZM64,208H40V192H64Zm128,0V192h24v16Zm24-32H40V128H216ZM72,160a12,12,0,1,1,12,12A12,12,0,0,1,72,160Zm100,0a12,12,0,1,1,12,12A12,12,0,0,1,172,160Z"/>`,
    user: `<path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8C56.32,191.66,80.77,176,128,176s71.68,15.66,89.07,44a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"/>`,
    shield: `<path d="M208,40H48A16,16,0,0,0,32,56V96c0,89.44,75.82,119.34,91,124.39a16,16,0,0,0,10,0C149.18,215.34,225,185.44,225,96V56A16,16,0,0,0,208,40Zm0,56c0,72.34-61.78,99.18-80,105.77C109.78,195.18,48,168.34,48,96V56H208Z"/>`,
    list: `<path d="M224,128a8,8,0,0,1-8,8H104a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM104,72H216a8,8,0,0,0,0-16H104a8,8,0,0,0,0,16ZM216,184H104a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16ZM44,116a12,12,0,1,0,12,12A12,12,0,0,0,44,116Zm0-56a12,12,0,1,0,12,12A12,12,0,0,0,44,60Zm0,112a12,12,0,1,0,12,12A12,12,0,0,0,44,172Z"/>`,
    check: `<path d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"/>`,
  };
  const p = icons[name] ?? '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" style="width:100%;height:100%">${p}</svg>`;
}

const SAVE_PATH = `<path d="M219.31,68.69l-40-40A16,16,0,0,0,168,24H48A16,16,0,0,0,32,40V216a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V80A16,16,0,0,0,219.31,68.69ZM168,208H88V160h80Zm32,0H184V160a16,16,0,0,0-16-16H88a16,16,0,0,0-16,16v48H48V40H168l32,32Z"/>`;

function svg(path: string, cls = 'w-4 h-4'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" class="${cls}">${path}</svg>`;
}

// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-quotation-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  
  templateUrl: './quotation-form.component.html',
  styleUrl: './quotation-form.component.scss'
})
export class QuotationFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly searchApi = inject(SearchApiService);
  private readonly quotationService = inject(QuotationService);
  private readonly customerApi = inject(CustomerApiService);

  /** Primary plan (required — drives validation & vehicle info) */
  plan = signal<InsurancePlanDetail | null>(null);
  /** All selected plans (1–3) */
  plans = signal<InsurancePlanDetail[]>([]);
  loadingPlan = signal(true);
  generating = signal(false);
  error = signal<string | null>(null);

  // Auto-suggest
  suggestions = signal<CustomerSuggestion[]>([]);
  showSuggest = signal(false);
  private suggestTimer: ReturnType<typeof setTimeout> | null = null;

  // Personal info
  customerName = '';
  phone = '';
  email = '';
  licenseNumber = '';

  // Previous insurance
  previousCompany = '';
  previousPolicyExpiry = '';

  // Vehicle info
  vehicleRegistration = '';
  vehicleYear: number | null = null;

  readonly quoteSteps = QUOTE_STEPS;
  readonly trustItems = TRUST_ITEMS;
  readonly stepIcon = stepIcon;
  readonly svg = svg;
  readonly SAVE_PATH = SAVE_PATH;
  readonly avatarColors = ['#006874', '#f7941d', '#435d98', '#49b2c1'];
  readonly avatarInitials = ['A', 'B', 'C', 'D'];

  private planIds: string[] = [];

  async ngOnInit(): Promise<void> {
    const qp = this.route.snapshot.queryParamMap;
    const raw = qp.get('planIds') ?? '';
    this.planIds = raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);

    // Restore fields when returning from the review page
    this.customerName        = qp.get('customerName')        ?? '';
    this.phone               = qp.get('phone')               ?? '';
    this.email               = qp.get('email')               ?? '';
    this.licenseNumber       = qp.get('licenseNumber')        ?? '';
    this.previousCompany     = qp.get('previousCompany')      ?? '';
    this.previousPolicyExpiry = qp.get('previousPolicyExpiry') ?? '';
    this.vehicleRegistration = qp.get('vehicleRegistration')  ?? '';
    const yrParam = qp.get('vehicleYear');
    if (yrParam) this.vehicleYear = +yrParam;

    if (this.planIds.length === 0) { this.loadingPlan.set(false); return; }

    try {
      const loaded = await Promise.all(this.planIds.map(id => this.searchApi.getDetail(id)));
      const valid = loaded.filter((p): p is InsurancePlanDetail => p !== null);
      this.plans.set(valid);
      this.plan.set(valid[0] ?? null);
      if (valid[0] && !yrParam) this.vehicleYear = valid[0].maxYear;
    } catch {
      // plans remain empty
    } finally {
      this.loadingPlan.set(false);
    }
  }

  planLabel(plan: InsurancePlanDetail): string {
    const map: Record<string, string> = {
      Type1: 'ชั้น 1', Type2: 'ชั้น 2', Type3: 'ชั้น 3',
      Type2Plus: 'ชั้น 2+', Type3Plus: 'ชั้น 3+'
    };
    return map[plan.planType] ?? plan.planType;
  }

  async onSubmit(): Promise<void> {
    if (!this.customerName || !this.vehicleYear || !this.phone) return;

    this.generating.set(true);
    this.error.set(null);

    try {
      const result = await this.quotationService.generate({
        planIds: this.planIds,
        customerName: this.customerName,
        vehicleRegistration: this.vehicleRegistration || undefined,
        vehicleYear: this.vehicleYear,
        phone: this.phone || undefined,
        email: this.email || undefined,
        licenseNumber: this.licenseNumber || undefined,
        previousInsurer: this.previousCompany || undefined,
        previousExpiryDate: this.previousPolicyExpiry || undefined,
      });

      this.router.navigate(['/quotation/success'], {
        queryParams: {
          quotationId:         result.quotationId,
          planIds:             this.planIds.join(','),
          customerName:        this.customerName,
          phone:               this.phone,
          ...(this.email               && { email:               this.email }),
          ...(this.licenseNumber       && { licenseNumber:       this.licenseNumber }),
          ...(this.previousCompany     && { previousCompany:     this.previousCompany }),
          ...(this.previousPolicyExpiry && { previousPolicyExpiry: this.previousPolicyExpiry }),
          ...(this.vehicleRegistration && { vehicleRegistration: this.vehicleRegistration }),
          ...(this.vehicleYear         && { vehicleYear:         this.vehicleYear }),
        },
      });
    } catch (err: any) {
      this.error.set(err?.error?.error ?? 'Failed to generate quotation. Please try again.');
    } finally {
      this.generating.set(false);
    }
  }

  // ── Auto-suggest handlers ──────────────────────────────────────────────────
  onNameInput(event: Event): void {
    const q = (event.target as HTMLInputElement).value;
    if (this.suggestTimer) clearTimeout(this.suggestTimer);
    if (!q || q.length < 2) { this.suggestions.set([]); return; }
    this.suggestTimer = setTimeout(async () => {
      try {
        const results = await this.customerApi.search(q);
        this.suggestions.set(results);
        this.showSuggest.set(true);
      } catch { this.suggestions.set([]); }
    }, 250);
  }

  onNameFocus(): void {
    if (this.suggestions().length > 0) this.showSuggest.set(true);
  }

  onNameBlur(): void {
    // Small delay so mousedown on suggestion fires first
    setTimeout(() => this.showSuggest.set(false), 150);
  }

  selectSuggestion(s: CustomerSuggestion): void {
    this.customerName         = s.fullName;
    this.phone                = s.phone;
    this.email                = s.email ?? '';
    this.licenseNumber        = s.licenseNumber ?? '';
    this.vehicleRegistration  = s.vehicleRegistration ?? '';
    if (s.vehicleYear) this.vehicleYear = s.vehicleYear;
    this.previousCompany      = s.previousInsurer ?? '';
    this.previousPolicyExpiry = s.previousExpiryDate ?? '';
    this.showSuggest.set(false);
    this.suggestions.set([]);
  }

  cancel(): void {
    this.router.navigate(['/search']);
  }
}
