import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ProviderSyncStatus {
  companyId: string;
  companyShortCode: string;
  companyDisplayName: string;
  /** "Import" — local file/Excel; "Api" — live insurer master endpoint. */
  dataSource: 'Import' | 'Api';
  latestSyncLogId?: string | null;
  /** "Running" | "Succeeded" | "Failed" | "PartialSuccess" | null */
  latestStatus?: string | null;
  /** "Manual" | "Scheduled" | null */
  latestTrigger?: string | null;
  latestStartedAtUtc?: string | null;
  latestCompletedAtUtc?: string | null;
  latestInsertedCount: number;
  latestUpdatedCount: number;
  latestDeactivatedCount: number;
  latestErrorCount: number;
  latestDurationMs?: number | null;
  latestErrorMessage?: string | null;
  isRunning: boolean;
}

export interface SyncHistoryRow {
  id: string;
  companyShortCode: string;
  companyDisplayName: string;
  status: string;
  trigger: string;
  triggeredByUserId?: string | null;
  triggeredByEmail?: string | null;
  startedAtUtc: string;
  completedAtUtc?: string | null;
  insertedCount: number;
  updatedCount: number;
  deactivatedCount: number;
  errorCount: number;
  durationMs?: number | null;
  errorMessage?: string | null;
}

export interface SyncHistoryResult {
  items: SyncHistoryRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface TriggerSyncResult {
  syncLogId: string;
  companyShortCode: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class SyncApiService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  triggerVehicleMasterSync(companyId: string): Promise<TriggerSyncResult> {
    return firstValueFrom(this.http.post<TriggerSyncResult>(
      `${this.api}/admin/sync/vehicle-master/${companyId}`, {}));
  }

  getStatus(): Promise<ProviderSyncStatus[]> {
    return firstValueFrom(this.http.get<ProviderSyncStatus[]>(
      `${this.api}/admin/sync/status`));
  }

  getHistory(page = 1, pageSize = 20): Promise<SyncHistoryResult> {
    return firstValueFrom(this.http.get<SyncHistoryResult>(
      `${this.api}/admin/sync/history?page=${page}&pageSize=${pageSize}`));
  }
}
