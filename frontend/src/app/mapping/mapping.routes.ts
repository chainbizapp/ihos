import { Routes } from '@angular/router';

export const MAPPING_ROUTES: Routes = [
  {
    path: 'vehicle-models',
    loadComponent: () =>
      import('./vehicle-models/vehicle-models.component').then(m => m.VehicleModelsComponent)
  },
  {
    path: 'plan-types',
    loadComponent: () =>
      import('./plan-types/plan-types.component').then(m => m.PlanTypesComponent)
  },
  {
    path: 'sync',
    loadComponent: () =>
      import('./sync/sync.component').then(m => m.MappingSyncComponent)
  },
  {
    path: 'brand-aliases',
    loadComponent: () =>
      import('./brand-aliases/brand-aliases.component').then(m => m.BrandAliasesComponent)
  },
  {
    path: '',
    redirectTo: 'vehicle-models',
    pathMatch: 'full'
  }
];
