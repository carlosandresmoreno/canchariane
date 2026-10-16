import { Routes } from '@angular/router';
import { authGuard, superadminGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'c/club-alpha'
  },
  {
    path: 'c/:slug',
    loadComponent: () =>
      import('./features/public/pages/public-booking-wizard/public-booking-wizard.component').then(
        (m) => m.PublicBookingWizardComponent
      )
  },
  {
    path: 'lookup',
    loadComponent: () =>
      import('./features/public/pages/booking-lookup/booking-lookup.component').then(
        (m) => m.BookingLookupComponent
      )
  },
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./features/auth/pages/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/admin/pages/club-dashboard/club-dashboard.component').then(
        (m) => m.ClubDashboardComponent
      )
  },
  {
    path: 'superadmin',
    canActivate: [superadminGuard],
    loadComponent: () =>
      import('./features/superadmin/pages/superadmin-dashboard/superadmin-dashboard.component').then(
        (m) => m.SuperadminDashboardComponent
      )
  },
  {
    path: '**',
    redirectTo: 'c/club-alpha'
  }
];
