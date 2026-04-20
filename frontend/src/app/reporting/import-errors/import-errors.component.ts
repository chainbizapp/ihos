import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReportingApiService, ImportErrorsResult } from '../../core/reporting-api.service';

@Component({
  selector: 'app-import-errors',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="p-6 max-w-6xl mx-auto">
      <div class="flex items-center gap-3 mb-6">
        <a routerLink="/reporting" class="text-sm text-gray-500 hover:text-gray-700">← Reports</a>
        <h1 class="text-2xl font-semibold">Import Errors</h1>
      </div>

      <!-- Filters -->
      <div class="bg-white border rounded-lg p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input type="date" [(ngModel)]="fromDate"
            class="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input type="date" [(ngModel)]="toDate"
            class="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button (click)="load()" [disabled]="loading()"
          class="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          Load
        </button>
        <div class="ml-auto flex gap-2">
          <button (click)="exportReport('pdf')" [disabled]="!result() || exporting()"
            class="px-3 py-1.5 border rounded text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40">
            Export PDF
          </button>
          <button (click)="exportReport('xlsx')" [disabled]="!result() || exporting()"
            class="px-3 py-1.5 border rounded text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40">
            Export Excel
          </button>
        </div>
      </div>

      @if (error()) {
        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">{{ error() }}</div>
      }

      @if (loading()) {
        <div class="text-center py-16 text-gray-400">Loading...</div>
      } @else if (result()) {
        <div class="bg-white border rounded-lg overflow-hidden">
          @if (result()!.items.length === 0) {
            <div class="text-center py-12 text-gray-400">No import batches in this date range.</div>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="text-left p-3 font-medium text-gray-600">Company</th>
                    <th class="text-left p-3 font-medium text-gray-600">File</th>
                    <th class="text-left p-3 font-medium text-gray-600">Uploaded</th>
                    <th class="text-left p-3 font-medium text-gray-600">Status</th>
                    <th class="text-right p-3 font-medium text-gray-600">Total</th>
                    <th class="text-right p-3 font-medium text-gray-600">Resolved</th>
                    <th class="text-right p-3 font-medium text-gray-600">Pending</th>
                    <th class="text-right p-3 font-medium text-gray-600">Approved</th>
                    <th class="text-right p-3 font-medium text-gray-600">Rejected</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of result()!.items; track item.batchId) {
                    <tr class="border-t hover:bg-gray-50"
                        [class.bg-amber-50]="item.pendingRows > 0">
                      <td class="p-3 font-medium text-gray-900">{{ item.companyName }}</td>
                      <td class="p-3 text-gray-600 text-xs max-w-48 truncate" [title]="item.sourceFileName">
                        {{ item.sourceFileName }}
                      </td>
                      <td class="p-3 text-gray-500 text-xs">{{ item.uploadedAt | date:'dd MMM yyyy' }}</td>
                      <td class="p-3">
                        <span [class]="statusClass(item.status)">{{ item.status }}</span>
                      </td>
                      <td class="p-3 text-right text-gray-700">{{ item.totalRows }}</td>
                      <td class="p-3 text-right text-green-700">{{ item.resolvedRows }}</td>
                      <td class="p-3 text-right" [class.text-amber-700]="item.pendingRows > 0"
                          [class.text-gray-400]="item.pendingRows === 0">{{ item.pendingRows }}</td>
                      <td class="p-3 text-right text-blue-700">{{ item.approvedRows }}</td>
                      <td class="p-3 text-right text-red-600">{{ item.rejectedRows }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div class="flex justify-between items-center px-4 py-3 border-t text-sm text-gray-600">
              <span>{{ paginationLabel() }}</span>
              <div class="flex gap-2">
                <button (click)="prevPage()" [disabled]="currentPage() <= 1"
                  class="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">Prev</button>
                <button (click)="nextPage()"
                  [disabled]="currentPage() * (result()?.pageSize ?? 20) >= (result()?.totalCount ?? 0)"
                  class="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">Next</button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `
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
