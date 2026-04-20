import { Injectable, signal } from '@angular/core';
import { SearchParams, SearchResult } from './search-api.service';

@Injectable({ providedIn: 'root' })
export class SearchStateService {
  readonly lastParams = signal<SearchParams | null>(null);
  readonly lastResult = signal<SearchResult | null>(null);
  readonly lastSort = signal<string>('price_asc');
  readonly lastPage = signal<number>(1);

  save(params: SearchParams, result: SearchResult, sort: string, page: number): void {
    this.lastParams.set(params);
    this.lastResult.set(result);
    this.lastSort.set(sort);
    this.lastPage.set(page);
  }

  clear(): void {
    this.lastParams.set(null);
    this.lastResult.set(null);
    this.lastSort.set('price_asc');
    this.lastPage.set(1);
  }
}
