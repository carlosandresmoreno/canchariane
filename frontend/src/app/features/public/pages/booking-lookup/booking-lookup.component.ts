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
    <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      <!-- Navbar -->
      <header class="border-b border-slate-800 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-40">
        <div class="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <a routerLink="/" class="flex items-center gap-2.5 text-white font-bold font-display text-lg">
            <span class="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950">C</span>
            <span>Canchariane</span>
          </a>
          <a
            routerLink="/"
            class="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors"
          >
            ← Volver al inicio
          </a>
        </div>
      </header>

      <!-- Main Container -->
      <main class="max-w-xl mx-auto px-4 py-10 w-full flex-1 space-y-8">
        <div class="text-center space-y-2">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
            Consultar Reserva
          </h1>
          <p class="text-slate-400 text-sm">
            Ingresa tu código único de 9 caracteres (ej: <span class="font-mono text-emerald-400">CAN-A1B2C3</span>)
          </p>
        </div>

        <!-- Lookup Search Box -->
        <form (ngSubmit)="searchBooking()" class="p-4 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div class="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              [(ngModel)]="searchCode"
              name="searchCode"
              placeholder="CAN-XXXXXX"
              maxlength="12"
              class="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-base uppercase text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 tracking-wider"
            />
            <button
              type="submit"
              [disabled]="isSearching() || !searchCode.trim()"
              class="py-3 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              @if (isSearching()) {
                <span class="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                <span>Buscando...</span>
              } @else {
                <span>Buscar</span>
              }
            </button>
          </div>

          @if (errorMessage()) {
            <div class="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs text-center">
              {{ errorMessage() }}
            </div>
          }
        </form>

        <!-- Booking Result Card -->
        @if (booking()) {
          <div class="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div class="flex items-start justify-between pb-4 border-b border-slate-800">
              <div>
                <span class="text-xs font-mono text-slate-400">CÓDIGO</span>
                <div class="font-mono text-2xl font-extrabold text-emerald-400 tracking-wider select-all">
                  {{ booking()?.code }}
                </div>
              </div>
              <span
                class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border"
                [ngClass]="booking()?.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'"
              >
                {{ booking()?.status }}
              </span>
            </div>

            <!-- Details Grid -->
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-xs text-slate-500 block">Club</span>
                <span class="font-semibold text-white">{{ booking()?.club_name }}</span>
              </div>
              <div>
                <span class="text-xs text-slate-500 block">Cancha</span>
                <span class="font-semibold text-white">{{ booking()?.court_name }}</span>
              </div>
              <div>
                <span class="text-xs text-slate-500 block">Horario</span>
                <span class="font-mono text-white text-xs">
                  {{ formatDateTime(booking()?.start_time) }}
                </span>
              </div>
              <div>
                <span class="text-xs text-slate-500 block">Titular</span>
                <span class="font-semibold text-white">{{ booking()?.customer_name }}</span>
              </div>
              <div>
                <span class="text-xs text-slate-500 block">Tarifa</span>
                <span class="font-display font-bold text-emerald-400 text-base">
                  {{ formatCents(booking()?.price_cents) }}
                </span>
              </div>
              <div>
                <span class="text-xs text-slate-500 block">Pago</span>
                <span class="font-semibold text-amber-300 text-xs uppercase">{{ booking()?.payment_status }}</span>
              </div>
            </div>

            <!-- Cancellation action -->
            @if (booking()?.status === 'confirmed') {
              <div class="pt-4 border-t border-slate-800">
                @if (!showCancelConfirm()) {
                  <button
                    type="button"
                    (click)="showCancelConfirm.set(true)"
                    class="w-full py-2.5 rounded-xl border border-rose-800/80 text-rose-400 hover:bg-rose-950/40 text-xs font-semibold transition-colors"
                  >
                    Cancelar esta reserva
                  </button>
                } @else {
                  <div class="p-4 rounded-xl bg-rose-950/30 border border-rose-800/60 space-y-3">
                    <p class="text-xs text-rose-300">
                      ¿Seguro que deseas cancelar? Esta acción liberará la cancha inmediatamente.
                    </p>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        [disabled]="isCancelling()"
                        (click)="cancelBooking()"
                        class="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors"
                      >
                        {{ isCancelling() ? 'Cancelando...' : 'Sí, Cancelar Reserva' }}
                      </button>
                      <button
                        type="button"
                        (click)="showCancelConfirm.set(false)"
                        class="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors"
                      >
                        No cancelar
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }
      </main>

      <!-- Footer -->
      <footer class="border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        Canchariane v2 • Consulta y gestión de reservas
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
