import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReportingApiService, UsageStatisticsResult } from '../../core/reporting-api.service';

@Component({
  selector: 'app-usage-statistics',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="p-6 max-w-5xl mx-auto">
      <div class="flex items-center gap-3 mb-6">
        <a routerLink="/reporting" class="text-sm text-gray-500 hover:text-gray-700">← Reports</a>
        <h1 class="text-2xl font-semibold">Usage Statistics</h1>
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
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Granularity</label>
          <select [(ngModel)]="granularity"
            class="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
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
        <!-- Summary -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div class="bg-white border rounded-lg p-4 text-center">
            <div class="text-3xl font-bold text-blue-700">{{ result()!.totalQuotations }}</div>
            <div class="text-sm text-gray-500 mt-1">Total Quotations</div>
          </div>
          <div class="bg-white border rounded-lg p-4 text-center">
            <div class="text-3xl font-bold text-gray-700">{{ result()!.buckets.length }}</div>
            <div class="text-sm text-gray-500 mt-1">Periods</div>
          </div>
          <div class="bg-white border rounded-lg p-4 text-center">
            <div class="text-3xl font-bold text-gray-700 capitalize">{{ result()!.granularity }}</div>
            <div class="text-sm text-gray-500 mt-1">Granularity</div>
          </div>
        </div>

        <!-- Chart bars -->
        @if (result()!.buckets.length > 0) {
          <div class="bg-white border rounded-lg p-4 mb-6">
            <div class="flex items-end gap-1 h-48 overflow-x-auto">
              @for (bucket of result()!.buckets; track bucket.periodStart) {
                @if (bucket.quotationCount > 0 || result()!.totalQuotations === 0) {
                  <div class="flex flex-col items-center gap-1 flex-shrink-0" style="min-width: 28px">
                    <span class="text-xs text-gray-500">{{ bucket.quotationCount }}</span>
                    <div class="w-full bg-blue-500 rounded-t"
                         [style.height]="barHeight(bucket.quotationCount) + 'px'"
                         [title]="bucket.periodStart + ': ' + bucket.quotationCount">
                    </div>
                    <span class="text-xs text-gray-400 rotate-45 origin-left" style="font-size:9px">
                      {{ formatDate(bucket.periodStart) }}
                    </span>
                  </div>
                }
              }
            </div>
          </div>
        }

        <!-- Data table -->
        <div class="bg-white border rounded-lg overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="text-left p-3 font-medium text-gray-600">Period</th>
                <th class="text-right p-3 font-medium text-gray-600">Quotations</th>
              </tr>
            </thead>
            <tbody>
              @for (bucket of result()!.buckets; track bucket.periodStart) {
                @if (bucket.quotationCount > 0) {
                  <tr class="border-t hover:bg-gray-50">
                    <td class="p-3 text-gray-800">{{ bucket.periodStart | date:'dd MMM yyyy' }}</td>
                    <td class="p-3 text-right font-medium text-blue-700">{{ bucket.quotationCount }}</td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `
})
export class UsageStatisticsComponent {
  private readonly api = inject(ReportingApiService);

  result = signal<UsageStatisticsResult | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  exporting = signal(false);

  fromDate = this.defaultFrom();
  toDate = new Date().toISOString().split('T')[0];
  granularity = 'daily';

  private defaultFrom(): string {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.result.set(await this.api.getUsageStatistics(this.fromDate, this.toDate, this.granularity));
    } catch {
      this.error.set('Failed to load report. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async exportReport(format: 'pdf' | 'xlsx'): Promise<void> {
    this.exporting.set(true);
    try {
      const blob = await this.api.exportReport(
        'usage-statistics', format, this.fromDate, this.toDate,
        { granularity: this.granularity });
      triggerDownload(blob, `usage_statistics.${format}`);
    } catch {
      this.error.set('Export failed. Please try again.');
    } finally {
      this.exporting.set(false);
    }
  }

  barHeight(count: number): number {
    const r = this.result();
    if (!r || r.totalQuotations === 0) return 4;
    const max = Math.max(...r.buckets.map(b => b.quotationCount));
    return max === 0 ? 4 : Math.max(4, Math.round((count / max) * 140));
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
