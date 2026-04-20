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
    if (params.sort) p = p.set('sort', params.sort);
    if (params.page) p = p.set('page', params.page);
    if (params.pageSize) p = p.set('pageSize', params.pageSize);

    return firstValueFrom(this.http.get<SearchResult>(`${this.api}/plans/search`, { params: p }));
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
