import { Routes } from '@angular/router';

export const IMPORT_ROUTES: Routes = [
  {
    path: 'upload',
    loadComponent: () =>
      import('./upload/upload.component').then(m => m.UploadComponent)
  },
  {
    path: 'batches',
    loadComponent: () =>
      import('./batch-list/batch-list.component').then(m => m.BatchListComponent)
  },
  {
    path: 'batches/:id',
    loadComponent: () =>
      import('./batch-detail/batch-detail.component').then(m => m.BatchDetailComponent)
  },
  {
    path: 'vehicles/sync',
    loadComponent: () =>
      import('./vehicle-sync/vehicle-sync.component').then(m => m.VehicleSyncComponent)
  },
  {
    path: '',
    redirectTo: 'batches',
    pathMatch: 'full'
  }
];
