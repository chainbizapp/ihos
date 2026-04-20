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
  template: `
    <div class="p-6 max-w-6xl mx-auto">
      <h1 class="text-2xl font-semibold mb-6">Audit Log</h1>

      <!-- Filters -->
      <div class="bg-white border rounded-lg p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Action Type</label>
          <input type="text" [(ngModel)]="actionType" placeholder="e.g. LOGIN, IMPORT_UPLOAD"
            class="border rounded px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
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
          Filter
        </button>
      </div>

      @if (error()) {
        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">{{ error() }}</div>
      }

      @if (loading()) {
        <div class="text-center py-16 text-gray-400">Loading...</div>
      } @else if (result()) {
        <div class="bg-white border rounded-lg overflow-hidden">
          @if (result()!.items.length === 0) {
            <div class="text-center py-12 text-gray-400">No audit records found.</div>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="text-left p-3 font-medium text-gray-600">Time</th>
                    <th class="text-left p-3 font-medium text-gray-600">Action</th>
                    <th class="text-left p-3 font-medium text-gray-600">Entity</th>
                    <th class="text-left p-3 font-medium text-gray-600">IP</th>
                    <th class="text-left p-3 font-medium text-gray-600">Outcome</th>
                    <th class="text-left p-3 font-medium text-gray-600">Details</th>
                  </tr>
                </thead>
                <tbody>
                  @for (entry of result()!.items; track entry.id) {
                    <tr class="border-t hover:bg-gray-50">
                      <td class="p-3 text-gray-500 text-xs whitespace-nowrap">
                        {{ entry.occurredAt | date:'dd MMM yyyy HH:mm:ss' }}
                      </td>
                      <td class="p-3 font-mono text-xs text-blue-700">{{ entry.actionType }}</td>
                      <td class="p-3 text-xs text-gray-600">
                        @if (entry.entityType) {
                          <span>{{ entry.entityType }}</span>
                          @if (entry.entityId) {
                            <br><span class="text-gray-400 font-mono">{{ entry.entityId | slice:0:8 }}…</span>
                          }
                        } @else {
                          <span class="text-gray-300">—</span>
                        }
                      </td>
                      <td class="p-3 text-xs text-gray-500 font-mono">{{ entry.ipAddress ?? '—' }}</td>
                      <td class="p-3">
                        <span [class]="outcomeClass(entry.outcome)">{{ entry.outcome }}</span>
                      </td>
                      <td class="p-3 text-xs text-gray-500 max-w-xs truncate" [title]="entry.metadata ?? ''">
                        {{ entry.metadata ? (entry.metadata | slice:0:60) : '—' }}
                      </td>
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
                  [disabled]="currentPage() * pageSize >= (result()?.totalCount ?? 0)"
                  class="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">Next</button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `
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
