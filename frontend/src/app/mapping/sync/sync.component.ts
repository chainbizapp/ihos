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
  styles: [`
    .card { background:#fff; border-radius:24px; box-shadow:0 12px 32px rgba(17,48,105,0.06); }
    .status-running    { background:#fef3e8; color:#8c4f00; }
    .status-success    { background:#e6f4f5; color:#006874; }
    .status-partial    { background:#fff3e0; color:#a06000; }
    .status-failed     { background:#fff2f2; color:#c0392b; }
    .status-idle       { background:#f0f4fd; color:#5a6270; }
    .src-import        { background:rgba(67,93,152,0.12); color:#435d98; }
    .src-api           { background:rgba(73,178,193,0.18); color:#0a7a85; }
    .pulse { animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
  `],
  template: `
<div class="min-h-screen px-6 py-8" style="background:#f0f4fd">
  <div class="max-w-screen-xl mx-auto">

    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-[22px] font-black mb-1"
          style="color:#171c22;font-family:'Plus Jakarta Sans',sans-serif">
        Vehicle Master Sync
      </h1>
      <p class="text-[13px]" style="color:#8b95a6">
        Trigger and monitor vehicle-master synchronization for each insurance provider.
        API-source providers (MTI, Viriyah) can be re-synced manually.
        Scheduled sync runs daily at 02:00 local time.
      </p>
    </div>

    @if (error()) {
      <div class="mb-6 px-5 py-4 rounded-2xl text-[14px] font-semibold"
           style="background:#fff2f2;color:#c0392b;border:1px solid rgba(192,57,43,0.12)">
        {{ error() }}
      </div>
    }

    <!-- Provider cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
      @for (s of status(); track s.companyId) {
        <div class="card px-6 py-5">
          <div class="flex items-start justify-between mb-4">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[15px] font-black" style="color:#171c22">
                  {{ s.companyDisplayName }}
                </span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      [class]="s.dataSource === 'Import' ? 'src-import' : 'src-api'">
                  {{ s.dataSource === 'Import' ? '🗃 Import' : '🌐 Live API' }}
                </span>
              </div>
              <div class="text-[11px] font-mono" style="color:#8b95a6">
                {{ s.companyShortCode }}
              </div>
            </div>

            <span class="px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5"
                  [class]="statusBadgeClass(s)">
              @if (s.isRunning) { <span class="pulse">●</span> }
              {{ statusLabel(s) }}
            </span>
          </div>

          @if (s.latestStartedAtUtc) {
            <div class="text-[12px] mb-3" style="color:#5a6270">
              Last run: {{ s.latestStartedAtUtc | date:'dd MMM y · HH:mm' }}
              @if (s.latestTrigger) {
                <span class="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
                      style="background:#f0f4fd;color:#435d98">
                  {{ s.latestTrigger }}
                </span>
              }
              @if (s.latestDurationMs != null) {
                · {{ formatDuration(s.latestDurationMs) }}
              }
            </div>

            <div class="grid grid-cols-4 gap-2 text-center mb-3">
              <div class="rounded-xl py-2" style="background:#e6f4f5;color:#006874">
                <div class="text-[16px] font-black">{{ s.latestInsertedCount }}</div>
                <div class="text-[9px] font-bold uppercase tracking-wider">Inserted</div>
              </div>
              <div class="rounded-xl py-2" style="background:#f0f4fd;color:#435d98">
                <div class="text-[16px] font-black">{{ s.latestUpdatedCount }}</div>
                <div class="text-[9px] font-bold uppercase tracking-wider">Updated</div>
              </div>
              <div class="rounded-xl py-2" style="background:#fff3e0;color:#a06000">
                <div class="text-[16px] font-black">{{ s.latestDeactivatedCount }}</div>
                <div class="text-[9px] font-bold uppercase tracking-wider">Deactivated</div>
              </div>
              <div class="rounded-xl py-2"
                   [style]="s.latestErrorCount > 0 ? 'background:#fff2f2;color:#c0392b' : 'background:#f0f4fd;color:#5a6270'">
                <div class="text-[16px] font-black">{{ s.latestErrorCount }}</div>
                <div class="text-[9px] font-bold uppercase tracking-wider">Errors</div>
              </div>
            </div>

            @if (s.latestErrorMessage) {
              <div class="text-[11px] px-3 py-2 rounded-lg mb-3"
                   style="background:#fff2f2;color:#7a2018">
                {{ s.latestErrorMessage }}
              </div>
            }
          } @else {
            <div class="text-[12px] mb-3" style="color:#8b95a6">
              Never synced
            </div>
          }

          <button (click)="triggerSync(s)"
                  [disabled]="s.dataSource !== 'Api' || s.isRunning || triggering() === s.companyId"
                  class="w-full px-4 py-2.5 rounded-2xl text-[13px] font-bold text-white transition-all
                         hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  style="background:linear-gradient(135deg,#006874,#49b2c1);box-shadow:0 2px 8px rgba(0,104,116,0.25)">
            @if (s.dataSource !== 'Api') {
              Manual sync n/a (Import only)
            } @else if (s.isRunning) {
              Sync in progress…
            } @else if (triggering() === s.companyId) {
              Triggering…
            } @else {
              Sync Now
            }
          </button>
        </div>
      }

      @if (status().length === 0 && !loading()) {
        <div class="card px-6 py-12 col-span-full text-center text-[14px]" style="color:#8b95a6">
          No active insurance companies found.
        </div>
      }
    </div>

    <!-- History -->
    <div class="card overflow-hidden">
      <div class="flex items-center justify-between px-6 py-4"
           style="border-bottom:1px solid rgba(17,48,105,0.07)">
        <h2 class="text-[15px] font-black" style="color:#171c22">
          Sync History
        </h2>
        <span class="text-[11px]" style="color:#8b95a6">
          last {{ history().length }} runs
        </span>
      </div>
      <table class="w-full text-[12px]">
        <thead>
          <tr style="background:#f8f9ff;color:#8b95a6">
            <th class="text-left px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Provider</th>
            <th class="text-left px-3 py-3 font-bold uppercase tracking-wider text-[10px]">Status</th>
            <th class="text-left px-3 py-3 font-bold uppercase tracking-wider text-[10px]">Trigger</th>
            <th class="text-left px-3 py-3 font-bold uppercase tracking-wider text-[10px]">Started</th>
            <th class="text-right px-3 py-3 font-bold uppercase tracking-wider text-[10px]">Inserted</th>
            <th class="text-right px-3 py-3 font-bold uppercase tracking-wider text-[10px]">Updated</th>
            <th class="text-right px-3 py-3 font-bold uppercase tracking-wider text-[10px]">Errors</th>
            <th class="text-right px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Duration</th>
          </tr>
        </thead>
        <tbody>
          @for (h of history(); track h.id) {
            <tr style="border-top:1px solid rgba(17,48,105,0.06)">
              <td class="px-6 py-3 font-semibold" style="color:#171c22">
                {{ h.companyShortCode }}
              </td>
              <td class="px-3 py-3">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      [class]="historyStatusClass(h.status)">
                  {{ h.status }}
                </span>
              </td>
              <td class="px-3 py-3" style="color:#5a6270">{{ h.trigger }}</td>
              <td class="px-3 py-3" style="color:#5a6270">
                {{ h.startedAtUtc | date:'dd MMM HH:mm:ss' }}
              </td>
              <td class="px-3 py-3 text-right font-semibold" style="color:#006874">{{ h.insertedCount }}</td>
              <td class="px-3 py-3 text-right font-semibold" style="color:#435d98">{{ h.updatedCount }}</td>
              <td class="px-3 py-3 text-right font-semibold"
                  [style.color]="h.errorCount > 0 ? '#c0392b' : '#8b95a6'">{{ h.errorCount }}</td>
              <td class="px-6 py-3 text-right" style="color:#5a6270">
                {{ h.durationMs != null ? formatDuration(h.durationMs) : '—' }}
              </td>
            </tr>
          }
          @if (history().length === 0 && !loading()) {
            <tr><td colspan="8" class="px-6 py-8 text-center" style="color:#8b95a6">
              No sync runs yet.
            </td></tr>
          }
        </tbody>
      </table>
    </div>

  </div>
</div>
  `,
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
