import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReportingApiService, TopVehicleModelsResult } from '../../core/reporting-api.service';

@Component({
  selector: 'app-top-models',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="p-6 max-w-4xl mx-auto">
      <div class="flex items-center gap-3 mb-6">
        <a routerLink="/reporting" class="text-sm text-gray-500 hover:text-gray-700">← Reports</a>
        <h1 class="text-2xl font-semibold">Top Vehicle Models</h1>
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
            <div class="text-center py-12 text-gray-400">No quotations in this date range.</div>
          } @else {
            <table class="w-full text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="text-center p-3 font-medium text-gray-600 w-16">Rank</th>
                  <th class="text-left p-3 font-medium text-gray-600">Make</th>
                  <th class="text-left p-3 font-medium text-gray-600">Model</th>
                  <th class="text-right p-3 font-medium text-gray-600">Quotations</th>
                  <th class="p-3 w-48"></th>
                </tr>
              </thead>
              <tbody>
                @for (item of result()!.items; track item.rank) {
                  <tr class="border-t hover:bg-gray-50">
                    <td class="p-3 text-center">
                      @if (item.rank <= 3) {
                        <span class="font-bold text-lg">{{ item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : '🥉' }}</span>
                      } @else {
                        <span class="text-gray-500">{{ item.rank }}</span>
                      }
                    </td>
                    <td class="p-3 text-gray-700">{{ item.vehicleMake }}</td>
                    <td class="p-3 font-medium text-gray-900">{{ item.vehicleModel }}</td>
                    <td class="p-3 text-right font-semibold text-blue-700">{{ item.quotationCount }}</td>
                    <td class="p-3">
                      <div class="bg-blue-100 rounded-full h-2">
                        <div class="bg-blue-500 h-2 rounded-full"
                             [style.width]="barPct(item.quotationCount) + '%'"></div>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      }
    </div>
  `
})
export class TopModelsComponent {
  private readonly api = inject(ReportingApiService);

  result = signal<TopVehicleModelsResult | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  exporting = signal(false);

  fromDate = this.defaultFrom();
  toDate = new Date().toISOString().split('T')[0];

  private defaultFrom(): string {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.result.set(await this.api.getTopModels(this.fromDate, this.toDate));
    } catch {
      this.error.set('Failed to load report. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async exportReport(format: 'pdf' | 'xlsx'): Promise<void> {
    this.exporting.set(true);
    try {
      const blob = await this.api.exportReport('top-vehicle-models', format, this.fromDate, this.toDate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `top_models.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      this.error.set('Export failed. Please try again.');
    } finally {
      this.exporting.set(false);
    }
  }

  barPct(count: number): number {
    const items = this.result()?.items ?? [];
    const max = items[0]?.quotationCount ?? 1;
    return Math.round((count / max) * 100);
  }
}
