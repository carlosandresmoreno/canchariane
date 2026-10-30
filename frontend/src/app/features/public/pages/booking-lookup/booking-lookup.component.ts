import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PublicBookingService } from '../../services/public-booking.service';
import { PublicBookingResponse } from '../../models/public.models';

@Component({
  selector: 'app-booking-lookup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-white text-slate-900 flex flex-col justify-between selection:bg-[#0056FB] selection:text-white relative overflow-hidden font-sans">
      <!-- Clean Luminous Ambient Glow -->
      <div class="ambient-lighting"></div>

      <!-- Top Architectural Navbar -->
      <header class="border-b border-slate-200/80 bg-white/90 backdrop-blur-xl sticky top-0 z-40">
        <div class="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
          <a routerLink="/" class="flex items-center gap-3 text-slate-900 group transition-all duration-300">
            <img src="logo-mark.svg" alt="Canchariane" class="w-9 h-9 rounded-xl shadow-xs group-hover:scale-105 transition-all" />
            <div class="flex flex-col">
              <span class="font-display font-semibold text-xs tracking-[0.22em] uppercase text-slate-900">Canchariane</span>
              <span class="text-[9px] uppercase tracking-widest text-slate-400 font-mono">Conserjería Digital</span>
            </div>
          </a>

          <a
            routerLink="/"
            class="text-xs tracking-wider uppercase text-slate-600 hover:text-slate-950 transition-colors flex items-center gap-2 group font-mono"
          >
            <span class="text-slate-400 group-hover:-translate-x-1 transition-transform">←</span>
            <span>Volver a Reservas</span>
          </a>
        </div>
      </header>

      <!-- Main Container -->
      <main class="max-w-xl mx-auto px-6 py-16 w-full flex-1 space-y-10 relative z-10">
        <div class="text-center space-y-3">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] tracking-[0.2em] uppercase text-slate-600 font-mono">
            <span>Localizador de Turnos</span>
          </div>
          <h1 class="text-4xl sm:text-5xl font-serif italic font-normal text-slate-900 tracking-tight">
            Consultar Reserva
          </h1>
          <p class="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed">
            Ingresa tu código único de 9 caracteres para revisar detalles, horarios o gestionar tu turno.
          </p>
        </div>

        <!-- Lookup Search Console -->
        <form (ngSubmit)="searchBooking()" class="p-2 sm:p-2.5 rounded-2xl bg-white border border-slate-200 shadow-[0_15px_45px_rgba(0,0,0,0.05)] space-y-3">
          <div class="flex flex-col sm:flex-row gap-2">
            <div class="relative flex-1">
              <input
                type="text"
                required
                [(ngModel)]="searchCode"
                name="searchCode"
                placeholder="CAN-A1B2C3"
                maxlength="14"
                class="w-full px-5 py-3.5 rounded-xl bg-slate-50/70 border border-slate-200 font-mono text-base uppercase text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#0056FB] focus:ring-1 focus:ring-[#0056FB]/30 tracking-widest transition-all duration-300"
              />
            </div>
            <button
              type="submit"
              [disabled]="isSearching() || !searchCode.trim()"
              class="py-3.5 px-7 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] text-white font-medium text-xs font-mono uppercase tracking-wider disabled:opacity-40 transition-all duration-300 flex items-center justify-center gap-2 shadow-md active:scale-[0.98]"
            >
              @if (isSearching()) {
                <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Buscando...</span>
              } @else {
                <span>Consultar</span>
              }
            </button>
          </div>

          @if (errorMessage()) {
            <div class="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs text-center font-sans tracking-wide">
              {{ errorMessage() }}
            </div>
          }
        </form>

        <!-- Booking Result Card (Architectural Receipt Ticket) -->
        @if (booking()) {
          <div class="rounded-3xl bg-white border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.06)] overflow-hidden transition-all duration-500 animate-in fade-in zoom-in-95">
            <!-- Receipt Header -->
            <div class="p-6 sm:p-7 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span class="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 block mb-1">Identificador de Reserva</span>
                <div class="font-mono text-2xl sm:text-3xl font-light text-slate-900 tracking-wider select-all">
                  {{ booking()?.code }}
                </div>
              </div>
              <span
                class="px-3.5 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-widest border"
                [ngClass]="booking()?.status === 'confirmed' ? 'bg-[#EFF6FF] text-[#0056FB] border-[#0056FB]/30' : 'bg-slate-100 text-slate-600 border-slate-200'"
              >
                {{ booking()?.status }}
              </span>
            </div>

            <!-- Receipt Grid Details -->
            <div class="p-6 sm:p-7 grid grid-cols-2 gap-y-6 gap-x-4 text-xs font-sans">
              <div>
                <span class="text-[10px] uppercase tracking-wider text-slate-400 font-mono block mb-1">Club Anfitrión</span>
                <span class="font-medium text-slate-800 text-sm">{{ booking()?.club_name }}</span>
              </div>
              <div>
                <span class="text-[10px] uppercase tracking-wider text-slate-400 font-mono block mb-1">Instalación</span>
                <span class="font-medium text-slate-800 text-sm">{{ booking()?.court_name }}</span>
              </div>
              <div>
                <span class="text-[10px] uppercase tracking-wider text-slate-400 font-mono block mb-1">Fecha & Hora</span>
                <span class="font-mono text-slate-700 text-xs">
                  {{ formatDateTime(booking()?.start_time) }}
                </span>
              </div>
              <div>
                <span class="text-[10px] uppercase tracking-wider text-slate-400 font-mono block mb-1">Titular</span>
                <span class="font-medium text-slate-800 text-sm">{{ booking()?.customer_name }}</span>
              </div>
              <div>
                <span class="text-[10px] uppercase tracking-wider text-slate-400 font-mono block mb-1">Importe</span>
                <span class="font-serif italic text-slate-900 text-xl block">
                  {{ formatCents(booking()?.price_cents) }}
                </span>
              </div>
              <div>
                <span class="text-[10px] uppercase tracking-wider text-slate-400 font-mono block mb-1">Liquidación</span>
                <span class="font-mono text-[#0056FB] text-xs uppercase px-2.5 py-1 rounded-md bg-[#EFF6FF] border border-[#0056FB]/30 inline-block">
                  {{ booking()?.payment_status }}
                </span>
              </div>
            </div>

            <!-- Cancellation action -->
            @if (booking()?.status === 'confirmed') {
              <div class="p-6 sm:p-7 border-t border-slate-100 bg-slate-50/30">
                @if (!showCancelConfirm()) {
                  <button
                    type="button"
                    (click)="showCancelConfirm.set(true)"
                    class="w-full py-2.5 rounded-xl border border-slate-200 hover:border-rose-300 text-slate-500 hover:text-rose-600 hover:bg-rose-50/50 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>✕</span>
                    <span>Cancelar esta reserva</span>
                  </button>
                } @else {
                  <div class="p-5 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-3">
                    <p class="text-xs text-rose-800 leading-relaxed font-sans">
                      ¿Confirmas la cancelación? La cancha se liberará de inmediato para otros miembros del club.
                    </p>
                    <div class="flex items-center gap-3">
                      <button
                        type="button"
                        [disabled]="isCancelling()"
                        (click)="cancelBooking()"
                        class="flex-1 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-medium text-xs transition-colors shadow-xs"
                      >
                        {{ isCancelling() ? 'Cancelando...' : 'Confirmar Cancelación' }}
                      </button>
                      <button
                        type="button"
                        (click)="showCancelConfirm.set(false)"
                        class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs hover:bg-slate-100 transition-colors"
                      >
                        Desistir
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }
      </main>

      <!-- Minimalist Architectural Footer -->
      <footer class="border-t border-slate-200/80 py-8 text-center text-[11px] text-slate-400 font-mono tracking-wider">
        CANCHARIANE &copy; 2026 • ARIANEDEVS
      </footer>
    </div>
  `
})
export class BookingLookupComponent implements OnInit {
  private readonly publicService = inject(PublicBookingService);
  private readonly route = inject(ActivatedRoute);

  searchCode = '';
  readonly isSearching = signal<boolean>(false);
  readonly isCancelling = signal<boolean>(false);
  readonly showCancelConfirm = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly booking = signal<PublicBookingResponse | null>(null);

  ngOnInit(): void {
    const codeParam = this.route.snapshot.queryParamMap.get('code');
    if (codeParam) {
      this.searchCode = codeParam.trim().toUpperCase();
      this.searchBooking();
    }
  }

  searchBooking(): void {
    const code = this.searchCode.trim().toUpperCase();
    if (!code) return;

    this.isSearching.set(true);
    this.errorMessage.set(null);
    this.showCancelConfirm.set(false);

    this.publicService.lookupBooking(code).subscribe({
      next: (res) => {
        this.booking.set(res);
        this.isSearching.set(false);
      },
      error: (err) => {
        this.isSearching.set(false);
        this.booking.set(null);
        this.errorMessage.set(err.error?.detail || 'No se encontró ninguna reserva con este código.');
      }
    });
  }

  cancelBooking(): void {
    const code = this.booking()?.code;
    if (!code) return;

    this.isCancelling.set(true);
    this.publicService.cancelBooking(code, 'Cancelada por el usuario desde la web').subscribe({
      next: (cancelled) => {
        this.booking.set(cancelled);
        this.isCancelling.set(false);
        this.showCancelConfirm.set(false);
      },
      error: (err) => {
        this.isCancelling.set(false);
        const detail = err.error?.detail;
        const msg = typeof detail === 'string'
          ? detail
          : (Array.isArray(detail) ? detail.map((x: any) => x.msg).join(' | ') : 'Error al cancelar la reserva');
        alert(msg);
      }
    });
  }

  formatCents(cents?: number): string {
    if (!cents) return '$0 COP';
    return '$' + (cents / 100).toLocaleString('es-CO') + ' COP';
  }

  formatDateTime(isoStr?: string): string {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleString('es-CO', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
