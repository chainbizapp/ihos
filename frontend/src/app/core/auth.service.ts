import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: CurrentUser;
}

interface RefreshResponse {
  accessToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiBase = environment.apiUrl;

  private readonly _currentUser = signal<CurrentUser | null>(this.loadStoredUser());
  private readonly _accessToken = signal<string | null>(localStorage.getItem('accessToken'));

  readonly currentUser = this._currentUser.asReadonly();
  readonly accessToken = this._accessToken.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  hasRole(...roles: string[]): boolean {
    const user = this._currentUser();
    return user !== null && roles.includes(user.role);
  }

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(`${this.apiBase}/auth/login`, { email, password })
    );
    this.setSession(res.accessToken, res.user);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.apiBase}/auth/logout`, {}));
    } finally {
      this.clearSession();
      await this.router.navigate(['/auth/login']);
    }
  }

  async refreshToken(): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<RefreshResponse>(`${this.apiBase}/auth/refresh`, {})
    );
    this._accessToken.set(res.accessToken);
    localStorage.setItem('accessToken', res.accessToken);
    return res.accessToken;
  }

  setSession(token: string, user: CurrentUser): void {
    this._accessToken.set(token);
    this._currentUser.set(user);
    localStorage.setItem('accessToken', token);
    localStorage.setItem('currentUser', JSON.stringify(user));
  }

  clearSession(): void {
    this._accessToken.set(null);
    this._currentUser.set(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('currentUser');
  }

  private loadStoredUser(): CurrentUser | null {
    const stored = localStorage.getItem('currentUser');
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
}
