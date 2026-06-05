import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  ProviderSyncStatus, SyncApiService, SyncHistoryRow,
} from './sync-api.service';

/**
 * Admin Sync page — Phase 5 US3.
 * Lists every active InsuranceCompany with its latest sync state and a "Sync Now" button
 * for API-source providers. Polls /status every 5 s while any sync is Running. Bottom
 * panel shows the last 20 sync runs across all providers.
 */
@Component({
  selector: 'app-mapping-sync',
  standalone: true,
  imports: [CommonModule, DatePipe],
  
  templateUrl: './sync.component.html',
  styleUrl: './sync.component.scss',
})
export class MappingSyncComponent implements OnInit, OnDestroy {
  private readonly api = inject(SyncApiService);

  status = signal<ProviderSyncStatus[]>([]);
  history = signal<SyncHistoryRow[]>([]);
  loading = signal(true);
  triggering = signal<string | null>(null);
  error = signal<string | null>(null);

  hasRunningSync = computed(() => this.status().some(s => s.isRunning));

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  async ngOnInit(): Promise<void> {
    await this.refreshAll();
    // Poll every 5 seconds while any sync is running. When idle, poll every 30 s
    // so newly-triggered scheduled runs still show up.
    this.pollTimer = setInterval(() => {
      const delay = this.hasRunningSync() ? 5_000 : 30_000;
      void this.refreshAll();
      // Reschedule with new cadence
      if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = setInterval(() => this.refreshAll(), delay); }
    }, 5_000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  }

  async refreshAll(): Promise<void> {
    try {
      const [status, history] = await Promise.all([
        this.api.getStatus(),
        this.api.getHistory(1, 20),
      ]);
      this.status.set(status);
      this.history.set(history.items);
      this.error.set(null);
    } catch (e: any) {
      this.error.set(e?.error?.error ?? 'โหลดข้อมูล sync ไม่สำเร็จ');
    } finally {
      this.loading.set(false);
    }
  }

  async triggerSync(s: ProviderSyncStatus): Promise<void> {
    if (s.dataSource !== 'Api' || s.isRunning) return;
    this.triggering.set(s.companyId);
    try {
      await this.api.triggerVehicleMasterSync(s.companyId);
      // Small delay then refresh — the orchestrator inserts the Running row synchronously,
      // so by the time we re-fetch /status the new row should be visible.
      await new Promise(r => setTimeout(r, 400));
      await this.refreshAll();
    } catch (e: any) {
      this.error.set(e?.error?.error ?? 'Trigger sync ไม่สำเร็จ');
    } finally {
      this.triggering.set(null);
    }
  }

  statusBadgeClass(s: ProviderSyncStatus): string {
    if (s.isRunning) return 'status-running';
    switch (s.latestStatus) {
      case 'Succeeded':     return 'status-success';
      case 'PartialSuccess':return 'status-partial';
      case 'Failed':        return 'status-failed';
      default:              return 'status-idle';
    }
  }

  statusLabel(s: ProviderSyncStatus): string {
    if (s.isRunning) return 'Running';
    return s.latestStatus ?? 'Idle';
  }

  historyStatusClass(status: string): string {
    switch (status) {
      case 'Running':        return 'status-running';
      case 'Succeeded':      return 'status-success';
      case 'PartialSuccess': return 'status-partial';
      case 'Failed':         return 'status-failed';
      default:               return 'status-idle';
    }
  }

  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms} ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    const min = Math.floor(ms / 60_000);
    const sec = Math.floor((ms % 60_000) / 1000);
    return `${min}m ${sec}s`;
  }
}
