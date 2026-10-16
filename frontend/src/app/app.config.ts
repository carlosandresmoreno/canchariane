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
      } catch {
        // If initial token is invalid, attempt refresh
        try {
          const refreshed = await firstValueFrom(authService.refreshToken());
          authStore.setAccessToken(refreshed.access_token);
          const user = await firstValueFrom(authService.getMe());
          authStore.setCurrentUser(user);
        } catch {
          authStore.clearSession();
        }
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
