import { Injectable } from '@angular/core';

const STORAGE_KEY = 'ihos.searchPreferences';

export interface SearchPreferences {
  makeId: string;
  makeName: string;
  modelId: string;
  modelName: string;
  engineCC?: string;
  gearType?: string;
  allVariants?: boolean;
  vehicleYear?: number;
  province?: string;
  planType: string;
  repairType: string;
}

@Injectable({ providedIn: 'root' })
export class SearchPreferencesService {
  load(): SearchPreferences | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SearchPreferences) : null;
    } catch {
      return null;
    }
  }

  save(prefs: SearchPreferences): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch { }
  }

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { }
  }
}
