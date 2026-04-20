import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface VehicleModelMappingDto {
  id: string;
  companyId: string;
  companyName: string;
  rawName: string;
  canonicalModelId: string;
  canonicalModelName: string;
  canonicalMakeName: string;
  isAutoSuggested: boolean;
}

export interface VehicleModelMappingsResult {
  items: VehicleModelMappingDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface PlanTypeMappingDto {
  id: string;
  companyId: string;
  companyName: string;
  rawName: string;
  canonicalPlanType: string;
}

export interface PlanTypeMappingsResult {
  items: PlanTypeMappingDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface VehicleModel {
  id: string;
  makeId: string;
  makeName: string;
  name: string;
  subModel?: string;
  engineCC?: string;
}

@Injectable({ providedIn: 'root' })
export class MappingApiService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/mappings`;

  async getVehicleModelMappings(options: { companyId?: string; page?: number; pageSize?: number } = {}): Promise<VehicleModelMappingsResult> {
    let params = new HttpParams();
    if (options.companyId) params = params.set('companyId', options.companyId);
    if (options.page) params = params.set('page', options.page);
    if (options.pageSize) params = params.set('pageSize', options.pageSize);
    return firstValueFrom(this.http.get<VehicleModelMappingsResult>(`${this.api}/vehicle-models`, { params }));
  }

  async createVehicleModelMapping(companyId: string, rawName: string, canonicalModelId: string): Promise<{ id: string }> {
    return firstValueFrom(this.http.post<{ id: string }>(`${this.api}/vehicle-models`, { companyId, rawName, canonicalModelId }));
  }

  async updateVehicleModelMapping(id: string, canonicalModelId: string): Promise<void> {
    return firstValueFrom(this.http.put<void>(`${this.api}/vehicle-models/${id}`, { canonicalModelId }));
  }

  async getPlanTypeMappings(options: { companyId?: string; page?: number; pageSize?: number } = {}): Promise<PlanTypeMappingsResult> {
    let params = new HttpParams();
    if (options.companyId) params = params.set('companyId', options.companyId);
    if (options.page) params = params.set('page', options.page);
    if (options.pageSize) params = params.set('pageSize', options.pageSize);
    return firstValueFrom(this.http.get<PlanTypeMappingsResult>(`${this.api}/plan-types`, { params }));
  }

  async createPlanTypeMapping(companyId: string, rawName: string, canonicalPlanType: string): Promise<{ id: string }> {
    return firstValueFrom(this.http.post<{ id: string }>(`${this.api}/plan-types`, { companyId, rawName, canonicalPlanType }));
  }

  async updatePlanTypeMapping(id: string, canonicalPlanType: string): Promise<void> {
    return firstValueFrom(this.http.put<void>(`${this.api}/plan-types/${id}`, { canonicalPlanType }));
  }

  async getVehicleModels(): Promise<VehicleModel[]> {
    return firstValueFrom(this.http.get<VehicleModel[]>(`${environment.apiUrl}/vehicles/models`));
  }

  async getVehicleMakes(): Promise<{ id: string; name: string }[]> {
    return firstValueFrom(this.http.get<{ id: string; name: string }[]>(`${environment.apiUrl}/vehicles/makes`));
  }

  async createVehicleMake(name: string): Promise<{ id: string; name: string; isNew: boolean }> {
    return firstValueFrom(this.http.post<{ id: string; name: string; isNew: boolean }>(
      `${environment.apiUrl}/vehicles/makes`, { name }));
  }

  async createVehicleModel(makeId: string, name: string, subModel?: string, engineCC?: string): Promise<{ id: string; name: string; subModel?: string; engineCC?: string; isNew: boolean }> {
    return firstValueFrom(this.http.post<{ id: string; name: string; subModel?: string; engineCC?: string; isNew: boolean }>(
      `${environment.apiUrl}/vehicles/models`, { makeId, name, subModel, engineCC }));
  }
}
