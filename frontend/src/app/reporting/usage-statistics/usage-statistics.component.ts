import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReportingApiService, UsageStatisticsResult } from '../../core/reporting-api.service';

@Component({
  selector: 'app-usage-statistics',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './usage-statistics.component.html',
  styleUrl: './usage-statistics.component.scss'
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
