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
  
  templateUrl: './batch-list.component.html',
  styleUrl: './batch-list.component.scss'
})
export class BatchListComponent implements OnInit, OnDestroy {
  private readonly importApi = inject(ImportApiService);

  batches    = signal<ImportBatchSummary[]>([]);
  loading    = signal(true);
  page       = signal(1);
  pageSize   = signal(20);
  totalCount = signal(0);
  statusFilter = '';

  private progressMap = signal<Map<string, BatchProgress>>(new Map());

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

  badgeClass(status: string): string {
    const map: Record<string, string> = {
      Processing:    'badge-processing',
      PendingReview: 'badge-pendingreview',
      Published:     'badge-published',
      Rejected:      'badge-rejected',
      Failed:        'badge-failed'
    };
    return map[status] ?? 'badge-failed';
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
        if (prog.found && prog.status === 'done') this.load();
      } catch { /* ignore */ }
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

  cancelDelete(): void { this.deleteTarget.set(null); }

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

  statusClass(status: string): string { return this.badgeClass(status); }
}
