import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface InsurancePlanSummary {
  id: string;
  companyName: string;
  companyShortCode: string;
  planType: string;
  repairType: string;
  vehicleModel: string;
  vehicleMake: string;
  vehicleSubModel?: string;
  vehicleEngineCC?: string;
  minYear: number;
  maxYear: number;
  sumInsured: number;
  premiumTotal: number;
  excessAmount: number;
  coverageDetails: string;
  remarks?: string;
  regionGroup?: string | null;
  // Structured coverage limits (null = insurer does not publish this value)
  tpbiPerPerson?: number | null;
  tpbiPerAccident?: number | null;
  tppd?: number | null;
  fireTheft?: number | null;
  personalAccident?: number | null;
  passengerAccident?: number | null;
  medicalExpenses?: number | null;
  bailBond?: number | null;
}

export interface SearchResult {
  items: InsurancePlanSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface InsurancePlanDetail extends InsurancePlanSummary {
  companyId: string;
  vehicleModelId: string;
  isPublished: boolean;
}

/**
 * Per-provider result inside the aggregated multi-provider search response.
 * Feature 002 — see backend contracts/search.md.
 */
export interface ProviderSearchResult {
  companyShortCode: string;
  companyDisplayName: string;
  /** "Import" (local DB) | "Api" (live insurer call). */
  dataSource: 'Import' | 'Api';
  /** "Success" | "NoMatch" | "Timeout" | "BreakerOpen" | "Failed" */
  status: string;
  /** When true, plans came from cache (either fresh-but-cached or stale-after-failure). */
  isStale: boolean;
  providerLatencyMs: number;
  plans: InsurancePlanSummary[];
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface AggregatedSearchResult {
  requestId: string;
  elapsedMs: number;
  results: ProviderSearchResult[];
}

/**
 * Convenience wrapper combining the raw aggregated response with a flattened
 * SearchResult shape so the existing results component can render unchanged.
 */
export interface AggregatedSearchView {
  aggregated: AggregatedSearchResult;
  flat: SearchResult;
}

export interface VehicleMake {
  id: string;
  name: string;
}

export interface VehicleModel {
  id: string;
  makeId: string;
  makeName?: string;
  name: string;
  subModel?: string;
  engineCC?: string;
  gearType?: string;
  minYear?: number | null;
  maxYear?: number | null;
}

export interface InsurancePlanComparison {
  plans: InsurancePlanDetail[];
}

export interface SearchParams {
  vehicleModelId: string;
  registrationYear: number;
  planType?: string;
  repairType: string;
  companyId?: string;
  excessMin?: number;
  excessMax?: number;
  sort?: string;
  page?: number;
  pageSize?: number;
  engineCC?: string;
  gearType?: string;
  allVariants?: boolean;
  province?: string;
}

@Injectable({ providedIn: 'root' })
export class SearchApiService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}`;

  async search(params: SearchParams): Promise<SearchResult> {
    let p = new HttpParams()
      .set('vehicleModelId', params.vehicleModelId)
      .set('registrationYear', params.registrationYear)
      .set('repairType', params.repairType);

    if (params.planType) p = p.set('planType', params.planType);
    if (params.engineCC) p = p.set('engineCC', params.engineCC);
    if (params.gearType) p = p.set('gearType', params.gearType);
    if (params.allVariants) p = p.set('allVariants', 'true');

    if (params.companyId) p = p.set('companyId', params.companyId);
    if (params.excessMin != null) p = p.set('excessMin', params.excessMin);
    if (params.excessMax != null) p = p.set('excessMax', params.excessMax);
    if (params.province) p = p.set('province', params.province);
    if (params.sort) p = p.set('sort', params.sort);
    if (params.page) p = p.set('page', params.page);
    if (params.pageSize) p = p.set('pageSize', params.pageSize);

    return firstValueFrom(this.http.get<SearchResult>(`${this.api}/plans/search`, { params: p }));
  }

  /**
   * Multi-provider aggregated search (feature 002). Fans out to every active provider:
   * import-source companies (Allianz) read pre-loaded plans from DB; API-source companies
   * (MTI, Viriyah) are quoted live with per-provider timeout + circuit breaker.
   * Returns BOTH the raw per-provider result (for status banners) AND a flattened
   * SearchResult so the existing results component renders unchanged.
   */
  async searchAggregated(params: SearchParams): Promise<AggregatedSearchView> {
    let p = new HttpParams()
      .set('vehicleModelId', params.vehicleModelId)
      .set('registrationYear', params.registrationYear)
      .set('repairType', params.repairType);

    if (params.planType) p = p.set('planType', params.planType);
    // The aggregated endpoint accepts a single primary planType — fall back to Type1
    // when the user picked "ทุกชั้น" (empty) so providers always have a valid value.
    else                  p = p.set('planType', 'Type1');

    const agg = await firstValueFrom(
      this.http.get<AggregatedSearchResult>(`${this.api}/plans/search-aggregated`, { params: p })
    );

    const items = agg.results.flatMap(r => r.plans);
    const flat: SearchResult = {
      items,
      totalCount: items.length,
      page: 1,
      pageSize: Math.max(items.length, 1),
    };
    return { aggregated: agg, flat };
  }

  async getDetail(id: string): Promise<InsurancePlanDetail> {
    return firstValueFrom(this.http.get<InsurancePlanDetail>(`${this.api}/plans/${id}`));
  }

  async compare(ids: string[]): Promise<InsurancePlanComparison> {
    const params = new HttpParams().set('ids', ids.join(','));
    return firstValueFrom(this.http.get<InsurancePlanComparison>(`${this.api}/plans/compare`, { params }));
  }

  async getVehicleMakes(): Promise<VehicleMake[]> {
    return firstValueFrom(this.http.get<VehicleMake[]>(`${this.api}/vehicles/makes`));
  }

  async getVehicleModels(makeId: string): Promise<VehicleModel[]> {
    return firstValueFrom(this.http.get<VehicleModel[]>(`${this.api}/vehicles/makes/${makeId}/models`));
  }
}
