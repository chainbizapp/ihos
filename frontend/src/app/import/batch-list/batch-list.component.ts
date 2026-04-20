import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ImportApiService, ImportBatchSummary } from '../../core/import-api.service';

interface BatchProgress {
  found: boolean;
  status?: string;
  stage?: string;
  processedRows?: number;
  totalRows?: number;
  elapsedSeconds?: number;
  etaSeconds?: number | null;
}

@Component({
  selector: 'app-batch-list',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, FormsModule],
  template: `
    <!-- Import tab strip -->
    <div class="bg-white border-b px-6 sticky top-16 z-30">
      <div class="max-w-screen-xl mx-auto flex gap-1">
        <a routerLink="/import/batches"
           routerLinkActive="!border-[#006874] !text-[#006874] font-semibold"
           class="px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 transition-colors">
          📥 Pricing Data
        </a>
        <a routerLink="/import/vehicles/sync"
           routerLinkActive="!border-[#006874] !text-[#006874] font-semibold"
           class="px-4 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 transition-colors">
          🚗 Vehicle Database
        </a>
      </div>
    </div>

    <div class="p-6">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-semibold">Import Batches</h1>
        <a routerLink="/import/upload" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">
          + New Upload
        </a>
      </div>

      <!-- Filters -->
      <div class="flex gap-3 mb-4 flex-wrap">
        <select [(ngModel)]="statusFilter" (ngModelChange)="load()" class="border rounded px-3 py-1.5 text-sm">
          <option value="">All Statuses</option>
          <option value="Processing">Processing</option>
          <option value="PendingReview">Pending Review</option>
          <option value="Published">Published</option>
          <option value="Rejected">Rejected</option>
          <option value="Failed">Failed</option>
        </select>
      </div>

      <!-- Table -->
      @if (loading()) {
        <div class="text-gray-500 py-8 text-center">Loading...</div>
      } @else if (batches().length === 0) {
        <div class="text-gray-500 py-8 text-center">No import batches found.</div>
      } @else {
        <div class="overflow-auto">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="bg-gray-50 text-left text-gray-600">
                <th class="px-4 py-2 border-b font-medium">Company</th>
                <th class="px-4 py-2 border-b font-medium">File</th>
                <th class="px-4 py-2 border-b font-medium">Uploaded</th>
                <th class="px-4 py-2 border-b font-medium">Status</th>
                <th class="px-4 py-2 border-b font-medium text-right">Total</th>
                <th class="px-4 py-2 border-b font-medium text-right">Resolved</th>
                <th class="px-4 py-2 border-b font-medium text-right">Pending</th>
                <th class="px-4 py-2 border-b font-medium text-right">Approved</th>
                <th class="px-4 py-2 border-b font-medium text-right">Rejected</th>
                <th class="px-4 py-2 border-b"></th>
              </tr>
            </thead>
            <tbody>
              @for (batch of batches(); track batch.id) {
                <tr class="hover:bg-gray-50 border-b" [class.bg-blue-50]="batch.status === 'Processing'">
                  <td class="px-4 py-2">{{ batch.companyName }}</td>
                  <td class="px-4 py-2 max-w-xs truncate" [title]="batch.sourceFileName">{{ batch.sourceFileName }}</td>
                  <td class="px-4 py-2 whitespace-nowrap">{{ batch.uploadedAt | date:'dd/MM/yy HH:mm' }}</td>

                  <!-- Status cell — shows progress bar when Processing -->
                  <td class="px-4 py-2 min-w-[160px]">
                    @if (batch.status === 'Processing' && getProgress(batch.id); as prog) {
                      @if (prog.found && prog.totalRows && prog.totalRows > 0) {
                        <div class="flex flex-col gap-1">
                          <div class="flex items-center gap-1.5">
                            <div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0"></div>
                            <span class="text-blue-700 text-xs font-medium">{{ prog.stage ?? 'Processing...' }}</span>
                          </div>
                          <!-- Progress bar -->
                          <div class="w-full bg-blue-200 rounded-full h-1">
                            <div class="bg-blue-600 h-1 rounded-full transition-all duration-500"
                                 [style.width.%]="pct(prog)"></div>
                          </div>
                          <div class="flex justify-between text-[10px] text-blue-600 font-mono">
                            <span>{{ (prog.processedRows ?? 0) | number }} / {{ prog.totalRows | number }}</span>
                            <span>{{ eta(prog) }}</span>
                          </div>
                        </div>
                      } @else {
                        <!-- Job found but totalRows not known yet (still parsing Excel) -->
                        <div class="flex items-center gap-1.5">
                          <div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0"></div>
                          <span class="text-blue-700 text-xs font-medium">{{ prog.found ? (prog.stage ?? 'Processing...') : 'Processing...' }}</span>
                        </div>
                      }
                    } @else {
                      <span [class]="statusClass(batch.status)" class="px-2 py-0.5 rounded text-xs font-medium">
                        {{ batch.status === 'PendingReview' ? 'Pending Review' : batch.status }}
                      </span>
                    }
                  </td>

                  <td class="px-4 py-2 text-right">{{ batch.totalRows | number }}</td>
                  <td class="px-4 py-2 text-right text-green-700">{{ batch.resolvedRows }}</td>
                  <td class="px-4 py-2 text-right text-yellow-700">{{ batch.pendingRows }}</td>
                  <td class="px-4 py-2 text-right text-blue-700">{{ batch.approvedRows }}</td>
                  <td class="px-4 py-2 text-right text-red-700">{{ batch.rejectedRows }}</td>
                  <td class="px-4 py-2">
                    <div class="flex items-center gap-3">
                      <a [routerLink]="['/import/batches', batch.id]" class="text-blue-600 hover:underline text-xs">View</a>
                      @if (batch.status !== 'Processing') {
                        <button (click)="confirmDelete(batch)"
                                class="text-red-500 hover:text-red-700 text-xs hover:underline">
                          Delete
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="flex justify-between items-center mt-4 text-sm text-gray-600">
          <span>{{ paginationLabel() }}</span>
          <div class="flex gap-2">
            <button (click)="prevPage()" [disabled]="page() <= 1" class="px-3 py-1 border rounded disabled:opacity-40">Prev</button>
            <button (click)="nextPage()" [disabled]="page() * pageSize() >= totalCount()" class="px-3 py-1 border rounded disabled:opacity-40">Next</button>
          </div>
        </div>
      }
    </div>

    <!-- Delete confirmation modal -->
    @if (deleteTarget()) {
      <div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
        <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
          <h2 class="text-lg font-semibold mb-1">Delete Import Batch?</h2>
          <p class="text-sm text-gray-600 mb-4">
            <span class="font-medium">{{ deleteTarget()!.sourceFileName }}</span> · {{ deleteTarget()!.companyName }}<br>
            The batch will be hidden from this list. All audit history is preserved.
          </p>
          <label class="block text-sm font-medium text-gray-700 mb-1">Reason <span class="text-gray-400 font-normal">(optional)</span></label>
          <input [(ngModel)]="deleteReason" placeholder="e.g. Uploaded by mistake"
                 class="w-full border rounded px-3 py-1.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-300">
          <div class="flex justify-end gap-3">
            <button (click)="cancelDelete()" class="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
            <button (click)="executeDelete()" [disabled]="deleting()"
                    class="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
              {{ deleting() ? 'Deleting…' : 'Delete Batch' }}
            </button>
          </div>
          @if (deleteError()) {
            <p class="text-red-600 text-sm mt-3">{{ deleteError() }}</p>
          }
        </div>
      </div>
    }
  `
})
export class BatchListComponent implements OnInit, OnDestroy {
  private readonly importApi = inject(ImportApiService);

  batches    = signal<ImportBatchSummary[]>([]);
  loading    = signal(true);
  page       = signal(1);
  pageSize   = signal(20);
  totalCount = signal(0);
  statusFilter = '';

  // Per-batch progress, keyed by batchId
  private progressMap = signal<Map<string, BatchProgress>>(new Map());

  // Delete flow
  deleteTarget  = signal<ImportBatchSummary | null>(null);
  deleting      = signal(false);
  deleteError   = signal('');
  deleteReason  = '';

  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  paginationLabel(): string {
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end   = Math.min(this.page() * this.pageSize(), this.totalCount());
    return `${start}–${end} of ${this.totalCount()}`;
  }

  ngOnInit(): void { this.load(); }

  ngOnDestroy(): void { this.stopPoll(); }

  async load(): Promise<void> {
    this.loading.set(true);
    this.stopPoll();
    try {
      const result = await this.importApi.getBatches({
        page: this.page(),
        pageSize: this.pageSize(),
        status: this.statusFilter || undefined
      });
      this.batches.set(result.items);
      this.totalCount.set(result.totalCount);

      // Start polling if any batch is still Processing
      if (result.items.some(b => b.status === 'Processing'))
        this.scheduleProgressPoll();
    } finally {
      this.loading.set(false);
    }
  }

  getProgress(batchId: string): BatchProgress | undefined {
    return this.progressMap().get(batchId);
  }

  pct(prog: BatchProgress): number {
    if (!prog.totalRows || prog.totalRows === 0) return 0;
    return Math.min(100, Math.round((prog.processedRows ?? 0) / prog.totalRows * 100));
  }

  eta(prog: BatchProgress): string {
    const s = prog.etaSeconds;
    if (s == null) return '';
    if (s < 60) return `~${s}s`;
    return `~${Math.ceil(s / 60)}m`;
  }

  private scheduleProgressPoll(): void {
    this.pollTimer = setTimeout(() => this.pollProgress(), 3000);
  }

  private async pollProgress(): Promise<void> {
    const processing = this.batches().filter(b => b.status === 'Processing');
    if (processing.length === 0) return;

    const updated = new Map(this.progressMap());
    let anyStillRunning = false;

    await Promise.all(processing.map(async batch => {
      try {
        const prog = await this.importApi.getBatchProgress(batch.id);
        updated.set(batch.id, prog);
        if (prog.found && prog.status === 'processing') anyStillRunning = true;
        // If job completed, reload the batch list so the status row updates
        if (prog.found && prog.status === 'done') this.load();
      } catch { /* ignore network errors during polling */ }
    }));

    this.progressMap.set(updated);
    if (anyStillRunning) this.scheduleProgressPoll();
  }

  private stopPoll(): void {
    if (this.pollTimer) { clearTimeout(this.pollTimer); this.pollTimer = null; }
  }

  prevPage(): void {
    if (this.page() > 1) { this.page.update(p => p - 1); this.load(); }
  }

  nextPage(): void {
    if (this.page() * this.pageSize() < this.totalCount()) {
      this.page.update(p => p + 1); this.load();
    }
  }

  confirmDelete(batch: ImportBatchSummary): void {
    this.deleteTarget.set(batch);
    this.deleteReason = '';
    this.deleteError.set('');
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  async executeDelete(): Promise<void> {
    const target = this.deleteTarget();
    if (!target) return;
    this.deleting.set(true);
    this.deleteError.set('');
    try {
      await this.importApi.deleteBatch(target.id, this.deleteReason || undefined);
      this.deleteTarget.set(null);
      await this.load();
    } catch (err: any) {
      this.deleteError.set(err?.error?.error ?? 'Delete failed. Please try again.');
    } finally {
      this.deleting.set(false);
    }
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      Processing:    'bg-blue-100 text-blue-700',
      PendingReview: 'bg-yellow-100 text-yellow-700',
      Published:     'bg-green-100 text-green-700',
      Rejected:      'bg-red-100 text-red-700',
      Failed:        'bg-gray-100 text-gray-700'
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  }
}
