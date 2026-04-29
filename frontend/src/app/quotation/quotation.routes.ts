import { Routes } from '@angular/router';

export const QUOTATION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./list/quotation-list.component').then(m => m.QuotationListComponent)
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./form/quotation-form.component').then(m => m.QuotationFormComponent)
  },
  {
    path: 'success',
    loadComponent: () =>
      import('./success/quotation-success.component').then(m => m.QuotationSuccessComponent)
  }
];
