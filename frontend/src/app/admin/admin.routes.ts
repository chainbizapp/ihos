import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth.guard';
import { roleGuard } from '../core/guards/role.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: 'users',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Admin', 'Manager'] },
    loadComponent: () => import('./users/users.component').then(m => m.UsersComponent),
  },
  {
    path: 'registrations',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Admin', 'Manager'] },
    loadComponent: () => import('./registrations/registrations.component').then(m => m.RegistrationsComponent),
  },
  {
    path: 'audit-log',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Admin'] },
    loadComponent: () => import('./audit-log/audit-log.component').then(m => m.AuditLogComponent),
  },
];
