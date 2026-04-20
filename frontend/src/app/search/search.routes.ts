import { Routes } from '@angular/router';

export const SEARCH_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./search-home/search-home.component').then(m => m.SearchHomeComponent)
  },
  {
    path: 'results',
    loadComponent: () =>
      import('./search-page/search-page.component').then(m => m.SearchPageComponent)
  },
  {
    path: 'compare',
    loadComponent: () =>
      import('./compare/compare.component').then(m => m.CompareComponent)
  }
];
