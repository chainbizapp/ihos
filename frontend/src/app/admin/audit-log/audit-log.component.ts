import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actionType: string;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  outcome: string;
  metadata: string | null;
  occurredAt: string;
}

interface PagedResult {
  items: AuditLogEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
}

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.scss'
})
export class AuditLogComponent {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  result = signal<PagedResult | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  currentPage = signal(1);

  actionType = '';
  fromDate = this.defaultFrom();
  toDate = new Date().toISOString().split('T')[0];
  readonly pageSize = 25;

  private defaultFrom(): string {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }

  async load(page = 1): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.currentPage.set(page);
    try {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(this.pageSize),
      };
      if (this.actionType.trim()) params['actionType'] = this.actionType.trim();
      if (this.fromDate) params['from'] = this.fromDate;
      if (this.toDate) params['to'] = this.toDate;

      const query = new URLSearchParams(params).toString();
      const data = await firstValueFrom(
        this.http.get<PagedResult>(`${this.api}/audit-logs?${query}`)
      );
      this.result.set(data);
    } catch {
      this.error.set('Failed to load audit log. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  prevPage(): void { if (this.currentPage() > 1) this.load(this.currentPage() - 1); }
  nextPage(): void {
    const r = this.result();
    if (r && this.currentPage() * this.pageSize < r.totalCount) this.load(this.currentPage() + 1);
  }

  paginationLabel(): string {
    const r = this.result();
    if (!r) return '';
    const start = (r.page - 1) * r.pageSize + 1;
    const end = Math.min(r.page * r.pageSize, r.totalCount);
    return `${start}–${end} of ${r.totalCount}`;
  }

  outcomeClass(outcome: string): string {
    const base = 'px-2 py-0.5 rounded text-xs font-medium ';
    switch (outcome.toLowerCase()) {
      case 'success': return base + 'bg-green-100 text-green-700';
      case 'failure':
      case 'denied': return base + 'bg-red-100 text-red-700';
      default: return base + 'bg-gray-100 text-gray-600';
    }
  }
}
