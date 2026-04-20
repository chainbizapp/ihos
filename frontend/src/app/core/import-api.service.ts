import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ParseErrorDto {
  row: number;
  column: string;
  reason: string;
}

export interface UploadResult {
  success: boolean;
  batchId?: string;
  sourceFileName?: string;
  totalRows: number;
  resolvedRows: number;
  pendingRows: number;
  parseErrors?: ParseErrorDto[];
  error?: string;
}

export interface UploadJobAccepted {
  jobId: string;
  status: 'processing';
}

export interface ImportJobStatus {
  status: 'processing' | 'done' | 'failed';
  // processing fields
  stage?: string;
  processedRows?: number;
  totalRows?: number;
  elapsedSeconds?: number;
  etaSeconds?: number | null;
  // done fields
  batchId?: string;
  resolvedRows?: number;
  pendingRows?: number;
  error?: string;
}

export interface ImportBatchSummary {
  id: string;
  companyId: string;
  companyName: string;
  sourceFileName: string;
  uploadedBy: string;
  uploadedAt: string;
  status: string;
  totalRows: number;
  resolvedRows: number;
  pendingRows: number;
  approvedRows: number;
  rejectedRows: number;
}

export interface ImportBatchListResult {
  items: ImportBatchSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface ImportRecordDto {
  id: string;
  rowNumber: number;
  rawData: string;
  vehicleModelMappingId?: string;
  resolvedVehicleModel?: string;
  planTypeMappingId?: string;
  resolvedPlanType?: string;
  mappingStatus: string;
  reviewStatus: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface ImportBatchDetail extends ImportBatchSummary {
  records: ImportRecordDto[];
  recordsTotalCount: number;
  recordsPage: number;
  recordsPageSize: number;
}

export interface InsuranceCompany {
  id: string;
  name: string;
  shortCode: string;
  isActive: boolean;
}

export interface SyncedMakeDto {
  makeId: string;
  name: string;
  isNew: boolean;
}

export interface SyncedModelDto {
  makeId: string;
  makeName: string;
  modelId: string;
  modelName: string;
  subModel?: string;
  carnameCode: string;
  isNewMake: boolean;
  isNewModel: boolean;
  isNewMapping: boolean;
}

export interface VehicleSyncResult {
  totalRows: number;
  skippedRows: number;
  newMakes: number;
  newModels: number;
  newMappings: number;
  alreadyExisting: number;
  makes: SyncedMakeDto[];
  entries: SyncedModelDto[];
}

@Injectable({ providedIn: 'root' })
export class ImportApiService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/imports`;

  async upload(companyId: string, file: File): Promise<UploadJobAccepted> {
    const formData = new FormData();
    formData.append('companyId', companyId);
    formData.append('file', file);
    return firstValueFrom(this.http.post<UploadJobAccepted>(`${this.api}/upload`, formData));
  }

  async getJobStatus(jobId: string): Promise<ImportJobStatus> {
    return firstValueFrom(this.http.get<ImportJobStatus>(`${this.api}/jobs/${jobId}`));
  }

  async getBatchProgress(batchId: string): Promise<{
    found: boolean;
    status?: string;
    stage?: string;
    processedRows?: number;
    totalRows?: number;
    elapsedSeconds?: number;
    etaSeconds?: number | null;
  }> {
    return firstValueFrom(this.http.get<any>(`${this.api}/batches/${batchId}/progress`));
  }

  async getBatches(options: {
    page?: number;
    pageSize?: number;
    companyId?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
  } = {}): Promise<ImportBatchListResult> {
    let params = new HttpParams();
    if (options.page) params = params.set('page', options.page);
    if (options.pageSize) params = params.set('pageSize', options.pageSize);
    if (options.companyId) params = params.set('companyId', options.companyId);
    if (options.status) params = params.set('status', options.status);
    if (options.fromDate) params = params.set('fromDate', options.fromDate);
    if (options.toDate) params = params.set('toDate', options.toDate);
    return firstValueFrom(this.http.get<ImportBatchListResult>(`${this.api}/batches`, { params }));
  }

  async getBatchDetail(id: string, recordPage = 1, recordPageSize = 50, issuesOnly = false): Promise<ImportBatchDetail> {
    const params = new HttpParams()
      .set('recordPage', recordPage)
      .set('recordPageSize', recordPageSize)
      .set('issuesOnly', issuesOnly);
    return firstValueFrom(this.http.get<ImportBatchDetail>(`${this.api}/batches/${id}`, { params }));
  }

  async getRecords(batchId: string, page = 1, pageSize = 50, issuesOnly = false): Promise<{
    items: ImportRecordDto[];
    totalCount: number;
    page: number;
    pageSize: number;
  }> {
    const params = new HttpParams()
      .set('page', page)
      .set('pageSize', pageSize)
      .set('issuesOnly', issuesOnly);
    return firstValueFrom(
      this.http.get<{ items: ImportRecordDto[]; totalCount: number; page: number; pageSize: number }>(
        `${this.api}/batches/${batchId}/records`,
        { params }
      )
    );
  }

  async approveRecord(recordId: string): Promise<void> {
    return firstValueFrom(this.http.put<void>(`${this.api}/records/${recordId}/approve`, {}));
  }

  async rejectRecord(recordId: string, reason?: string): Promise<void> {
    return firstValueFrom(this.http.put<void>(`${this.api}/records/${recordId}/reject`, { reason }));
  }

  async reResolveMappings(batchId: string): Promise<{ resolvedCount: number; stillPending: number }> {
    return firstValueFrom(this.http.post<{ resolvedCount: number; stillPending: number }>(`${this.api}/batches/${batchId}/re-resolve`, {}));
  }

  async approveAllResolved(batchId: string): Promise<{ approvedCount: number }> {
    return firstValueFrom(this.http.post<{ approvedCount: number }>(`${this.api}/batches/${batchId}/approve-all-resolved`, {}));
  }

  async rejectAllUnresolved(batchId: string): Promise<{ rejectedCount: number }> {
    return firstValueFrom(this.http.post<{ rejectedCount: number }>(`${this.api}/batches/${batchId}/reject-all-unresolved`, {}));
  }

  async getBatchDuplicates(batchId: string, limit = 30): Promise<{
    totalDuplicateRecords: number;
    groups: Array<{
      count: number;
      firstRowNumber: number;
      repairType: string;
      minYear: string;
      maxYear: string;
      sumInsured: string;
      externalPackageId: string;
      vehicleModels: string[];
      duplicateRows: number[];
    }>;
  }> {
    return firstValueFrom(this.http.get<any>(`${this.api}/batches/${batchId}/duplicates?limit=${limit}`));
  }

  async publishBatch(batchId: string): Promise<{ plansCreated: number; plansUpdated: number; errorCount: number }> {
    return firstValueFrom(this.http.post<{ plansCreated: number; plansUpdated: number; errorCount: number }>(`${this.api}/batches/${batchId}/publish`, {}));
  }

  async getCompanies(): Promise<InsuranceCompany[]> {
    return firstValueFrom(this.http.get<InsuranceCompany[]>(`${environment.apiUrl}/companies`));
  }

  async deleteBatch(batchId: string, reason?: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.api}/batches/${batchId}`, { body: { reason: reason ?? null } }));
  }

  async syncViriyahMaster(companyId: string, file: File): Promise<VehicleSyncResult> {
    const formData = new FormData();
    formData.append('companyId', companyId);
    formData.append('file', file);
    return firstValueFrom(
      this.http.post<VehicleSyncResult>(`${this.api}/vehicles/viriyah/sync`, formData)
    );
  }
}
