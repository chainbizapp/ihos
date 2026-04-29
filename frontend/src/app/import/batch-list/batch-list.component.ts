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
  styles: [`
    :host { font-family: 'Noto Sans Thai', sans-serif; }
    .tab-link { display:flex;align-items:center;gap:6px;padding:12px 16px;font-size:13px;font-weight:600;border-bottom:2px solid transparent;color:#6b7a8d;text-decoration:none;transition:all .15s;white-space:nowrap }
    .tab-link:hover { color:#006874;background:rgba(0,104,116,0.04) }
    .tab-link.active-tab { border-bottom-color:#006874;color:#006874 }
    .badge { display:inline-flex;align-items:center;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.02em }
    .badge-processing { background:#dbeafe;color:#1d4ed8 }
    .badge-pendingreview { background:#fef9c3;color:#92400e }
    .badge-published { background:#d1fae5;color:#065f46 }
    .badge-rejected { background:#fee2e2;color:#991b1b }
    .badge-failed { background:#f3f4f6;color:#374151 }
    .btn-primary { display:inline-flex;align-items:center;gap:6px;padding:9px 18px;background:#006874;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;transition:all .15s;box-shadow:0 2px 8px rgba(0,104,116,.25) }
    .btn-primary:hover { background:#005a65;box-shadow:0 4px 14px rgba(0,104,116,.35);transform:translateY(-1px) }
    .filter-select { background:#fff;border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 14px;font-size:13px;color:#171c22;outline:none;cursor:pointer;min-width:160px;transition:border-color .15s }
    .filter-select:focus { border-color:#006874;box-shadow:0 0 0 3px rgba(0,104,116,.1) }
    .data-table { width:100%;border-collapse:collapse }
    .data-table th { padding:10px 14px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#6b7a8d;text-align:left;border-bottom:2px solid #f0f4fd;white-space:nowrap }
    .data-table th.right { text-align:right }
    .data-table td { padding:12px 14px;font-size:13px;color:#171c22;border-bottom:1px solid #f5f7fa;vertical-align:middle }
    .data-table td.right { text-align:right }
    .data-table tr:hover td { background:#f7fdfd }
    .data-table tr.processing-row td { background:#eff6ff }
    .data-table tr.processing-row:hover td { background:#dbeafe }
    .stat-num { font-size:13px;font-weight:700 }
    .stat-resolved { color:#059669 }
    .stat-pending { color:#d97706 }
    .stat-approved { color:#2563eb }
    .stat-rejected { color:#dc2626 }
    .action-link { font-size:12px;font-weight:700;color:#006874;text-decoration:none;padding:4px 8px;border-radius:6px;transition:background .12s }
    .action-link:hover { background:rgba(0,104,116,.08) }
    .action-del { font-size:12px;font-weight:700;color:#dc2626;background:none;border:none;cursor:pointer;padding:4px 8px;border-radius:6px;transition:background .12s }
    .action-del:hover { background:#fee2e2 }
    .pagination-btn { padding:6px 14px;border:1.5px solid #e2e8f0;border-radius:8px;background:#fff;font-size:13px;font-weight:600;color:#374151;cursor:pointer;transition:all .12s }
    .pagination-btn:hover:not(:disabled) { border-color:#006874;color:#006874;background:#f7fdfd }
    .pagination-btn:disabled { opacity:.4;cursor:not-allowed }
    .empty-state { display:flex;flex-direction:column;align-items:center;justify-content:center;padding:64px 24px;gap:12px }
    .modal-overlay { position:fixed;inset:0;background:rgba(17,48,105,.45);backdrop-filter:blur(4px);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn .15s ease }
    .modal-card { background:#fff;border-radius:20px;width:100%;max-width:440px;box-shadow:0 24px 60px rgba(0,0,0,.2);animation:slideUp .18s ease;overflow:hidden }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    @keyframes slideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  `],
  template: `
    <!-- Tab strip -->
    <div style="background:#fff;border-bottom:1px solid #edf1f7;position:sticky;top:64px;z-index:30">
      <div style="max-width:1280px;margin:0 auto;padding:0 24px;display:flex;gap:4px">
        <a routerLink="/import/batches" routerLinkActive="active-tab" class="tab-link">
          <svg viewBox="0 0 256 256" fill="currentColor" style="width:14px;height:14px"><path d="M213.32,210.32A8,8,0,0,1,205.66,216H50.34a8,8,0,0,1-6.39-12.76l56-72A8,8,0,0,1,112.63,128H184a8,8,0,0,1,0,16h-63l-44.8,57.56A8,8,0,0,1,50.34,216H205.66A8,8,0,0,1,213.32,210.32ZM232,88v32a8,8,0,0,1-16,0V88a8,8,0,0,1,16,0ZM40,152V120a8,8,0,0,1,16,0v32a8,8,0,0,1-16,0Zm96-96H104V40a8,8,0,0,0-16,0V56H72a8,8,0,0,0,0,16h16V88a8,8,0,0,0,16,0V72h16a8,8,0,0,0,0-16Z"/></svg>
          Pricing Data
        </a>
        <a routerLink="/import/vehicles/sync" routerLinkActive="active-tab" class="tab-link">
          <svg viewBox="0 0 256 256" fill="currentColor" style="width:14px;height:14px"><path d="M240,112H229.2L201.42,49.5A16,16,0,0,0,186.8,40H69.2a16,16,0,0,0-14.62,9.5L26.8,112H16a8,8,0,0,0,0,16h8v80a16,16,0,0,0,16,16H64a16,16,0,0,0,16-16V192h96v16a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V128h8a8,8,0,0,0,0-16ZM69.2,56H186.8l24.89,56H44.31ZM64,208H40V192H64Zm128,0V192h24v16Zm24-32H40V128H216ZM72,160a12,12,0,1,1,12,12A12,12,0,0,1,72,160Zm100,0a12,12,0,1,1,12,12A12,12,0,0,1,172,160Z"/></svg>
          Vehicle Database
        </a>
      </div>
    </div>

    <!-- Page body -->
    <div style="background:#f0f4fd;min-height:calc(100vh - 112px);padding:28px 24px">
      <div style="max-width:1280px;margin:0 auto">

        <!-- Page header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#006874;margin-bottom:4px">Data Management</div>
            <h1 style="font-size:26px;font-weight:900;color:#004d58;margin:0;font-family:'Plus Jakarta Sans',sans-serif">Import Batches</h1>
          </div>
          <a routerLink="/import/upload" class="btn-primary">
            <svg viewBox="0 0 256 256" fill="currentColor" style="width:15px;height:15px"><path d="M224,152v56a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V152a8,8,0,0,1,16,0v56H208V152a8,8,0,0,1,16,0ZM88.49,88.49,120,56.69V152a8,8,0,0,0,16,0V56.69l31.51,31.8a8,8,0,1,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,1,0,88.49,88.49Z"/></svg>
            New Upload
          </a>
        </div>

        <!-- Filter bar -->
        <div style="background:#fff;border-radius:14px;padding:14px 18px;margin-bottom:18px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 8px rgba(17,48,105,.06);flex-wrap:wrap">
          <svg viewBox="0 0 256 256" fill="#9aa5b4" style="width:15px;height:15px;flex-shrink:0"><path d="M230.6,49.53A15.81,15.81,0,0,0,216,40H40A16,16,0,0,0,28.19,66.76l.08.09L96,139.17V216a16,16,0,0,0,24.87,13.32l32-21.34A16,16,0,0,0,160,194.66V139.17l67.74-72.32.08-.09A15.8,15.8,0,0,0,230.6,49.53ZM143.94,128.68A8,8,0,0,0,144,130v64.66l-32,21.34V130a8,8,0,0,0-2.06-5.32L40,56H216Z"/></svg>
          <span style="font-size:12px;font-weight:700;color:#6b7a8d;text-transform:uppercase;letter-spacing:.06em">Filter</span>
          <select [(ngModel)]="statusFilter" (ngModelChange)="load()" class="filter-select">
            <option value="">All Statuses</option>
            <option value="Processing">Processing</option>
            <option value="PendingReview">Pending Review</option>
            <option value="Published">Published</option>
            <option value="Rejected">Rejected</option>
            <option value="Failed">Failed</option>
          </select>
          @if (totalCount() > 0) {
            <span style="margin-left:auto;font-size:12px;color:#9aa5b4;font-weight:600">{{ totalCount() | number }} total</span>
          }
        </div>

        <!-- Table card -->
        <div style="background:#fff;border-radius:16px;box-shadow:0 2px 16px rgba(17,48,105,.07);overflow:hidden">

          @if (loading()) {
            <div style="padding:64px 24px;text-align:center">
              <div style="width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#006874;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px"></div>
              <div style="font-size:13px;color:#9aa5b4;font-weight:600">Loading batches…</div>
            </div>
          } @else if (batches().length === 0) {
            <div class="empty-state">
              <div style="width:56px;height:56px;border-radius:16px;background:rgba(0,104,116,.08);display:flex;align-items:center;justify-content:center">
                <svg viewBox="0 0 256 256" fill="#006874" style="width:26px;height:26px"><path d="M213.32,210.32A8,8,0,0,1,205.66,216H50.34a8,8,0,0,1-6.39-12.76l56-72A8,8,0,0,1,112.63,128H184a8,8,0,0,1,0,16h-63l-44.8,57.56A8,8,0,0,1,50.34,216H205.66A8,8,0,0,1,213.32,210.32Z"/></svg>
              </div>
              <div style="font-size:15px;font-weight:700;color:#171c22">No import batches found</div>
              <div style="font-size:13px;color:#9aa5b4">Upload a pricing file to get started</div>
              <a routerLink="/import/upload" class="btn-primary" style="margin-top:4px">+ New Upload</a>
            </div>
          } @else {
            <div style="overflow-x:auto">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>File</th>
                    <th>Uploaded</th>
                    <th>Status</th>
                    <th class="right">Total</th>
                    <th class="right">Resolved</th>
                    <th class="right">Pending</th>
                    <th class="right">Approved</th>
                    <th class="right">Rejected</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (batch of batches(); track batch.id) {
                    <tr [class.processing-row]="batch.status === 'Processing'">
                      <td>
                        <span style="font-weight:700;color:#171c22">{{ batch.companyName }}</span>
                      </td>
                      <td style="max-width:200px">
                        <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#6b7a8d" [title]="batch.sourceFileName">{{ batch.sourceFileName }}</div>
                      </td>
                      <td style="white-space:nowrap;color:#6b7a8d;font-size:12px">{{ batch.uploadedAt | date:'dd MMM yy, HH:mm' }}</td>

                      <!-- Status / Progress cell -->
                      <td style="min-width:170px">
                        @if (batch.status === 'Processing' && getProgress(batch.id); as prog) {
                          @if (prog.found && prog.totalRows && prog.totalRows > 0) {
                            <div style="display:flex;flex-direction:column;gap:4px">
                              <div style="display:flex;align-items:center;gap:6px">
                                <div style="width:7px;height:7px;border-radius:50%;background:#2563eb;animation:pulse 1.5s infinite"></div>
                                <span style="font-size:11px;font-weight:700;color:#1d4ed8">{{ prog.stage ?? 'Processing…' }}</span>
                              </div>
                              <div style="height:4px;background:#dbeafe;border-radius:4px;overflow:hidden">
                                <div style="height:100%;background:#2563eb;border-radius:4px;transition:width .5s" [style.width.%]="pct(prog)"></div>
                              </div>
                              <div style="display:flex;justify-content:space-between;font-size:10px;color:#3b82f6;font-family:monospace">
                                <span>{{ (prog.processedRows ?? 0) | number }} / {{ prog.totalRows | number }}</span>
                                <span>{{ eta(prog) }}</span>
                              </div>
                            </div>
                          } @else {
                            <div style="display:flex;align-items:center;gap:6px">
                              <div style="width:7px;height:7px;border-radius:50%;background:#2563eb;animation:pulse 1.5s infinite"></div>
                              <span style="font-size:11px;font-weight:700;color:#1d4ed8">{{ prog.found ? (prog.stage ?? 'Processing…') : 'Processing…' }}</span>
                            </div>
                          }
                        } @else {
                          <span class="badge" [class]="badgeClass(batch.status)">
                            {{ batch.status === 'PendingReview' ? 'Pending Review' : batch.status }}
                          </span>
                        }
                      </td>

                      <td class="right"><span class="stat-num">{{ batch.totalRows | number }}</span></td>
                      <td class="right"><span class="stat-num stat-resolved">{{ batch.resolvedRows }}</span></td>
                      <td class="right"><span class="stat-num stat-pending">{{ batch.pendingRows }}</span></td>
                      <td class="right"><span class="stat-num stat-approved">{{ batch.approvedRows }}</span></td>
                      <td class="right"><span class="stat-num stat-rejected">{{ batch.rejectedRows }}</span></td>
                      <td>
                        <div style="display:flex;align-items:center;gap:4px">
                          <a [routerLink]="['/import/batches', batch.id]" class="action-link">View →</a>
                          @if (batch.status !== 'Processing') {
                            <button (click)="confirmDelete(batch)" class="action-del">Delete</button>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-top:1px solid #f0f4fd">
              <span style="font-size:12px;color:#9aa5b4;font-weight:600">{{ paginationLabel() }}</span>
              <div style="display:flex;gap:8px">
                <button class="pagination-btn" (click)="prevPage()" [disabled]="page() <= 1">← Prev</button>
                <button class="pagination-btn" (click)="nextPage()" [disabled]="page() * pageSize() >= totalCount()">Next →</button>
              </div>
            </div>
          }
        </div>

      </div>
    </div>

    <!-- Delete modal -->
    @if (deleteTarget()) {
      <div class="modal-overlay" (click)="cancelDelete()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div style="padding:20px 24px 16px;border-bottom:1px solid #f0f4fd">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:36px;height:36px;border-radius:10px;background:#fee2e2;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <svg viewBox="0 0 256 256" fill="#dc2626" style="width:18px;height:18px"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96ZM192,208H64V64H192Z"/></svg>
              </div>
              <div>
                <div style="font-size:15px;font-weight:800;color:#171c22">Delete Import Batch?</div>
                <div style="font-size:12px;color:#9aa5b4;margin-top:1px">This action cannot be undone</div>
              </div>
            </div>
          </div>
          <div style="padding:16px 24px">
            <div style="font-size:13px;color:#374151;margin-bottom:16px;padding:10px 14px;background:#fafafa;border-radius:10px;border:1px solid #f0f4fd">
              <div style="font-weight:700;color:#171c22">{{ deleteTarget()!.sourceFileName }}</div>
              <div style="font-size:11px;color:#9aa5b4;margin-top:2px">{{ deleteTarget()!.companyName }} · Audit history preserved</div>
            </div>
            <label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7a8d;margin-bottom:6px">Reason <span style="font-weight:400;text-transform:none">(optional)</span></label>
            <input [(ngModel)]="deleteReason" placeholder="e.g. Uploaded by mistake"
                   style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:9px 14px;font-size:13px;outline:none;box-sizing:border-box;transition:border-color .15s;font-family:inherit"
                   (focus)="$any($event.target).style.borderColor='#006874'"
                   (blur)="$any($event.target).style.borderColor='#e2e8f0'" />
          </div>
          <div style="padding:12px 24px 20px;display:flex;justify-content:flex-end;gap:10px">
            <button (click)="cancelDelete()" style="padding:9px 18px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;font-size:13px;font-weight:600;color:#6b7a8d;cursor:pointer;font-family:inherit">Cancel</button>
            <button (click)="executeDelete()" [disabled]="deleting()"
                    style="padding:9px 18px;border:none;border-radius:10px;background:#dc2626;color:#fff;font-size:13px;font-weight:700;cursor:pointer;opacity:1;transition:opacity .15s;font-family:inherit"
                    [style.opacity]="deleting() ? '0.6' : '1'">
              {{ deleting() ? 'Deleting…' : 'Delete Batch' }}
            </button>
          </div>
          @if (deleteError()) {
            <div style="padding:0 24px 16px;font-size:12px;color:#dc2626;font-weight:600">⚠ {{ deleteError() }}</div>
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
