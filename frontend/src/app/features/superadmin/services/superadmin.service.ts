import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SuperadminStats {
  total_clubs: number;
  active_clubs: number;
  published_clubs: number;
  total_courts: number;
  total_users: number;
  total_bookings: number;
}

export interface SuperadminClub {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  subscription_status: string; // 'active' | 'trial' | 'suspended'
  is_published: boolean;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  courts_count: number;
  members_count: number;
  created_at: string;
}

export interface SuperadminClubCreate {
  name: string;
  slug: string;
  timezone?: string;
  currency?: string;
  subscription_status?: string;
  is_published?: boolean;
  address?: string;
  phone?: string;
  email?: string;
  admin_user_email?: string;
  admin_user_password?: string;
  admin_user_name?: string;
}

export interface SuperadminClubUpdate {
  name?: string;
  slug?: string;
  timezone?: string;
  subscription_status?: string;
  is_published?: boolean;
  address?: string;
  phone?: string;
  email?: string;
}

export interface SuperadminMembership {
  id: string;
  user_id: string;
  user_email: string;
  user_full_name: string;
  club_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class SuperadminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/superadmin';

  getStats(): Observable<SuperadminStats> {
    return this.http.get<SuperadminStats>(`${this.baseUrl}/stats`);
  }

  getClubs(search?: string, status?: string, isPublished?: boolean): Observable<SuperadminClub[]> {
    let params = new HttpParams();
    if (search && search.trim()) {
      params = params.set('search', search.trim());
    }
    if (status && status !== 'all') {
      params = params.set('subscription_status', status);
    }
    if (isPublished !== undefined && isPublished !== null) {
      params = params.set('is_published', isPublished);
    }
    return this.http.get<SuperadminClub[]>(`${this.baseUrl}/clubs`, { params });
  }

  getClub(clubId: string): Observable<SuperadminClub> {
    return this.http.get<SuperadminClub>(`${this.baseUrl}/clubs/${clubId}`);
  }

  createClub(payload: SuperadminClubCreate): Observable<SuperadminClub> {
    return this.http.post<SuperadminClub>(`${this.baseUrl}/clubs`, payload);
  }

  updateClub(clubId: string, payload: SuperadminClubUpdate): Observable<SuperadminClub> {
    return this.http.patch<SuperadminClub>(`${this.baseUrl}/clubs/${clubId}`, payload);
  }

  addMember(
    clubId: string,
    userEmail: string,
    role: string,
    userPassword?: string,
    userFullName?: string
  ): Observable<SuperadminMembership> {
    return this.http.post<SuperadminMembership>(`${this.baseUrl}/clubs/${clubId}/members`, {
      user_email: userEmail,
      role,
      user_password: userPassword || undefined,
      user_full_name: userFullName || undefined
    });
  }

  togglePower(clubId: string): Observable<SuperadminClub> {
    return this.http.post<SuperadminClub>(`${this.baseUrl}/clubs/${clubId}/toggle-power`, {});
  }

  deleteClub(clubId: string, hardDelete: boolean = false): Observable<void> {
    const params = new HttpParams().set('hard_delete', hardDelete.toString());
    return this.http.delete<void>(`${this.baseUrl}/clubs/${clubId}`, { params });
  }

  removeMember(clubId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/clubs/${clubId}/members/${userId}`);
  }
}
