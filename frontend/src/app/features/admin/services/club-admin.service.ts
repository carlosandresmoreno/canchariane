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

@Injectable({
  providedIn: 'root'
})
export class ClubAdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/clubs';

  getCourts(clubId: string): Observable<AdminCourt[]> {
    return this.http.get<AdminCourt[]>(`${this.baseUrl}/${clubId}/courts`);
  }

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

  getOccupancyReport(clubId: string, startDate: string, endDate: string): Observable<any> {
    const params = new HttpParams().set('start_date', startDate).set('end_date', endDate);
    return this.http.get(`${this.baseUrl}/${clubId}/reports/occupancy`, { params });
  }

  getRevenueReport(clubId: string, startDate: string, endDate: string): Observable<any> {
    const params = new HttpParams().set('start_date', startDate).set('end_date', endDate);
    return this.http.get(`${this.baseUrl}/${clubId}/reports/revenue`, { params });
  }

  connectSse(clubId: string): EventSource {
    return new EventSource(`${this.baseUrl}/${clubId}/events`);
  }
}
