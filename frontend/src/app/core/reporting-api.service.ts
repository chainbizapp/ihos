import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UsageStatisticsBucket {
  periodStart: string;
  quotationCount: number;
}

export interface UsageStatisticsResult {
  buckets: UsageStatisticsBucket[];
  totalQuotations: number;
  from: string;
  to: string;
  granularity: string;
}

export interface VehicleModelRankDto {
  rank: number;
  vehicleMake: string;
  vehicleModel: string;
  quotationCount: number;
}

export interface TopVehicleModelsResult {
  items: VehicleModelRankDto[];
  from: string;
  to: string;
}

export interface ImportErrorBatchDto {
  batchId: string;
  companyName: string;
  sourceFileName: string;
  uploadedAt: string;
  status: string;
  totalRows: number;
  resolvedRows: number;
  pendingRows: number;
  approvedRows: number;
  rejectedRows: number;
}

export interface ImportErrorsResult {
  items: ImportErrorBatchDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class ReportingApiService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/reports`;

  async getUsageStatistics(
    from: string, to: string, granularity = 'daily'
  ): Promise<UsageStatisticsResult> {
    const params = new HttpParams()
      .set('from', from).set('to', to).set('granularity', granularity);
    return firstValueFrom(
      this.http.get<UsageStatisticsResult>(`${this.api}/usage-statistics`, { params })
    );
  }

  async getTopModels(from: string, to: string, topN = 20): Promise<TopVehicleModelsResult> {
    const params = new HttpParams()
      .set('from', from).set('to', to).set('topN', topN);
    return firstValueFrom(
      this.http.get<TopVehicleModelsResult>(`${this.api}/top-vehicle-models`, { params })
    );
  }

  async getImportErrors(
    from: string, to: string, companyId?: string, page = 1, pageSize = 20
  ): Promise<ImportErrorsResult> {
    let params = new HttpParams()
      .set('from', from).set('to', to).set('page', page).set('pageSize', pageSize);
    if (companyId) params = params.set('companyId', companyId);
    return firstValueFrom(
      this.http.get<ImportErrorsResult>(`${this.api}/import-errors`, { params })
    );
  }

  async exportReport(
    reportType: string, format: 'pdf' | 'xlsx',
    from: string, to: string,
    options?: { granularity?: string; companyId?: string }
  ): Promise<Blob> {
    let params = new HttpParams()
      .set('format', format).set('from', from).set('to', to);
    if (options?.granularity) params = params.set('granularity', options.granularity);
    if (options?.companyId) params = params.set('companyId', options.companyId);
    return firstValueFrom(
      this.http.get(`${this.api}/${reportType}/export`, { params, responseType: 'blob' })
    );
  }
}
