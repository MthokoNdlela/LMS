import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { authInterceptor } from './auth.http';
import { AuthService } from './auth.service';
import { API_URL } from './config';

describe('auth', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => controller.verify());

  function signIn(expiresAt: string): void {
    auth.login('demo', 'Passw0rd!x').subscribe();
    controller.expectOne(`${API_URL}/api/auth/login`).flush({ token: 'jwt-token', expiresAt, username: 'demo' });
  }

  it('is signed out until a login succeeds', () => {
    expect(auth.isAuthenticated()).toBe(false);
    signIn(new Date(Date.now() + 60_000).toISOString());
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.username()).toBe('demo');
  });

  it('treats an expired token as signed out', () => {
    signIn(new Date(Date.now() - 60_000).toISOString());
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.token()).toBeNull();
  });

  it('adds the bearer token to API calls only', () => {
    signIn(new Date(Date.now() + 60_000).toISOString());

    http.get(`${API_URL}/api/customers`).subscribe();
    expect(controller.expectOne(`${API_URL}/api/customers`).request.headers.get('Authorization')).toBe('Bearer jwt-token');

    http.get('https://example.com/other').subscribe();
    expect(controller.expectOne('https://example.com/other').request.headers.has('Authorization')).toBe(false);
  });

  it('signs out when the API answers 401', () => {
    signIn(new Date(Date.now() + 60_000).toISOString());

    http.get(`${API_URL}/api/loans`).subscribe({ error: () => undefined });
    controller.expectOne(`${API_URL}/api/loans`).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated()).toBe(false);
  });
});
