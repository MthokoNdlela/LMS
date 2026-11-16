import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API_URL } from './config';
import { AuthResponse } from './models';

const STORAGE_KEY = 'lm.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly session = signal<AuthResponse | null>(this.restore());

  readonly username = computed(() => this.session()?.username ?? null);

  token(): string | null {
    return this.isAuthenticated() ? this.session()!.token : null;
  }

  isAuthenticated(): boolean {
    const session = this.session();
    return !!session && new Date(session.expiresAt).getTime() > Date.now();
  }

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_URL}/api/auth/login`, { username, password }).pipe(tap((r) => this.store(r)));
  }

  register(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_URL}/api/auth/register`, { username, password }).pipe(tap((r) => this.store(r)));
  }

  // An expired session remembers where the user was; a deliberate sign-out does not.
  logout(rememberLocation = false): void {
    this.session.set(null);
    sessionStorage.removeItem(STORAGE_KEY);
    const returnUrl = rememberLocation && !this.router.url.startsWith('/login') ? this.router.url : undefined;
    void this.router.navigate(['/login'], { queryParams: returnUrl ? { returnUrl } : {} });
  }

  private store(response: AuthResponse): void {
    this.session.set(response);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(response));
  }

  private restore(): AuthResponse | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthResponse) : null;
    } catch {
      return null;
    }
  }
}
