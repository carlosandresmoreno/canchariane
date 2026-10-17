import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ConfirmBookingRequest,
  CreateHoldRequest,
  CreateHoldResponse,
  PublicBookingResponse,
  PublicClub,
  PublicClubLayout,
  PublicSlot
} from '../models/public.models';

@Injectable({
  providedIn: 'root'
})
export class PublicBookingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1';

  getClub(slug: string): Observable<PublicClub> {
    return this.http.get<PublicClub>(`${this.baseUrl}/clubs/${slug}`);
  }

  getClubLayout(slug: string): Observable<PublicClubLayout> {
    return this.http.get<PublicClubLayout>(`${this.baseUrl}/clubs/${slug}/layout`);
  }

  getAvailability(
    slug: string,
    date: string,
    optionsOrCourtId?:
      | string
      | {
          courtId?: string;
          sport?: string;
          duration?: number;
          step?: number;
        },
    sport?: string,
    duration: number = 60,
    step?: number
  ): Observable<PublicSlot[]> {
    let opts: { courtId?: string; sport?: string; duration?: number; step?: number } = {};
    if (typeof optionsOrCourtId === 'object' && optionsOrCourtId !== null) {
      opts = optionsOrCourtId;
    } else {
      opts = {
        courtId: optionsOrCourtId,
        sport,
        duration: duration ?? 60,
        step
      };
    }
    const finalDuration = opts.duration ?? 60;
    let params = new HttpParams().set('date', date).set('duration', finalDuration.toString());
    if (opts.sport) params = params.set('sport', opts.sport);
    if (opts.step) params = params.set('step', opts.step.toString());

    return this.http.get<any[]>(`${this.baseUrl}/clubs/${slug}/availability`, { params }).pipe(
      map((rawSlots) =>
        rawSlots.map((s) => ({
          court_id: s.court_id,
          court_name: s.court_name,
          period_start_utc: s.period_start_utc,
          period_end_utc: s.period_end_utc,
          local_start: s.local_start,
          local_end: s.local_end,
          start_time: s.period_start_utc,
          end_time: s.period_end_utc,
          local_start_time: s.local_start,
          local_end_time: s.local_end,
          duration_minutes: finalDuration,
          price_cents: s.price_cents,
          currency: s.currency,
          is_available: true
        }))
      )
    );
  }

  createHold(slug: string, req: CreateHoldRequest): Observable<CreateHoldResponse> {
    return this.http.post<CreateHoldResponse>(`${this.baseUrl}/bookings/holds`, {
      club_slug: slug,
      court_id: req.court_id,
      start_time: req.start_time,
      duration_minutes: req.duration_minutes
    });
  }

  confirmBooking(
    slug: string,
    idempotencyKey: string,
    req: ConfirmBookingRequest
  ): Observable<PublicBookingResponse> {
    return this.http
      .post<any>(`${this.baseUrl}/bookings`, req, {
        headers: {
          'Idempotency-Key': idempotencyKey
        }
      })
      .pipe(
        map((b) => ({
          id: b.id,
          code: b.code,
          club_name: slug,
          court_name: 'Cancha Reservada',
          start_time: b.period_start,
          end_time: b.period_end,
          price_cents: b.price_cents,
          currency: b.currency,
          status: b.status,
          payment_status: b.payment_status,
          customer_name: b.customer_name,
          created_at: b.created_at
        }))
      );
  }

  lookupBooking(code: string): Observable<PublicBookingResponse> {
    return this.http
      .get<any>(`${this.baseUrl}/bookings/by-code/${code.toUpperCase().trim()}`)
      .pipe(
        map((b) => ({
          id: b.id,
          code: b.code,
          club_name: 'Club Canchariane',
          court_name: 'Cancha Reservada',
          start_time: b.period_start,
          end_time: b.period_end,
          price_cents: b.price_cents,
          currency: b.currency,
          status: b.status,
          payment_status: b.payment_status,
          customer_name: b.customer_name,
          created_at: b.created_at
        }))
      );
  }

  cancelBooking(code: string, reason?: string, phone?: string): Observable<PublicBookingResponse> {
    const payload: { reason?: string; phone?: string } = {
      reason: reason || 'Cancelada por el cliente'
    };
    if (phone) {
      payload.phone = phone;
    }
    return this.http
      .post<any>(
        `${this.baseUrl}/bookings/by-code/${code.toUpperCase().trim()}/cancel`,
        payload
      )
      .pipe(
        map((b) => ({
          id: b.id,
          code: b.code,
          club_name: 'Club Canchariane',
          court_name: 'Cancha Reservada',
          start_time: b.period_start,
          end_time: b.period_end,
          price_cents: b.price_cents,
          currency: b.currency,
          status: b.status,
          payment_status: b.payment_status,
          customer_name: b.customer_name,
          created_at: b.created_at
        }))
      );
  }
}

