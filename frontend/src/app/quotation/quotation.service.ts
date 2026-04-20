import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GenerateQuotationRequest {
  planId: string;
  customerName: string;
  vehicleRegistration?: string;
  vehicleYear: number;
}

export interface GenerateQuotationResponse {
  quotationId: string;
}

export interface QuotationSummary {
  id: string;
  customerName: string;
  vehicleRegistration?: string;
  vehicleMake: string;
  vehicleModelName: string;
  vehicleYear: number;
  companyName: string;
  planType: string;
  premiumAtGeneration: number;
  generatedAt: string;
  createdBy: string;
}

export interface QuotationHistoryResult {
  items: QuotationSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class QuotationService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/quotations`;

  async generate(request: GenerateQuotationRequest): Promise<GenerateQuotationResponse> {
    return firstValueFrom(
      this.http.post<GenerateQuotationResponse>(this.api, request)
    );
  }

  async downloadPdf(quotationId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.api}/${quotationId}/pdf`, { responseType: 'blob' })
    );
  }

  async getHistory(page = 1, pageSize = 20): Promise<QuotationHistoryResult> {
    const params = new HttpParams()
      .set('page', page)
      .set('pageSize', pageSize);
    return firstValueFrom(
      this.http.get<QuotationHistoryResult>(this.api, { params })
    );
  }
}
