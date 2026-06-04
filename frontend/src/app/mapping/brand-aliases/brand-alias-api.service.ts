import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface BrandAlias {
  id: string;
  providerCode: string;
  rawValue: string;
  canonicalMakeId?: string | null;
  canonicalMakeName?: string | null;
  /** "AiFuzzy" | "AiGuess" | "Human" | "Pending" */
  source: string;
  confidence?: number | null;
  isVerified: boolean;
  updatedAt: string;
}

export interface BrandAliasListResult {
  items: BrandAlias[];
  providerCodes: string[];
}

export interface VehicleMake {
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class BrandAliasApiService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  list(provider?: string, verifiedOnly?: boolean): Promise<BrandAliasListResult> {
    let p = new HttpParams();
    if (provider) p = p.set('provider', provider);
    if (verifiedOnly != null) p = p.set('verifiedOnly', String(verifiedOnly));
    return firstValueFrom(this.http.get<BrandAliasListResult>(
      `${this.api}/mappings/brand-aliases`, { params: p }));
  }

  getMakes(): Promise<VehicleMake[]> {
    return firstValueFrom(this.http.get<VehicleMake[]>(`${this.api}/vehicles/makes`));
  }

  create(providerCode: string, rawValue: string, canonicalMakeId: string | null): Promise<{ id: string }> {
    return firstValueFrom(this.http.post<{ id: string }>(
      `${this.api}/mappings/brand-aliases`, { providerCode, rawValue, canonicalMakeId }));
  }

  update(id: string, providerCode: string, rawValue: string, canonicalMakeId: string | null): Promise<{ id: string }> {
    return firstValueFrom(this.http.put<{ id: string }>(
      `${this.api}/mappings/brand-aliases/${id}`, { providerCode, rawValue, canonicalMakeId }));
  }

  verify(id: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.api}/mappings/brand-aliases/${id}/verify`, {}));
  }

  delete(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.api}/mappings/brand-aliases/${id}`));
  }
}
