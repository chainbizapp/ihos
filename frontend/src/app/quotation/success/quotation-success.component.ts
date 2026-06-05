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
  
  templateUrl: './quotation-success.component.html',
  styleUrl: './quotation-success.component.scss'
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
