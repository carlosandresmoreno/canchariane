import { TestBed } from '@angular/core/testing';
import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { AuthStore } from '../state/auth.store';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authStore: AuthStore;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['refreshToken', 'logout']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        provideExperimentalZonelessChangeDetection(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        AuthStore,
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authStore = TestBed.inject(AuthStore);
    authStore.clearSession();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should attach Bearer token to requests when accessToken is present', () => {
    authStore.setAccessToken('initial-test-token');

    http.get('/api/v1/clubs/123/courts').subscribe();

    const req = httpMock.expectOne('/api/v1/clubs/123/courts');
    expect(req.request.headers.get('Authorization')).toBe('Bearer initial-test-token');
    req.flush([]);
  });

  it('should transparently refresh token on 401 and retry the original request', () => {
    authStore.setAccessToken('expired-token');

    // Mock refreshToken returning a new token
    authServiceSpy.refreshToken.and.returnValue(
      of({
        access_token: 'new-fresh-token',
        token_type: 'bearer',
        expires_in: 900
      })
    );

    let responseData: any = null;
    http.get('/api/v1/clubs/123/dashboard').subscribe((data) => {
      responseData = data;
    });

    // 1. Initial request with expired token fails with 401
    const initialReq = httpMock.expectOne('/api/v1/clubs/123/dashboard');
    expect(initialReq.request.headers.get('Authorization')).toBe('Bearer expired-token');
    initialReq.flush({ detail: 'Token expired' }, { status: 401, statusText: 'Unauthorized' });

    // 2. Interceptor triggers authService.refreshToken()
    expect(authServiceSpy.refreshToken).toHaveBeenCalled();
    expect(authStore.accessToken()).toBe('new-fresh-token');

    // 3. Original request is retried with the new token
    const retriedReq = httpMock.expectOne('/api/v1/clubs/123/dashboard');
    expect(retriedReq.request.headers.get('Authorization')).toBe('Bearer new-fresh-token');
    retriedReq.flush({ club_id: '123', name: 'Club Retried' });

    // 4. Component receives the response smoothly
    expect(responseData).toEqual({ club_id: '123', name: 'Club Retried' });
  });

  it('should redirect to login when refresh token also fails', () => {
    authStore.setAccessToken('expired-token');

    authServiceSpy.refreshToken.and.returnValue(
      throwError(() => ({ status: 401, statusText: 'Refresh Expired' }))
    );

    let errorReceived = false;
    http.get('/api/v1/clubs/123/dashboard').subscribe({
      error: () => {
        errorReceived = true;
      }
    });

    const initialReq = httpMock.expectOne('/api/v1/clubs/123/dashboard');
    initialReq.flush({ detail: 'Token expired' }, { status: 401, statusText: 'Unauthorized' });

    expect(authStore.accessToken()).toBeNull();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login'], jasmine.any(Object));
    expect(errorReceived).toBeTrue();
  });
});
