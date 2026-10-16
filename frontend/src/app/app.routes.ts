import { Routes } from '@angular/router';

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
    loadComponent: () =>
      import('./features/admin/pages/club-dashboard/club-dashboard.component').then(
        (m) => m.ClubDashboardComponent
      )
  },
  {
    path: '**',
    redirectTo: 'c/club-alpha'
  }
];
