import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { QuotationService } from '../quotation.service';

const QUOTE_STEPS = [
  { icon: 'car',    label: 'Vehicle Info',      sub: 'Tell us about your car',    active: false },
  { icon: 'shield', label: 'Coverage Plan',     sub: 'Choose your protection',    active: false },
  { icon: 'user',   label: 'Driver Details',    sub: 'Age, experience & record',  active: false },
  { icon: 'list',   label: 'Quotation Review',  sub: 'Review your quote',         active: true  },
  { icon: 'check',  label: 'Review & Pay',      sub: 'Confirm & complete',        active: false },
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

@Component({
  selector: 'app-quotation-success',
  standalone: true,
  imports: [CommonModule],
  styles: [`
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
                  <span class="w-4 h-4" [innerHTML]="si(step.icon)"></span>
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
          <span [innerHTML]="saveSvg()"></span>
          Save Progress
        </button>
        <p class="text-center text-[10px] mt-2" style="color:#b0b9c6">Login required to save</p>
      </div>
    </aside>

    <!-- ── Center: Review content ──────────────────────────────────────── -->
    <main class="flex-1 min-w-0 px-5 md:px-8 py-8">

      <!-- Page header -->
      <div class="flex items-center gap-3 mb-6">
        <button (click)="goBack()"
                class="flex items-center gap-1.5 text-[13px] font-semibold"
                style="color:#6b7a8d">
          <svg viewBox="0 0 256 256" fill="currentColor" style="width:14px;height:14px">
            <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"/>
          </svg>
          Back to Search
        </button>
        <div class="h-4 w-px" style="background:rgba(17,48,105,0.15)"></div>
        <h1 class="text-[18px] font-extrabold" style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
          Quotation Review
        </h1>
        <span class="ml-auto text-[11px] font-bold px-2.5 py-1 rounded-full"
              style="background:rgba(0,104,116,0.08);color:#006874">STEP 4 OF 5</span>
      </div>

      <!-- Success banner + actions row -->
      <div class="rounded-2xl p-4 mb-5 flex items-center gap-4 flex-wrap"
           style="background:#ffffff;box-shadow:0 2px 12px rgba(17,48,105,0.07);border:1px solid rgba(17,48,105,0.07)">
        <div class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
             style="background:rgba(0,168,107,0.1)">
          <svg viewBox="0 0 256 256" fill="#00a86b" style="width:18px;height:18px">
            <path d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"/>
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[13px] font-extrabold" style="color:#171c22">Quotation Generated Successfully</div>
          @if (quotationId()) {
            <div class="text-[11px] font-mono mt-0.5" style="color:#9aa5b4">
              Ref: #{{ quotationId()!.substring(0, 8).toUpperCase() }}
            </div>
          }
        </div>
        @if (loadError()) {
          <span class="text-[11px] font-semibold" style="color:#c0392b">{{ loadError() }}</span>
        }
        <div class="flex items-center gap-2">
          <!-- Edit Details / Re-generate -->
          <button
            (click)="editDetails()"
            class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold transition-all active:scale-[0.99]"
            style="background:#f0f4fd;color:#5a6270;border:1px solid rgba(17,48,105,0.12)">
            <svg viewBox="0 0 256 256" fill="currentColor" style="width:14px;height:14px">
              <path d="M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM51.31,168,136,83.31,152.69,100,68,184.68ZM48,200v-27.31L76,173,83,180,83.31,208H48Zm96-128L128,56l22-22,16,16Z"/>
            </svg>
            Edit Details
          </button>
          <!-- Download -->
          <button
            (click)="downloadPdf()"
            [disabled]="downloading() || loading()"
            class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
            style="background:linear-gradient(135deg,#006874,#49b2c1);box-shadow:0 4px 14px rgba(0,104,116,0.25)">
            @if (downloading()) {
              <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Downloading...
            } @else {
              <svg viewBox="0 0 256 256" fill="currentColor" style="width:14px;height:14px">
                <path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z"/>
              </svg>
              Download PDF
            }
          </button>
        </div>
      </div>

      <!-- PDF preview card -->
      <div class="rounded-2xl overflow-hidden"
           style="background:#ffffff;box-shadow:0 4px 24px rgba(17,48,105,0.07),0 1px 4px rgba(17,48,105,0.04);border:1px solid rgba(17,48,105,0.07)">

        <!-- Card header -->
        <div class="flex items-center gap-2 px-5 py-3 border-b" style="border-color:rgba(17,48,105,0.08)">
          <svg viewBox="0 0 256 256" fill="#006874" style="width:14px;height:14px">
            <path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z"/>
          </svg>
          <span class="text-[12px] font-bold" style="color:#006874">PDF Preview</span>
        </div>

        <!-- Viewer body -->
        <div style="height:72vh;position:relative;background:#f0f4fd">

          @if (loading()) {
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px">
              <svg class="animate-spin" viewBox="0 0 24 24" fill="none" style="width:32px;height:32px;color:#006874">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <span class="text-[13px] font-semibold" style="color:#9aa5b4">Loading quotation PDF…</span>
            </div>
          }

          @if (loadError() && !loading()) {
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:24px">
              <svg viewBox="0 0 256 256" fill="#f7941d" style="width:40px;height:40px">
                <path d="M236.8,188.09,149.35,36.22a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM120,104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm8,88a12,12,0,1,1,12-12A12,12,0,0,1,128,192Z"/>
              </svg>
              <div>
                <p class="text-[13px] font-bold mb-1" style="color:#171c22">Could not load PDF preview</p>
                <p class="text-[11px]" style="color:#9aa5b4">{{ loadError() }}</p>
              </div>
              <button (click)="loadPreview()"
                      class="px-5 py-2 rounded-xl text-[13px] font-bold text-white"
                      style="background:linear-gradient(135deg,#006874,#49b2c1)">
                Retry
              </button>
            </div>
          }

          @if (pdfUrl() && !loading()) {
            <iframe [src]="pdfUrl()!" style="width:100%;height:100%;border:0" title="Quotation PDF"></iframe>
          }
        </div>
      </div>

    </main>
  </div>
</div>
  `
})
export class QuotationSuccessComponent implements OnInit, OnDestroy {
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  private readonly quotationService = inject(QuotationService);
  private readonly sanitizer  = inject(DomSanitizer);

  quotationId = signal<string | null>(null);
  pdfUrl      = signal<SafeResourceUrl | null>(null);
  loading     = signal(false);
  loadError   = signal<string | null>(null);
  downloading = signal(false);

  private formParams: Record<string, string> = {};

  readonly quoteSteps = QUOTE_STEPS;
  readonly si = (name: string): SafeHtml =>
    this.sanitizer.bypassSecurityTrustHtml(stepIcon(name));
  readonly saveSvg = (): SafeHtml =>
    this.sanitizer.bypassSecurityTrustHtml(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" style="width:14px;height:14px">${SAVE_PATH}</svg>`
    );

  private objectUrl: string | null = null;

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    const id = qp.get('quotationId');
    this.quotationId.set(id);

    // Capture all form params so we can restore them on "Edit Details"
    const formKeys = [
      'planIds', 'customerName', 'phone', 'email', 'licenseNumber',
      'previousCompany', 'previousPolicyExpiry', 'vehicleRegistration', 'vehicleYear',
    ];
    for (const key of formKeys) {
      const val = qp.get(key);
      if (val) this.formParams[key] = val;
    }

    if (id) this.loadPreview();
  }

  ngOnDestroy(): void {
    this.revokeObjectUrl();
  }

  async loadPreview(): Promise<void> {
    const id = this.quotationId();
    if (!id) return;

    this.loading.set(true);
    this.loadError.set(null);
    this.pdfUrl.set(null);
    this.revokeObjectUrl();

    try {
      const blob = await this.quotationService.downloadPdf(id);
      this.objectUrl = URL.createObjectURL(blob);
      this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
    } catch {
      this.loadError.set('Failed to load PDF. Please try downloading directly.');
    } finally {
      this.loading.set(false);
    }
  }

  async downloadPdf(): Promise<void> {
    const id = this.quotationId();
    if (!id) return;

    this.downloading.set(true);
    try {
      const blob = await this.quotationService.downloadPdf(id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `quotation_${id.substring(0, 8).toUpperCase()}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      this.loadError.set('Failed to download PDF. Please try again.');
    } finally {
      this.downloading.set(false);
    }
  }

  editDetails(): void {
    this.router.navigate(['/quotation/new'], { queryParams: this.formParams });
  }

  goBack(): void {
    this.router.navigate(['/search']);
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
