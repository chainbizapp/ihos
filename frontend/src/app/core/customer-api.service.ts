import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CustomerSuggestion {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  licenseNumber?: string;
  vehicleRegistration?: string;
  vehicleYear?: number;
  previousInsurer?: string;
  previousExpiryDate?: string;
}

@Injectable({ providedIn: 'root' })
export class CustomerApiService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/customers`;

  async search(q: string): Promise<CustomerSuggestion[]> {
    if (!q || q.trim().length < 2) return [];
    const params = new HttpParams().set('q', q.trim());
    return firstValueFrom(
      this.http.get<CustomerSuggestion[]>(`${this.api}/search`, { params })
    );
  }
}
