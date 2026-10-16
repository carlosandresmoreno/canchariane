import { HttpErrorResponse, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { AuthStore } from '../state/auth.store';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export function authInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<any> {
  const authStore = inject(AuthStore);
  const authService = inject(AuthService);
  const router = inject(Router);

  const token = authStore.accessToken();
  let authReq = req;

  // Attach token if present and not an external request
  if (token && !req.headers.has('Authorization')) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        // Do not intercept 401 on login or refresh itself to prevent infinite loops
        if (req.url.includes('/auth/login') || req.url.includes('/auth/refresh')) {
          return throwError(() => error);
        }

        return handle401Error(authReq, next, authStore, authService, router);
      }
      return throwError(() => error);
    })
  );
}

function handle401Error(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authStore: AuthStore,
  authService: AuthService,
  router: Router
): Observable<any> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return authService.refreshToken().pipe(
      switchMap((tokenResponse) => {
        isRefreshing = false;
        authStore.setAccessToken(tokenResponse.access_token);
        refreshTokenSubject.next(tokenResponse.access_token);

        return next(
          req.clone({
            setHeaders: {
              Authorization: `Bearer ${tokenResponse.access_token}`
            }
          })
        );
      }),
      catchError((refreshError) => {
        isRefreshing = false;
        authStore.clearSession();
        router.navigate(['/auth/login'], {
          queryParams: { returnUrl: router.url }
        });
        return throwError(() => refreshError);
      })
    );
  } else {
    // Queue subsequent requests until the refresh finishes
    return refreshTokenSubject.pipe(
      filter((token) => token !== null),
      take(1),
      switchMap((newToken) => {
        return next(
          req.clone({
            setHeaders: {
              Authorization: `Bearer ${newToken!}`
            }
          })
        );
      })
    );
  }
}
