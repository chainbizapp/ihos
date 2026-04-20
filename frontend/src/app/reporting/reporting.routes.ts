import { Routes } from '@angular/router';

export const REPORTING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'usage-statistics',
    loadComponent: () =>
      import('./usage-statistics/usage-statistics.component').then(m => m.UsageStatisticsComponent)
  },
  {
    path: 'top-models',
    loadComponent: () =>
      import('./top-models/top-models.component').then(m => m.TopModelsComponent)
  },
  {
    path: 'import-errors',
    loadComponent: () =>
      import('./import-errors/import-errors.component').then(m => m.ImportErrorsComponent)
  }
];
