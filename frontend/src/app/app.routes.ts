import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/shell/shell.component').then(m => m.ShellComponent),
    children: [
      {
        path: 'admin',
        loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES),
      },
      {
        path: 'import',
        loadChildren: () => import('./import/import.routes').then(m => m.IMPORT_ROUTES),
      },
      {
        path: 'mapping',
        loadChildren: () => import('./mapping/mapping.routes').then(m => m.MAPPING_ROUTES),
      },
      {
        path: 'search',
        loadChildren: () => import('./search/search.routes').then(m => m.SEARCH_ROUTES),
      },
      {
        path: 'quotation',
        loadChildren: () => import('./quotation/quotation.routes').then(m => m.QUOTATION_ROUTES),
      },
      {
        path: 'reporting',
        loadChildren: () => import('./reporting/reporting.routes').then(m => m.REPORTING_ROUTES),
      },
      { path: '', redirectTo: 'search', pathMatch: 'full' },
      {
        path: '404',
        loadComponent: () => import('./shared/shell/not-found.component').then(m => m.NotFoundComponent),
      },
      { path: '**', loadComponent: () => import('./shared/shell/not-found.component').then(m => m.NotFoundComponent) },
    ],
  },
  { path: '403', redirectTo: 'auth/login', pathMatch: 'full' },
];
