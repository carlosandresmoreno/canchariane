import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../state/auth.store';

export const authGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url }
  });
};

export const superadminGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (!authStore.isAuthenticated()) {
    return router.createUrlTree(['/auth/login'], {
      queryParams: { returnUrl: state.url }
    });
  }

  if (authStore.isSuperadmin()) {
    return true;
  }

  return router.createUrlTree(['/admin']);
};

export function clubRoleGuard(minRole: 'staff' | 'admin' | 'owner' = 'staff'): CanActivateFn {
  return (route) => {
    const authStore = inject(AuthStore);
    const router = inject(Router);

    const clubId = route.paramMap.get('clubId') ?? authStore.activeClubId();
    if (!clubId) {
      return router.createUrlTree(['/admin']);
    }

    if (authStore.hasRole(clubId, minRole)) {
      return true;
    }

    return router.createUrlTree(['/admin']);
  };
}
