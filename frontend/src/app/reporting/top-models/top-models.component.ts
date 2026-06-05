import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReportingApiService, TopVehicleModelsResult } from '../../core/reporting-api.service';

@Component({
  selector: 'app-top-models',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './top-models.component.html',
  styleUrl: './top-models.component.scss'
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
