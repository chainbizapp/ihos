import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { QuotationService, QuotationSummary } from '../quotation.service';

const PLAN_TYPE_LABELS: Record<string, string> = {
  Type1:    'ชั้น 1',
  Type2Plus:'ชั้น 2+',
  Type2:    'ชั้น 2',
  Type3Plus:'ชั้น 3+',
  Type3:    'ชั้น 3',
};

@Component({
  selector: 'app-quotation-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  
  templateUrl: './quotation-list.component.html',
  styleUrl: './quotation-list.component.scss'
})
export class QuotationListComponent implements OnInit, OnDestroy {
  private readonly svc = inject(QuotationService);
  private readonly san = inject(DomSanitizer);

  readonly skeletons = [1, 2, 3, 4, 5, 6, 7, 8];
  readonly pageSize  = 20;

  loading       = signal(true);
  items         = signal<QuotationSummary[]>([]);
  totalCount    = signal(0);
  page          = signal(1);

  downloadingId = signal<string | null>(null);
  downloadError = signal('');

  // Preview dialog state
  previewQuotation = signal<QuotationSummary | null>(null);
  pdfUrl           = signal<SafeResourceUrl | null>(null);
  pdfLoading       = signal(false);
  pdfError         = signal('');
  private objectUrl: string | null = null;

  searchQuery = '';

  readonly filteredItems = computed(() => {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.items();
    return this.items().filter(i =>
      i.customerName.toLowerCase().includes(q) ||
      (i.vehicleRegistration ?? '').toLowerCase().includes(q) ||
      i.companyName.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void { this.load(); }

  ngOnDestroy(): void { this.revokeObjectUrl(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.svc.getHistory(this.page(), this.pageSize);
      this.items.set(res.items);
      this.totalCount.set(res.totalCount);
    } finally {
      this.loading.set(false);
    }
  }

  prevPage(): void {
    if (this.page() > 1) { this.page.update(p => p - 1); this.load(); }
  }

  nextPage(): void {
    if (this.page() * this.pageSize < this.totalCount()) { this.page.update(p => p + 1); this.load(); }
  }

  paginationLabel(): string {
    const start = (this.page() - 1) * this.pageSize + 1;
    const end   = Math.min(this.page() * this.pageSize, this.totalCount());
    return `${start}–${end} จาก ${this.totalCount()} รายการ`;
  }

  planTypeLabel(t: string): string {
    return PLAN_TYPE_LABELS[t] ?? t;
  }

  // ── Preview ──────────────────────────────────────────────────────────────

  async openPreview(q: QuotationSummary): Promise<void> {
    this.previewQuotation.set(q);
    this.pdfError.set('');
    this.pdfUrl.set(null);
    this.revokeObjectUrl();
    await this.fetchPdf(q.id);
  }

  closePreview(): void {
    this.previewQuotation.set(null);
    this.pdfUrl.set(null);
    this.pdfError.set('');
    this.revokeObjectUrl();
  }

  async retryPreview(): Promise<void> {
    const q = this.previewQuotation();
    if (q) await this.fetchPdf(q.id);
  }

  private async fetchPdf(id: string): Promise<void> {
    this.pdfLoading.set(true);
    this.pdfError.set('');
    try {
      const blob = await this.svc.downloadPdf(id);
      this.objectUrl = URL.createObjectURL(blob);
      this.pdfUrl.set(this.san.bypassSecurityTrustResourceUrl(this.objectUrl));
    } catch {
      this.pdfError.set('ไม่สามารถโหลด PDF ได้ กรุณาลองดาวน์โหลดโดยตรง');
    } finally {
      this.pdfLoading.set(false);
    }
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  // ── Download ─────────────────────────────────────────────────────────────

  async downloadPdf(q: QuotationSummary): Promise<void> {
    this.downloadingId.set(q.id);
    try {
      const blob = await this.svc.downloadPdf(q.id);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `quotation-${q.customerName.replace(/\s+/g, '-')}-${q.id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      this.downloadError.set('ดาวน์โหลด PDF ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      setTimeout(() => this.downloadError.set(''), 4000);
    } finally {
      this.downloadingId.set(null);
    }
  }
}
