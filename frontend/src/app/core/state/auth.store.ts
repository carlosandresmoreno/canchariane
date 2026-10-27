import { Injectable, computed, signal } from '@angular/core';
import { User } from '../models/auth.models';

const TOKEN_STORAGE_KEY = 'canchariane_access_token';
const ACTIVE_CLUB_KEY = 'canchariane_active_club';
const USER_STORAGE_KEY = 'canchariane_current_user';

const ROLE_HIERARCHY: Record<string, number> = {
  staff: 1,
  admin: 2,
  owner: 3
};

@Injectable({
  providedIn: 'root'
})
export class AuthStore {
  // State Signals
  readonly currentUser = signal<User | null>(this.getStoredUser());
  readonly accessToken = signal<string | null>(this.getStoredToken());
  readonly activeClubId = signal<string | null>(this.getStoredClubId());
  readonly isInitialized = signal<boolean>(false);
  readonly isAuthenticating = signal<boolean>(false);

  // Computed State
  readonly isAuthenticated = computed(() => !!this.accessToken());
  readonly isSuperadmin = computed(() => this.currentUser()?.is_superadmin ?? false);
  readonly memberships = computed(() => this.currentUser()?.memberships ?? []);

  readonly userInitials = computed(() => {
    const user = this.currentUser();
    if (!user?.full_name) return 'U';
    const parts = user.full_name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return user.full_name.slice(0, 2).toUpperCase();
  });

  // Actions
  setSession(token: string, user: User): void {
    this.accessToken.set(token);
    this.currentUser.set(user);
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // Ignore if localStorage unavailable
    }

    // Auto-select first club if none active
    if (!this.activeClubId() && user.memberships.length > 0) {
      this.setActiveClub(user.memberships[0].club_id);
    }
  }

  setAccessToken(token: string): void {
    this.accessToken.set(token);
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      // Ignore
    }
  }

  setCurrentUser(user: User): void {
    this.currentUser.set(user);
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // Ignore
    }
    if (!this.activeClubId() && user.memberships.length > 0) {
      this.setActiveClub(user.memberships[0].club_id);
    }
  }

  setActiveClub(clubId: string): void {
    this.activeClubId.set(clubId);
    try {
      localStorage.setItem(ACTIVE_CLUB_KEY, clubId);
    } catch {
      // Ignore
    }
  }

  clearSession(): void {
    this.accessToken.set(null);
    this.currentUser.set(null);
    this.activeClubId.set(null);
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(ACTIVE_CLUB_KEY);
    } catch {
      // Ignore
    }
  }

  hasRole(clubId: string, minRole: 'staff' | 'admin' | 'owner' = 'staff'): boolean {
    if (this.isSuperadmin()) return true;
    const membership = this.memberships().find((m) => m.club_id === clubId);
    if (!membership) return false;
    const userLevel = ROLE_HIERARCHY[membership.role] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] ?? 1;
    return userLevel >= requiredLevel;
  }

  private getStoredToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private getStoredUser(): User | null {
    try {
      const raw = localStorage.getItem(USER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private getStoredClubId(): string | null {
    try {
      return localStorage.getItem(ACTIVE_CLUB_KEY);
    } catch {
      return null;
    }
  }
}
