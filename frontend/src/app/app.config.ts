import {
  APP_INITIALIZER,
  ApplicationConfig,
  provideExperimentalZonelessChangeDetection
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';
import { AuthStore } from './core/state/auth.store';

export function initializeApp(authService: AuthService, authStore: AuthStore): () => Promise<void> {
  return async () => {
    const token = authStore.accessToken();
    if (token) {
      try {
        const user = await firstValueFrom(authService.getMe());
        authStore.setCurrentUser(user);
      } catch (err: any) {
        // If 401 Unauthorized, token has expired: try refresh token
        if (err?.status === 401) {
          try {
            const refreshed = await firstValueFrom(authService.refreshToken());
            authStore.setAccessToken(refreshed.access_token);
            const user = await firstValueFrom(authService.getMe());
            authStore.setCurrentUser(user);
          } catch {
            authStore.clearSession();
          }
        }
        // If network error (offline, flaky mobile connection), do NOT clear session so user isn't logged out
      }
    } else {
      // Check if there is an active session via refresh cookie
      try {
        const refreshed = await firstValueFrom(authService.refreshToken());
        authStore.setAccessToken(refreshed.access_token);
        const user = await firstValueFrom(authService.getMe());
        authStore.setCurrentUser(user);
      } catch {
        // Guest user, no session
      }
    }
    authStore.isInitialized.set(true);
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [AuthService, AuthStore],
      multi: true
    }
  ]
};
