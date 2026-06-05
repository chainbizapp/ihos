import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReportingApiService, ImportErrorsResult } from '../../core/reporting-api.service';

@Component({
  selector: 'app-import-errors',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './import-errors.component.html',
  styleUrl: './import-errors.component.scss'
})
export class ImportErrorsComponent {
  private readonly api = inject(ReportingApiService);

  result = signal<ImportErrorsResult | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  exporting = signal(false);
  currentPage = signal(1);

  fromDate = this.defaultFrom();
  toDate = new Date().toISOString().split('T')[0];

  private defaultFrom(): string {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().split('T')[0];
  }

  async load(page = 1): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.currentPage.set(page);
    try {
      this.result.set(await this.api.getImportErrors(this.fromDate, this.toDate, undefined, page));
    } catch {
      this.error.set('Failed to load report. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async exportReport(format: 'pdf' | 'xlsx'): Promise<void> {
    this.exporting.set(true);
    try {
      const blob = await this.api.exportReport('import-errors', format, this.fromDate, this.toDate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `import_errors.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      this.error.set('Export failed. Please try again.');
    } finally {
      this.exporting.set(false);
    }
  }

  prevPage(): void { if (this.currentPage() > 1) this.load(this.currentPage() - 1); }
  nextPage(): void {
    const r = this.result();
    if (r && this.currentPage() * r.pageSize < r.totalCount) this.load(this.currentPage() + 1);
  }

  paginationLabel(): string {
    const r = this.result();
    if (!r) return '';
    const start = (r.page - 1) * r.pageSize + 1;
    const end = Math.min(r.page * r.pageSize, r.totalCount);
    return `${start}–${end} of ${r.totalCount}`;
  }

  statusClass(status: string): string {
    const base = 'px-2 py-0.5 rounded text-xs font-medium ';
    switch (status.toLowerCase()) {
      case 'published': return base + 'bg-green-100 text-green-700';
      case 'pendingreview': return base + 'bg-yellow-100 text-yellow-700';
      case 'failed': return base + 'bg-red-100 text-red-700';
      default: return base + 'bg-gray-100 text-gray-700';
    }
  }
}
