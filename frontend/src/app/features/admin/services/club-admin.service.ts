import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AdminCourt {
  id: string;
  name: string;
  sport: string;
  surface: string;
  player_format: string;
  is_covered: boolean;
  has_lighting: boolean;
  is_active: boolean;
  position: number;
  shape?: any;
  price_per_hour_cents?: number;
}

export interface AdminCourtCreate {
  name: string;
  sport: string;
  surface: string;
  player_format: string;
  is_covered: boolean;
  has_lighting: boolean;
  position?: number;
  price_per_hour_cents?: number;
}

export interface AdminBooking {
  id: string;
  code: string;
  club_id: string;
  court_id: string;
  court_name: string;
  period_start: string; // ISO
  period_end: string;
  status: 'held' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  price_cents: number;
  currency: string;
  payment_status: string;
  cancellation_reason?: string;
}

export interface AdminCreateBooking {
  court_id: string;
  period_start: string; // ISO
  duration_minutes: number;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  price_cents?: number;
  payment_status?: string;
  notes?: string;
}

export interface AdminBlock {
  id: string;
  club_id: string;
  court_id: string | null;
  period_start: string; // ISO UTC
  period_end: string;
  kind: 'maintenance' | 'tournament' | 'event' | 'closure' | 'weather' | 'other' | string;
  reason?: string | null;
  created_at: string;
}

export interface AdminCreateBlock {
  court_id?: string | null;
  period_start: string; // ISO UTC
  period_end: string;   // ISO UTC
  kind: string;
  reason?: string;
}

export interface ClubStaffMember {
  id: string;
  user_id: string;
  club_id: string;
  role: 'admin' | 'staff' | 'owner';
  is_active: boolean;
  user_email: string;
  user_full_name: string;
  user_phone?: string | null;
  created_at: string;
}

export interface ClubStaffCreate {
  email: string;
  full_name: string;
  role: 'staff' | 'admin';
  password?: string;
  phone?: string;
}

export interface BusinessHourItem {
  weekday: number; // 0=Lunes ... 6=Domingo
  opens_at: string; // "06:00"
  closes_at: string; // "23:00"
  closes_next_day?: boolean;
}

export interface BusinessHoursAdminResponse {
  id: string;
  weekday: number;
  opens_at: string;
  closes_at: string;
  closes_next_day: boolean;
}

export interface CourtLayoutItem {
  court_id: string;
  shape: {
    kind: 'rect' | 'polygon';
    x: number;
    y: number;
    w: number;
    h: number;
    rotation?: number;
  };
}

export interface DecorationItem {
  label: string;
  icon?: string;
  shape: {
    kind: 'rect' | 'polygon';
    x: number;
    y: number;
    w: number;
    h: number;
    rotation?: number;
  };
}

export interface ClubLayout {
  id?: string;
  club_id?: string;
  name: string;
  view_box_w: number;
  view_box_h: number;
  courts: CourtLayoutItem[];
  decorations: DecorationItem[];
}

export interface ClubDashboardInfo {
  club_id: string;
  club_name: string;
  slug: string;
  is_published: boolean;
  phone?: string | null;
  address?: string | null;
  role: string;
  timezone: string;
}

@Injectable({
  providedIn: 'root'
})
export class ClubAdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/clubs';

  // --- Club Info & Portal ---
  getClubInfo(clubId: string): Observable<ClubDashboardInfo> {
    return this.http.get<ClubDashboardInfo>(`${this.baseUrl}/${clubId}/dashboard`);
  }

  // --- Courts ---
  getCourts(clubId: string): Observable<AdminCourt[]> {
    return this.http.get<AdminCourt[]>(`${this.baseUrl}/${clubId}/courts`);
  }

  createCourt(clubId: string, req: AdminCourtCreate): Observable<AdminCourt> {
    return this.http.post<AdminCourt>(`${this.baseUrl}/${clubId}/courts`, req);
  }

  updateCourt(clubId: string, courtId: string, patch: Partial<AdminCourt>): Observable<AdminCourt> {
    return this.http.patch<AdminCourt>(`${this.baseUrl}/${clubId}/courts/${courtId}`, patch);
  }

  deleteCourt(clubId: string, courtId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${clubId}/courts/${courtId}`);
  }

  // --- Bookings & Timeline ---
  getBookings(clubId: string, startDate: string, endDate: string): Observable<AdminBooking[]> {
    const params = new HttpParams().set('start_date', startDate).set('end_date', endDate);
    return this.http.get<AdminBooking[]>(`${this.baseUrl}/${clubId}/bookings`, { params });
  }

  createBooking(clubId: string, req: AdminCreateBooking): Observable<AdminBooking> {
    return this.http.post<AdminBooking>(`${this.baseUrl}/${clubId}/bookings`, req);
  }

  updateBookingStatus(
    clubId: string,
    bookingId: string,
    status: 'cancelled' | 'no_show' | 'completed' | 'confirmed',
    cancellation_reason?: string
  ): Observable<AdminBooking> {
    return this.http.patch<AdminBooking>(`${this.baseUrl}/${clubId}/bookings/${bookingId}`, {
      status,
      cancellation_reason
    });
  }

  // --- Layout & Map ---
  getLayout(clubId: string): Observable<ClubLayout> {
    return this.http.get<ClubLayout>(`${this.baseUrl}/${clubId}/layout`);
  }

  updateLayout(clubId: string, layout: ClubLayout): Observable<ClubLayout> {
    return this.http.put<ClubLayout>(`${this.baseUrl}/${clubId}/layout`, layout);
  }

  // --- Staff & Recepcionistas ---
  getStaff(clubId: string): Observable<ClubStaffMember[]> {
    return this.http.get<ClubStaffMember[]>(`${this.baseUrl}/${clubId}/staff`);
  }

  createStaff(clubId: string, req: ClubStaffCreate): Observable<ClubStaffMember> {
    return this.http.post<ClubStaffMember>(`${this.baseUrl}/${clubId}/staff`, req);
  }

  deleteStaff(clubId: string, memberId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${clubId}/staff/${memberId}`);
  }

  // --- Blocks / Horarios Bloqueados (Mantenimiento, Torneos, etc.) ---
  getBlocks(clubId: string, courtId?: string): Observable<AdminBlock[]> {
    let params = new HttpParams();
    if (courtId) {
      params = params.set('court_id', courtId);
    }
    return this.http.get<AdminBlock[]>(`${this.baseUrl}/${clubId}/blocks`, { params });
  }

  createBlock(clubId: string, req: AdminCreateBlock): Observable<AdminBlock> {
    return this.http.post<AdminBlock>(`${this.baseUrl}/${clubId}/blocks`, req);
  }

  deleteBlock(clubId: string, blockId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${clubId}/blocks/${blockId}`);
  }

  // --- Business Hours / Horarios de Atención ---
  getBusinessHours(clubId: string): Observable<BusinessHoursAdminResponse[]> {
    return this.http.get<BusinessHoursAdminResponse[]>(`${this.baseUrl}/${clubId}/business-hours`);
  }

  updateBusinessHours(clubId: string, hours: BusinessHourItem[]): Observable<BusinessHoursAdminResponse[]> {
    return this.http.put<BusinessHoursAdminResponse[]>(`${this.baseUrl}/${clubId}/business-hours`, { hours });
  }

  // --- Booking Durations & Settings ---
  getSettings(clubId: string): Observable<ClubBookingSettings> {
    return this.http.get<ClubBookingSettings>(`${this.baseUrl}/${clubId}/settings`);
  }

  updateSettings(clubId: string, settings: Partial<ClubBookingSettings>): Observable<ClubBookingSettings> {
    return this.http.patch<ClubBookingSettings>(`${this.baseUrl}/${clubId}/settings`, settings);
  }

  // --- Reports & KPIs ---
  getOccupancyReport(clubId: string, startDate: string, endDate: string): Observable<any> {
    const params = new HttpParams().set('start_date', startDate).set('end_date', endDate);
    return this.http.get(`${this.baseUrl}/${clubId}/reports/occupancy`, { params });
  }

  getRevenueReport(clubId: string, startDate: string, endDate: string): Observable<any> {
    const params = new HttpParams().set('start_date', startDate).set('end_date', endDate);
    return this.http.get(`${this.baseUrl}/${clubId}/reports/revenue`, { params });
  }

  // --- Real-time SSE ---
  connectSse(clubId: string): EventSource {
    return new EventSource(`${this.baseUrl}/${clubId}/events`);
  }
}

export interface ClubBookingSettings {
  allowed_durations: number[];
  default_duration: number;
  slot_step_minutes?: number | null;
  currency?: string;
}

