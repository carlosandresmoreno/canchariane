import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { PublicBookingService } from '../../services/public-booking.service';
import { PublicBookingResponse } from '../../models/public.models';

@Component({
  selector: 'app-booking-lookup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[#faf9f5] text-stone-800 flex flex-col justify-between selection:bg-stone-900 selection:text-stone-50 relative overflow-hidden font-sans">
      <!-- Luminous Architectural Sunlit Diffuse Overlay -->
      <div class="ambient-lighting"></div>

      <!-- Top Architectural Navbar -->
      <header class="border-b border-stone-200/70 bg-[#faf9f5]/80 backdrop-blur-xl sticky top-0 z-40">
        <div class="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
          <a routerLink="/" class="flex items-center gap-3 text-stone-800 group transition-all duration-300">
            <div class="w-9 h-9 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-xs font-serif italic text-stone-900 shadow-sm group-hover:border-stone-400 transition-all">
              C
            </div>
            <div class="flex flex-col">
              <span class="font-display font-semibold text-xs tracking-[0.22em] uppercase text-stone-900">Canchariane</span>
              <span class="text-[9px] uppercase tracking-widest text-stone-400 font-mono">Conserjería Digital</span>
            </div>
          </a>

          <a
            routerLink="/"
            class="text-xs tracking-wider uppercase text-stone-600 hover:text-stone-950 transition-colors flex items-center gap-2 group font-mono"
          >
            <span class="text-stone-400 group-hover:-translate-x-1 transition-transform">←</span>
            <span>Volver a Reservas</span>
          </a>
        </div>
      </header>

      <!-- Main Container -->
      <main class="max-w-xl mx-auto px-6 py-16 w-full flex-1 space-y-10 relative z-10">
        <div class="text-center space-y-3">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-100 border border-stone-200 text-[10px] tracking-[0.2em] uppercase text-stone-600 font-mono">
            <span>Localizador de Turnos</span>
          </div>
          <h1 class="text-4xl sm:text-5xl font-serif italic font-normal text-stone-900 tracking-tight">
            Consultar Reserva
          </h1>
          <p class="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed">
            Ingresa tu código único de 9 caracteres para revisar detalles, horarios o gestionar tu turno.
          </p>
        </div>

        <!-- Lookup Search Console -->
        <form (ngSubmit)="searchBooking()" class="p-2 sm:p-2.5 rounded-2xl bg-white border border-stone-200/90 shadow-[0_10px_30px_rgba(0,0,0,0.04)] space-y-3">
          <div class="flex flex-col sm:flex-row gap-2">
            <div class="relative flex-1">
              <input
                type="text"
                required
                [(ngModel)]="searchCode"
                name="searchCode"
                placeholder="CAN-A1B2C3"
                maxlength="14"
                class="w-full px-5 py-3.5 rounded-xl bg-stone-50/70 border border-stone-200 font-mono text-base uppercase text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:border-stone-600 tracking-widest transition-all duration-300"
              />
            </div>
            <button
              type="submit"
              [disabled]="isSearching() || !searchCode.trim()"
              class="py-3.5 px-7 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-50 font-medium text-xs font-mono uppercase tracking-wider disabled:opacity-40 transition-all duration-300 flex items-center justify-center gap-2 shadow-md active:scale-[0.98]"
            >
              @if (isSearching()) {
                <span class="w-3.5 h-3.5 border-2 border-stone-50 border-t-transparent rounded-full animate-spin"></span>
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
          <div class="rounded-3xl bg-white border border-stone-200/90 shadow-[0_20px_50px_rgba(0,0,0,0.06)] overflow-hidden transition-all duration-500 animate-in fade-in zoom-in-95">
            <!-- Receipt Header -->
            <div class="p-6 sm:p-7 border-b border-stone-200/70 flex items-center justify-between bg-stone-50/50">
              <div>
                <span class="text-[10px] font-mono uppercase tracking-[0.2em] text-stone-400 block mb-1">Identificador de Reserva</span>
                <div class="font-mono text-2xl sm:text-3xl font-light text-stone-900 tracking-wider select-all">
                  {{ booking()?.code }}
                </div>
              </div>
              <span
                class="px-3.5 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-widest border"
                [ngClass]="booking()?.status === 'confirmed' ? 'bg-[#edf1ea] text-[#3f4738] border-[#5a6856]/30' : 'bg-stone-100 text-stone-600 border-stone-200'"
              >
                {{ booking()?.status }}
              </span>
            </div>

            <!-- Receipt Grid Details -->
            <div class="p-6 sm:p-7 grid grid-cols-2 gap-y-6 gap-x-4 text-xs font-sans">
              <div>
                <span class="text-[10px] uppercase tracking-wider text-stone-400 font-mono block mb-1">Club Anfitrión</span>
                <span class="font-medium text-stone-800 text-sm">{{ booking()?.club_name }}</span>
              </div>
              <div>
                <span class="text-[10px] uppercase tracking-wider text-stone-400 font-mono block mb-1">Instalación</span>
                <span class="font-medium text-stone-800 text-sm">{{ booking()?.court_name }}</span>
              </div>
              <div>
                <span class="text-[10px] uppercase tracking-wider text-stone-400 font-mono block mb-1">Fecha & Hora</span>
                <span class="font-mono text-stone-700 text-xs">
                  {{ formatDateTime(booking()?.start_time) }}
                </span>
              </div>
              <div>
                <span class="text-[10px] uppercase tracking-wider text-stone-400 font-mono block mb-1">Titular</span>
                <span class="font-medium text-stone-800 text-sm">{{ booking()?.customer_name }}</span>
              </div>
              <div>
                <span class="text-[10px] uppercase tracking-wider text-stone-400 font-mono block mb-1">Importe</span>
                <span class="font-serif italic text-stone-900 text-xl block">
                  {{ formatCents(booking()?.price_cents) }}
                </span>
              </div>
              <div>
                <span class="text-[10px] uppercase tracking-wider text-stone-400 font-mono block mb-1">Liquidación</span>
                <span class="font-mono text-stone-700 text-xs uppercase px-2.5 py-1 rounded-md bg-stone-100 border border-stone-200 inline-block">
                  {{ booking()?.payment_status }}
                </span>
              </div>
            </div>

            <!-- Cancellation action -->
            @if (booking()?.status === 'confirmed') {
              <div class="p-6 sm:p-7 border-t border-stone-200/70 bg-stone-50/30">
                @if (!showCancelConfirm()) {
                  <button
                    type="button"
                    (click)="showCancelConfirm.set(true)"
                    class="w-full py-3 rounded-xl border border-stone-200 hover:border-rose-300 text-stone-600 hover:text-rose-700 hover:bg-rose-50/50 text-xs font-mono uppercase tracking-wider transition-all duration-300"
                  >
                    Cancelar este turno
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
                        class="flex-1 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-medium text-xs transition-colors shadow-sm"
                      >
                        {{ isCancelling() ? 'Cancelando...' : 'Confirmar Cancelación' }}
                      </button>
                      <button
                        type="button"
                        (click)="showCancelConfirm.set(false)"
                        class="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs hover:bg-stone-100 transition-colors"
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
      <footer class="border-t border-stone-200/60 py-8 text-center text-[11px] text-stone-400 font-mono tracking-wider">
        CANCHARIANE ARCHITECTURE • BERLIN / TOKYO MINIMALISM
      </footer>
    </div>
  `
})
export class BookingLookupComponent {
  private readonly publicService = inject(PublicBookingService);

  searchCode = '';
  readonly isSearching = signal<boolean>(false);
  readonly isCancelling = signal<boolean>(false);
  readonly showCancelConfirm = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly booking = signal<PublicBookingResponse | null>(null);

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
        alert(err.error?.detail || 'Error al cancelar la reserva');
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
