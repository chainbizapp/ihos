import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SearchApiService, InsurancePlanDetail } from '../../core/search-api.service';
import { QuotationService } from '../quotation.service';

// ── shared sidebar helpers ────────────────────────────────────────────────────

const QUOTE_STEPS = [
  { icon: 'car',    label: 'Vehicle Info',   sub: 'Tell us about your car',   active: false },
  { icon: 'shield', label: 'Coverage Plan',  sub: 'Choose your protection',   active: false },
  { icon: 'user',   label: 'Driver Details', sub: 'Age, experience & record', active: true  },
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

// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-quotation-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    .field-input {
      width: 100%;
      background: #f8f9ff;
      border: 1.5px solid rgba(17,48,105,0.1);
      border-radius: 0.75rem;
      padding: 0.625rem 0.875rem;
      font-size: 14px;
      font-family: 'Noto Sans Thai', sans-serif;
      color: #171c22;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .field-input:focus {
      border-color: #006874;
      box-shadow: 0 0 0 3px rgba(0,104,116,0.1);
      background: #ffffff;
    }
    .field-input.invalid {
      border-color: #e53e3e;
      background: #fff5f5;
    }
    .field-input::placeholder { color: #b0b9c6; }
    .step-connector { width: 2px; height: 24px; margin: 2px auto; border-radius: 1px; }
    .section-divider { height: 1px; background: rgba(17,48,105,0.07); margin: 1.25rem 0; }
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

    <!-- ── Center: Driver Info form ───────────────────────────────────── -->
    <main class="flex-1 min-w-0 px-5 md:px-8 py-8">

      <!-- Page header -->
      <div class="flex items-center gap-3 mb-6">
        <button (click)="cancel()"
                class="flex items-center gap-1.5 text-[13px] font-semibold"
                style="color:#6b7a8d">
          <svg viewBox="0 0 256 256" fill="currentColor" style="width:14px;height:14px">
            <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"/>
          </svg>
          Back to Search
        </button>
        <div class="h-4 w-px" style="background:rgba(17,48,105,0.15)"></div>
        <h1 class="text-[18px] font-extrabold" style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
          Driver Information
        </h1>
        <span class="ml-auto text-[11px] font-bold px-2.5 py-1 rounded-full"
              style="background:rgba(0,104,116,0.08);color:#006874">STEP 3 OF 5</span>
      </div>

      <!-- Loading plan -->
      @if (loadingPlan()) {
        <div class="flex items-center justify-center py-24 gap-3">
          <svg class="w-6 h-6 animate-spin" viewBox="0 0 24 24" fill="none" style="color:#006874">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <span class="text-[13px] font-semibold" style="color:#9aa5b4">Loading plan details...</span>
        </div>
      }

      <!-- Plan not found -->
      @if (!loadingPlan() && !plan()) {
        <div class="px-4 py-3 rounded-xl text-[13px] font-semibold"
             style="background:#fff2f2;color:#c0392b;border:1px solid rgba(192,57,43,0.15)">
          Plan not found or no longer available.
        </div>
      }

      @if (!loadingPlan() && plan()) {

        <!-- ── Selected plan summary ──────────────────────────────── -->
        <div class="rounded-2xl p-4 mb-6 flex items-center gap-4 flex-wrap"
             style="background:#ffffff;box-shadow:0 2px 12px rgba(17,48,105,0.07);border:1px solid rgba(17,48,105,0.07)">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
               style="background:linear-gradient(135deg,#006874,#49b2c1)">
            <svg viewBox="0 0 256 256" fill="white" style="width:20px;height:20px">
              <path d="M208,40H48A16,16,0,0,0,32,56V96c0,89.44,75.82,119.34,91,124.39a16,16,0,0,0,10,0C149.18,215.34,225,185.44,225,96V56A16,16,0,0,0,208,40Zm0,56c0,72.34-61.78,99.18-80,105.77C109.78,195.18,48,168.34,48,96V56H208Z"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-[14px] font-extrabold truncate" style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
              {{ plan()!.companyName }}
            </div>
            <div class="flex items-center gap-2 mt-0.5 flex-wrap">
              <span class="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style="background:rgba(0,104,116,0.08);color:#006874">{{ planLabel(plan()!) }}</span>
              <span class="text-[11px] font-semibold" style="color:#9aa5b4">
                {{ plan()!.repairType === 'Dealer' ? 'ซ่อมศูนย์' : 'ซ่อมอู่' }}
              </span>
              <span class="text-[11px]" style="color:#b0b9c6">
                {{ plan()!.vehicleMake }} {{ plan()!.vehicleModel }}
              </span>
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <div class="text-[20px] font-black" style="color:#006874;font-family:'Plus Jakarta Sans',sans-serif">
              ฿{{ plan()!.premiumTotal | number:'1.0-0' }}
            </div>
            <div class="text-[11px]" style="color:#9aa5b4">per year · ทุน ฿{{ plan()!.sumInsured | number:'1.0-0' }}</div>
          </div>
        </div>

        <!-- ── Driver Info form ───────────────────────────────────── -->
        <form (ngSubmit)="onSubmit()" #f="ngForm">
          <div class="rounded-2xl p-6 md:p-8"
               style="background:#ffffff;box-shadow:0 4px 24px rgba(17,48,105,0.07),0 1px 4px rgba(17,48,105,0.04)">

            <!-- Section: Personal Information -->
            <div class="flex items-center gap-2.5 mb-5">
              <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                   style="background:rgba(0,104,116,0.1)">
                <svg viewBox="0 0 256 256" fill="#006874" style="width:14px;height:14px">
                  <path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8C56.32,191.66,80.77,176,128,176s71.68,15.66,89.07,44a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"/>
                </svg>
              </div>
              <div>
                <div class="text-[13px] font-extrabold" style="color:#171c22">Personal Information</div>
                <div class="text-[11px]" style="color:#9aa5b4">ข้อมูลผู้ขับขี่</div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Full Name -->
              <div class="sm:col-span-2">
                <label class="block text-[11px] font-bold uppercase tracking-wide mb-1.5" style="color:#6b7a8d">
                  Full Name / ชื่อ-นามสกุล <span style="color:#e53e3e">*</span>
                </label>
                <input type="text" name="customerName" [(ngModel)]="customerName" required maxlength="255"
                       placeholder="e.g. สมชาย ใจดี"
                       [class]="'field-input' + (f.submitted && !customerName ? ' invalid' : '')" />
                @if (f.submitted && !customerName) {
                  <p class="text-[11px] mt-1" style="color:#e53e3e">Full name is required.</p>
                }
              </div>

              <!-- Date of Birth -->
              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wide mb-1.5" style="color:#6b7a8d">
                  Date of Birth / วันเกิด
                </label>
                <input type="date" name="dateOfBirth" [(ngModel)]="dateOfBirth"
                       [max]="maxDob"
                       class="field-input" />
              </div>

              <!-- Age (auto from DOB or manual) -->
              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wide mb-1.5" style="color:#6b7a8d">
                  Age / อายุ <span style="color:#9aa5b4">(ปี)</span>
                </label>
                <input type="number" name="age" [(ngModel)]="age" min="18" max="99"
                       placeholder="e.g. 35"
                       class="field-input" />
              </div>

              <!-- Phone -->
              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wide mb-1.5" style="color:#6b7a8d">
                  Mobile / เบอร์โทร <span style="color:#e53e3e">*</span>
                </label>
                <input type="tel" name="phone" [(ngModel)]="phone" required maxlength="20"
                       placeholder="e.g. 081-234-5678"
                       [class]="'field-input' + (f.submitted && !phone ? ' invalid' : '')" />
                @if (f.submitted && !phone) {
                  <p class="text-[11px] mt-1" style="color:#e53e3e">Phone number is required.</p>
                }
              </div>

              <!-- Email -->
              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wide mb-1.5" style="color:#6b7a8d">
                  Email
                </label>
                <input type="email" name="email" [(ngModel)]="email" maxlength="255"
                       placeholder="e.g. driver@email.com"
                       class="field-input" />
              </div>

              <!-- Driver License -->
              <div class="sm:col-span-2">
                <label class="block text-[11px] font-bold uppercase tracking-wide mb-1.5" style="color:#6b7a8d">
                  Driver's License No. / เลขใบขับขี่
                </label>
                <input type="text" name="licenseNumber" [(ngModel)]="licenseNumber" maxlength="50"
                       placeholder="e.g. 12-3456789-12"
                       class="field-input" />
              </div>
            </div>

            <div class="section-divider"></div>

            <!-- Section: Vehicle Information -->
            <div class="flex items-center gap-2.5 mb-5">
              <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                   style="background:rgba(0,104,116,0.1)">
                <svg viewBox="0 0 256 256" fill="#006874" style="width:14px;height:14px">
                  <path d="M240,112H229.2L201.42,49.5A16,16,0,0,0,186.8,40H69.2a16,16,0,0,0-14.62,9.5L26.8,112H16a8,8,0,0,0,0,16h8v80a16,16,0,0,0,16,16H64a16,16,0,0,0,16-16V192h96v16a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V128h8a8,8,0,0,0,0-16ZM69.2,56H186.8l24.89,56H44.31ZM64,208H40V192H64Zm128,0V192h24v16Zm24-32H40V128H216ZM72,160a12,12,0,1,1,12,12A12,12,0,0,1,72,160Zm100,0a12,12,0,1,1,12,12A12,12,0,0,1,172,160Z"/>
                </svg>
              </div>
              <div>
                <div class="text-[13px] font-extrabold" style="color:#171c22">Vehicle Details</div>
                <div class="text-[11px]" style="color:#9aa5b4">ข้อมูลรถยนต์</div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Vehicle Registration -->
              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wide mb-1.5" style="color:#6b7a8d">
                  Registration / ทะเบียนรถ
                </label>
                <input type="text" name="vehicleRegistration" [(ngModel)]="vehicleRegistration"
                       maxlength="50"
                       placeholder="e.g. กข 1234 กรุงเทพ"
                       class="field-input" />
              </div>

              <!-- Production Year -->
              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wide mb-1.5" style="color:#6b7a8d">
                  Production Year / ปีผลิต <span style="color:#e53e3e">*</span>
                </label>
                <input type="number" name="vehicleYear" [(ngModel)]="vehicleYear" required
                       [min]="plan()!.minYear" [max]="plan()!.maxYear"
                       [placeholder]="plan()!.minYear + '–' + plan()!.maxYear"
                       [class]="'field-input' + (f.submitted && !vehicleYear ? ' invalid' : '')" />
                @if (f.submitted && !vehicleYear) {
                  <p class="text-[11px] mt-1" style="color:#e53e3e">Production year is required.</p>
                }
                <p class="text-[11px] mt-1" style="color:#b0b9c6">
                  Plan covers {{ plan()!.minYear }}–{{ plan()!.maxYear }}
                </p>
              </div>
            </div>

            <!-- API error -->
            @if (error()) {
              <div class="mt-5 px-4 py-3 rounded-xl text-[13px] font-semibold"
                   style="background:#fff2f2;color:#c0392b;border:1px solid rgba(192,57,43,0.15)">
                {{ error() }}
              </div>
            }

            <!-- Actions -->
            <div class="flex gap-3 mt-7">
              <button type="button" (click)="cancel()"
                      class="px-6 py-3 rounded-xl text-[13px] font-bold transition-colors"
                      style="background:#f0f4fd;color:#5a6270;border:1px solid rgba(17,48,105,0.1)">
                Cancel
              </button>
              <button type="submit" [disabled]="generating()"
                      class="flex-1 py-3 rounded-xl text-[14px] font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
                      style="background:linear-gradient(135deg,#006874,#49b2c1);box-shadow:0 4px 14px rgba(0,104,116,0.3)">
                @if (generating()) {
                  <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Generating PDF...
                } @else {
                  <svg viewBox="0 0 256 256" fill="currentColor" style="width:16px;height:16px">
                    <path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Zm-42.34-77.66a8,8,0,0,1,0,11.32l-32,32a8,8,0,0,1-11.32,0l-16-16a8,8,0,0,1,11.32-11.32L120,164.69l26.34-26.35A8,8,0,0,1,157.66,138.34Z"/>
                  </svg>
                  Generate Quotation
                }
              </button>
            </div>

          </div>
        </form>
      }
    </main>

  </div><!-- end 3-column shell -->

</div>
  `
})
export class QuotationFormComponent implements OnInit {
  private readonly route            = inject(ActivatedRoute);
  private readonly router           = inject(Router);
  private readonly searchApi        = inject(SearchApiService);
  private readonly quotationService = inject(QuotationService);

  plan        = signal<InsurancePlanDetail | null>(null);
  loadingPlan = signal(true);
  generating  = signal(false);
  error       = signal<string | null>(null);

  // Personal info
  customerName  = '';
  dateOfBirth   = '';
  age: number | null = null;
  phone         = '';
  email         = '';
  licenseNumber = '';

  // Vehicle info
  vehicleRegistration = '';
  vehicleYear: number | null = null;

  readonly currentYear = new Date().getFullYear();
  readonly maxDob      = `${this.currentYear - 18}-12-31`;

  readonly quoteSteps    = QUOTE_STEPS;
  readonly trustItems    = TRUST_ITEMS;
  readonly stepIcon      = stepIcon;
  readonly svg           = svg;
  readonly SAVE_PATH     = SAVE_PATH;
  readonly avatarColors  = ['#006874','#f7941d','#435d98','#49b2c1'];
  readonly avatarInitials = ['A','B','C','D'];

  private planId = '';

  async ngOnInit(): Promise<void> {
    this.planId = this.route.snapshot.queryParamMap.get('planId') ?? '';
    if (!this.planId) { this.loadingPlan.set(false); return; }

    try {
      const plan = await this.searchApi.getDetail(this.planId);
      this.plan.set(plan);
      // Pre-fill vehicle year with midpoint of allowed range
      if (plan) {
        this.vehicleYear = plan.maxYear;
      }
    } catch {
      // plan remains null
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
        planId:              this.planId,
        customerName:        this.customerName,
        vehicleRegistration: this.vehicleRegistration || undefined,
        vehicleYear:         this.vehicleYear,
      });

      this.router.navigate(['/quotation/success'], {
        queryParams: { quotationId: result.quotationId },
      });
    } catch (err: any) {
      this.error.set(err?.error?.error ?? 'Failed to generate quotation. Please try again.');
    } finally {
      this.generating.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/search']);
  }
}
