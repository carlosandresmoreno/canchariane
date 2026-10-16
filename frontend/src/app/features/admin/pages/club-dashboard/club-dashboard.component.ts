import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthStore } from '../../../../core/state/auth.store';
import { AdminBooking, AdminCourt, ClubAdminService } from '../../services/club-admin.service';

interface TimelineRow {
  hourStr: string; // "07:00"
  hourNum: number;
}

@Component({
  selector: 'app-club-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[#0A1832] text-[#e2e8f4] flex flex-col selection:bg-[#0056FB] selection:text-white relative overflow-hidden font-sans">
      <!-- Organic Deep Marine Ambient Glow -->
      <div class="ambient-lighting"></div>

      <!-- Top Architectural Navbar -->
      <header class="border-b border-white/[0.08] bg-[#0A1832]/85 backdrop-blur-xl sticky top-0 z-30">
        <div class="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-2xl bg-[#0e2042] border border-white/[0.08] flex items-center justify-center font-serif italic text-sm text-[#0056FB] shadow-[0_0_15px_rgba(0,86,251,0.25)]">
              C
            </div>
            <div>
              <div class="flex items-center gap-2.5">
                <h1 class="font-display font-semibold text-white text-sm sm:text-base tracking-wide">Panel de Operaciones</h1>
                <span class="px-2.5 py-0.5 rounded-full bg-[#0056FB]/20 text-[#99beff] border border-[#0056FB]/40 text-[10px] font-mono tracking-wider uppercase flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-[#0056FB] animate-pulse"></span>
                  SSE Sincronizado
                </span>
              </div>
              <p class="text-[11px] text-[#8fa3c7] font-mono tracking-wider uppercase">Recepción & Gestión de Pistas</p>
            </div>
          </div>

          <!-- User controls & Date navigation -->
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-1 bg-[#0e2042] p-1 rounded-xl border border-white/[0.08] text-xs font-mono shadow-sm">
              <button
                type="button"
                (click)="navigateDay(-1)"
                class="p-2 hover:bg-[#132a54] rounded-lg text-[#8fa3c7] hover:text-white transition-colors"
                title="Día anterior"
              >
                ◀
              </button>
              <button
                type="button"
                (click)="goToToday()"
                class="px-3.5 py-1.5 hover:bg-[#132a54] rounded-lg text-[#e2e8f4] hover:text-white transition-colors tracking-wider uppercase text-[11px]"
              >
                {{ formattedDateDisplay() }}
              </button>
              <button
                type="button"
                (click)="navigateDay(1)"
                class="p-2 hover:bg-[#132a54] rounded-lg text-[#8fa3c7] hover:text-white transition-colors"
                title="Día siguiente"
              >
                ▶
              </button>
            </div>

            <!-- User Menu -->
            <div class="flex items-center gap-3 pl-3 border-l border-white/[0.08]">
              <div class="w-9 h-9 rounded-full bg-[#132a54] border border-white/[0.08] flex items-center justify-center text-xs font-mono font-medium text-white shadow-sm">
                {{ authStore.userInitials() }}
              </div>
              <button
                type="button"
                (click)="logout()"
                class="text-xs uppercase tracking-wider font-mono text-[#8fa3c7] hover:text-white transition-colors hidden sm:inline"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main class="max-w-7xl mx-auto px-6 py-8 w-full flex-1 space-y-8 relative z-10">
        <!-- Executive KPI Monoliths -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div class="p-6 rounded-3xl bg-[#0e2042]/90 backdrop-blur-2xl border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex items-center justify-between group hover:border-[#0056FB]/50 transition-all duration-300">
            <div>
              <span class="text-[10px] text-[#8fa3c7] uppercase font-mono tracking-[0.2em] block mb-2">Ocupación Hoy</span>
              <div class="text-3xl sm:text-4xl font-serif italic text-white">
                {{ occupancyPct() }}%
              </div>
              <span class="text-[11px] text-[#556b8e] font-mono mt-1 block">Capacidad de pista reservada</span>
            </div>
            <div class="w-12 h-12 rounded-2xl bg-[#132a54] border border-white/[0.08] flex items-center justify-center text-[#0056FB] font-mono text-sm group-hover:scale-105 transition-transform shadow-[0_0_15px_rgba(0,86,251,0.2)]">
              %
            </div>
          </div>

          <div class="p-6 rounded-3xl bg-[#0e2042]/90 backdrop-blur-2xl border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex items-center justify-between group hover:border-[#0056FB]/50 transition-all duration-300">
            <div>
              <span class="text-[10px] text-[#8fa3c7] uppercase font-mono tracking-[0.2em] block mb-2">Recaudación Estimada</span>
              <div class="text-3xl sm:text-4xl font-serif italic text-white">
                {{ formatCents(totalRevenueCents()) }}
              </div>
              <span class="text-[11px] text-[#556b8e] font-mono mt-1 block">Ingresos de la jornada</span>
            </div>
            <div class="w-12 h-12 rounded-2xl bg-[#132a54] border border-white/[0.08] flex items-center justify-center text-[#0056FB] font-mono text-sm group-hover:scale-105 transition-transform shadow-[0_0_15px_rgba(0,86,251,0.2)]">
              $
            </div>
          </div>

          <div class="p-6 rounded-3xl bg-[#0e2042]/90 backdrop-blur-2xl border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex items-center justify-between group hover:border-[#0056FB]/50 transition-all duration-300">
            <div>
              <span class="text-[10px] text-[#8fa3c7] uppercase font-mono tracking-[0.2em] block mb-2">Turnos Confirmados</span>
              <div class="text-3xl sm:text-4xl font-serif italic text-white">
                {{ activeBookingsCount() }}
              </div>
              <span class="text-[11px] text-[#556b8e] font-mono mt-1 block">Partidos programados</span>
            </div>
            <div class="w-12 h-12 rounded-2xl bg-[#132a54] border border-white/[0.08] flex items-center justify-center text-[#0056FB] font-mono text-sm group-hover:scale-105 transition-transform shadow-[0_0_15px_rgba(0,86,251,0.2)]">
              #
            </div>
          </div>
        </div>

        <!-- Timeline Grid Calendar (Architectural Blueprint) -->
        <div class="rounded-3xl border border-white/[0.08] bg-[#0e2042]/90 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
          <div class="p-6 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#071328]/50">
            <div>
              <h2 class="font-serif italic text-xl sm:text-2xl text-white">Matriz de Ocupación por Cancha</h2>
              <p class="text-xs text-[#8fa3c7] font-mono mt-0.5">Haz clic sobre cualquier celda libre para crear una reserva de mostrador</p>
            </div>
            <button
              type="button"
              (click)="openNewBookingModal()"
              class="px-5 py-2.5 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] text-white font-medium text-xs tracking-wider uppercase font-mono transition-all duration-300 shadow-[0_0_25px_rgba(0,86,251,0.4)] flex items-center justify-center gap-2 active:scale-95"
            >
              <span>+ Nueva Reserva</span>
            </button>
          </div>

          <!-- Multi-court timeline table -->
          <div class="overflow-x-auto">
            <div class="min-w-[760px]">
              <!-- Header Row (Courts) -->
              <div class="grid border-b border-white/[0.08] bg-[#071328]/80 text-xs font-mono font-medium text-[#8fa3c7]"
                   [style.grid-template-columns]="gridColumnsStyle()">
                <div class="p-4 text-center border-r border-white/[0.08] text-[#556b8e] text-[10px] tracking-[0.2em] uppercase">
                  HORA
                </div>
                @for (court of courts(); track court.id) {
                  <div class="p-4 text-center border-r border-white/[0.08] last:border-r-0 flex items-center justify-center gap-2.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-[#0056FB]"></span>
                    <span class="font-sans font-semibold text-white tracking-wide">{{ court.name }}</span>
                    <span class="text-[#556b8e] font-normal text-[10px] uppercase font-mono tracking-wider">({{ court.sport }})</span>
                  </div>
                }
              </div>

              <!-- Hour Rows -->
              @for (row of timelineRows; track row.hourStr) {
                <div class="grid border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors"
                     [style.grid-template-columns]="gridColumnsStyle()">
                  <!-- Time Label -->
                  <div class="p-3 border-r border-white/[0.08] text-xs font-mono text-[#8fa3c7] flex items-center justify-center bg-[#071328]/40">
                    {{ row.hourStr }}
                  </div>

                  <!-- Cells per Court -->
                  @for (court of courts(); track court.id) {
                    @let booking = getBookingForCell(court.id, row.hourNum);
                    <div
                      class="p-1.5 border-r border-white/[0.06] last:border-r-0 min-h-[72px] flex items-center justify-center transition-colors relative"
                    >
                      @if (booking) {
                        <!-- Booked Slot Card -->
                        <div
                          class="w-full h-full p-2.5 rounded-2xl border text-xs cursor-pointer transition-all flex flex-col justify-between shadow-sm"
                          [ngClass]="getBookingCardClasses(booking)"
                          (click)="openBookingDetails(booking)"
                        >
                          <div class="flex items-center justify-between gap-1">
                            <span class="font-medium truncate max-w-[130px] text-white text-xs">{{ booking.customer_name }}</span>
                            <span class="font-mono text-[9px] uppercase tracking-wider opacity-75">{{ booking.code }}</span>
                          </div>
                          <div class="flex items-center justify-between text-[11px] mt-1.5 pt-1.5 border-t border-white/[0.08]">
                            <span class="opacity-70 font-mono text-[10px]">{{ booking.customer_phone }}</span>
                            <span class="font-serif italic text-white">{{ formatCents(booking.price_cents) }}</span>
                          </div>
                        </div>
                      } @else {
                        <!-- Empty Cell: Click to Create Booking -->
                        <button
                          type="button"
                          (click)="openSlotBooking(court.id, row.hourStr)"
                          class="w-full h-full rounded-2xl hover:bg-[#132a54]/50 border border-transparent hover:border-[#0056FB]/30 transition-all flex items-center justify-center group"
                          title="Crear reserva en este horario"
                        >
                          <span class="text-[11px] font-mono text-[#556b8e] group-hover:text-[#99beff] transition-colors uppercase tracking-wider">
                            + Libre
                          </span>
                        </button>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      </main>

      <!-- ============================================================= -->
      <!-- MODAL: NUEVA RESERVA MOSTRADOR / TELÉFONO                      -->
      <!-- ============================================================= -->
      @if (showCreateModal()) {
        <div class="fixed inset-0 z-50 bg-[#071328]/70 backdrop-blur-md flex items-center justify-center p-4">
          <div class="w-full max-w-lg p-7 rounded-3xl bg-[#0e2042] border border-white/[0.08] shadow-[0_25px_80px_rgba(0,0,0,0.8)] space-y-6 animate-in fade-in zoom-in-95 font-sans">
            <div class="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div>
                <span class="text-[10px] uppercase tracking-[0.2em] text-[#8fa3c7] font-mono block">Mostrador & Teléfono</span>
                <h3 class="font-serif italic text-2xl text-white">Nueva Reserva Manual</h3>
              </div>
              <button
                type="button"
                (click)="showCreateModal.set(false)"
                class="w-8 h-8 rounded-full border border-white/[0.1] flex items-center justify-center text-[#8fa3c7] hover:text-white hover:border-white/30 transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            <form (ngSubmit)="submitManualBooking()" class="space-y-4">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-[#8fa3c7] mb-1.5">Pista</label>
                  <select
                    [(ngModel)]="modalCourtId"
                    name="modalCourtId"
                    class="w-full px-4 py-3 rounded-xl bg-[#071328]/80 border border-white/[0.1] text-white text-sm focus:outline-none focus:border-[#0056FB] transition-colors"
                  >
                    @for (c of courts(); track c.id) {
                      <option [value]="c.id" class="bg-[#0e2042] text-white">{{ c.name }}</option>
                    }
                  </select>
                </div>

                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-[#8fa3c7] mb-1.5">Hora Inicio</label>
                  <input
                    type="time"
                    [(ngModel)]="modalTime"
                    name="modalTime"
                    class="w-full px-4 py-3 rounded-xl bg-[#071328]/80 border border-white/[0.1] text-white text-sm font-mono focus:outline-none focus:border-[#0056FB] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-mono uppercase tracking-wider text-[#8fa3c7] mb-1.5">Nombre del Titular *</label>
                <input
                  type="text"
                  required
                  [(ngModel)]="modalCustomerName"
                  name="modalCustomerName"
                  placeholder="Ej: Daniel Gómez"
                  class="w-full px-4 py-3 rounded-xl bg-[#071328]/80 border border-white/[0.1] text-white placeholder-[#556b8e] text-sm focus:outline-none focus:border-[#0056FB] transition-colors"
                />
              </div>

              <div>
                <label class="block text-[11px] font-mono uppercase tracking-wider text-[#8fa3c7] mb-1.5">Teléfono / WhatsApp *</label>
                <input
                  type="tel"
                  required
                  [(ngModel)]="modalCustomerPhone"
                  name="modalCustomerPhone"
                  placeholder="Ej: +57 311 000 1122"
                  class="w-full px-4 py-3 rounded-xl bg-[#071328]/80 border border-white/[0.1] text-white placeholder-[#556b8e] text-sm font-mono focus:outline-none focus:border-[#0056FB] transition-colors"
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-[#8fa3c7] mb-1.5">Tarifa (COP)</label>
                  <input
                    type="number"
                    step="5000"
                    [(ngModel)]="modalPriceCents"
                    name="modalPriceCents"
                    class="w-full px-4 py-3 rounded-xl bg-[#071328]/80 border border-white/[0.1] text-white text-sm font-mono focus:outline-none focus:border-[#0056FB] transition-colors"
                  />
                </div>

                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-[#8fa3c7] mb-1.5">Estado Pago</label>
                  <select
                    [(ngModel)]="modalPaymentStatus"
                    name="modalPaymentStatus"
                    class="w-full px-4 py-3 rounded-xl bg-[#071328]/80 border border-white/[0.1] text-white text-sm focus:outline-none focus:border-[#0056FB] transition-colors"
                  >
                    <option value="paid" class="bg-[#0e2042]">Pagado en Sitio</option>
                    <option value="pending_on_site" class="bg-[#0e2042]">Pendiente por Pagar</option>
                  </select>
                </div>
              </div>

              <div class="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  (click)="showCreateModal.set(false)"
                  class="px-5 py-3 rounded-xl border border-white/[0.1] text-[#8fa3c7] text-xs font-mono uppercase tracking-wider hover:bg-[#132a54] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  [disabled]="isSubmitting() || !modalCustomerName || !modalCustomerPhone"
                  class="flex-1 py-3 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] disabled:opacity-40 text-white font-medium text-xs font-mono uppercase tracking-wider transition-all duration-300 shadow-[0_0_25px_rgba(0,86,251,0.4)]"
                >
                  {{ isSubmitting() ? 'Guardando...' : 'Confirmar Reserva' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- ============================================================= -->
      <!-- MODAL: DETALLES DE RESERVA Y ACCIONES RÁPIDAS                 -->
      <!-- ============================================================= -->
      @if (selectedBooking()) {
        <div class="fixed inset-0 z-50 bg-[#071328]/70 backdrop-blur-md flex items-center justify-center p-4">
          <div class="w-full max-w-md p-7 rounded-3xl bg-[#0e2042] border border-white/[0.08] shadow-[0_25px_80px_rgba(0,0,0,0.8)] space-y-6 animate-in fade-in zoom-in-95 font-sans">
            <div class="flex items-start justify-between pb-4 border-b border-white/[0.08]">
              <div>
                <span class="text-[10px] font-mono text-[#8fa3c7] tracking-[0.2em] uppercase block mb-1">CÓDIGO: {{ selectedBooking()?.code }}</span>
                <h3 class="font-serif italic text-2xl text-white">{{ selectedBooking()?.customer_name }}</h3>
              </div>
              <button
                type="button"
                (click)="selectedBooking.set(null)"
                class="w-8 h-8 rounded-full border border-white/[0.1] flex items-center justify-center text-[#8fa3c7] hover:text-white hover:border-white/30 transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            <div class="space-y-3 text-xs">
              <div class="flex justify-between py-1.5 border-b border-white/[0.06]">
                <span class="text-[#556b8e] font-mono uppercase text-[10px] tracking-wider">Cancha</span>
                <span class="font-medium text-[#e2e8f4]">{{ selectedBooking()?.court_name }}</span>
              </div>
              <div class="flex justify-between py-1.5 border-b border-white/[0.06]">
                <span class="text-[#556b8e] font-mono uppercase text-[10px] tracking-wider">Teléfono</span>
                <span class="font-mono text-[#e2e8f4]">{{ selectedBooking()?.customer_phone }}</span>
              </div>
              <div class="flex justify-between py-1.5 border-b border-white/[0.06]">
                <span class="text-[#556b8e] font-mono uppercase text-[10px] tracking-wider">Valor</span>
                <span class="font-serif italic text-white text-base">{{ formatCents(selectedBooking()?.price_cents) }}</span>
              </div>
              <div class="flex justify-between py-1.5 border-b border-white/[0.06]">
                <span class="text-[#556b8e] font-mono uppercase text-[10px] tracking-wider">Estado Pago</span>
                <span class="font-mono text-[#99beff] uppercase px-2 py-0.5 rounded bg-[#0056FB]/20 border border-[#0056FB]/40 text-[10px]">{{ selectedBooking()?.payment_status }}</span>
              </div>
            </div>

            <!-- Quick Action Buttons -->
            <div class="space-y-2 pt-2">
              <button
                type="button"
                (click)="updateStatus('completed')"
                class="w-full py-3 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] text-white font-mono uppercase tracking-wider text-xs transition-colors shadow-[0_0_20px_rgba(0,86,251,0.35)]"
              >
                ✓ Marcar como Completada
              </button>
              <button
                type="button"
                (click)="updateStatus('no_show')"
                class="w-full py-3 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-amber-300 font-mono uppercase tracking-wider text-xs transition-colors shadow-sm"
              >
                ⚠ Marcar No-Show
              </button>
              <button
                type="button"
                (click)="updateStatus('cancelled')"
                class="w-full py-3 rounded-xl border border-rose-500/30 hover:bg-rose-950/40 text-rose-400 font-mono uppercase tracking-wider text-xs transition-colors"
              >
                ✕ Cancelar Reserva
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class ClubDashboardComponent implements OnInit, OnDestroy {
  readonly authStore = inject(AuthStore);
  private readonly adminService = inject(ClubAdminService);
  private readonly router = inject(Router);

  private sseConnection: EventSource | null = null;

  // Selected date signal (format "YYYY-MM-DD")
  readonly currentDate = signal<string>(new Date().toISOString().split('T')[0]);

  // Data signals
  readonly courts = signal<AdminCourt[]>([]);
  readonly bookings = signal<AdminBooking[]>([]);
  readonly selectedBooking = signal<AdminBooking | null>(null);

  // Modal signals
  readonly showCreateModal = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);

  // Modal form bindings
  modalCourtId = '';
  modalTime = '14:00';
  modalCustomerName = '';
  modalCustomerPhone = '';
  modalPriceCents = 8000000; // 80.000 COP
  modalPaymentStatus = 'paid';

  // Fixed rows from 07:00 to 22:00
  readonly timelineRows: TimelineRow[] = Array.from({ length: 16 }, (_, i) => {
    const h = i + 7;
    return {
      hourStr: `${h.toString().padStart(2, '0')}:00`,
      hourNum: h
    };
  });

  // Dynamic CSS grid columns: 1 time column + 1 column per court
  readonly gridColumnsStyle = computed(() => {
    const cCount = Math.max(1, this.courts().length);
    return `90px repeat(${cCount}, minmax(180px, 1fr))`;
  });

  readonly formattedDateDisplay = computed(() => {
    const d = new Date(this.currentDate() + 'T12:00:00');
    return d.toLocaleDateString('es-CO', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  });

  readonly activeBookingsCount = computed(() => {
    return this.bookings().filter(
      (b) => b.status === 'confirmed' || b.status === 'completed' || b.status === 'held'
    ).length;
  });

  readonly totalRevenueCents = computed(() => {
    return this.bookings()
      .filter((b) => b.status === 'confirmed' || b.status === 'completed')
      .reduce((sum, b) => sum + b.price_cents, 0);
  });

  readonly occupancyPct = computed(() => {
    const totalSlots = this.courts().length * this.timelineRows.length;
    if (totalSlots === 0) return 0;
    const booked = this.activeBookingsCount();
    return Math.min(100, Math.round((booked / totalSlots) * 100));
  });

  ngOnInit(): void {
    const clubId = this.getActiveClubId();
    if (clubId) {
      this.loadCourts(clubId);
      this.loadBookings(clubId);
      this.initSse(clubId);
    }
  }

  ngOnDestroy(): void {
    if (this.sseConnection) {
      this.sseConnection.close();
    }
  }

  private getActiveClubId(): string | null {
    const active = this.authStore.activeClubId();
    if (active) return active;
    const memberships = this.authStore.memberships();
    if (memberships.length > 0) {
      this.authStore.setActiveClub(memberships[0].club_id);
      return memberships[0].club_id;
    }
    return null;
  }

  loadCourts(clubId: string): void {
    this.adminService.getCourts(clubId).subscribe({
      next: (courts) => {
        this.courts.set(courts.filter((c) => c.is_active));
        if (courts.length > 0 && !this.modalCourtId) {
          this.modalCourtId = courts[0].id;
        }
      },
      error: () => console.error('Error loading courts')
    });
  }

  loadBookings(clubId: string): void {
    const date = this.currentDate();
    this.adminService.getBookings(clubId, date, date).subscribe({
      next: (bookings) => this.bookings.set(bookings),
      error: () => console.error('Error loading bookings')
    });
  }

  initSse(clubId: string): void {
    try {
      this.sseConnection = this.adminService.connectSse(clubId);
      this.sseConnection.onmessage = () => {
        // SSE trigger: auto-refresh bookings
        this.loadBookings(clubId);
      };
    } catch (e) {
      console.warn('SSE not supported or failed to connect', e);
    }
  }

  getBookingForCell(courtId: string, hourNum: number): AdminBooking | undefined {
    return this.bookings().find((b) => {
      if (b.court_id !== courtId) return false;
      const start = new Date(b.period_start);
      return start.getHours() === hourNum;
    });
  }

  navigateDay(offset: number): void {
    const curr = new Date(this.currentDate() + 'T12:00:00');
    curr.setDate(curr.getDate() + offset);
    const dateStr = curr.toISOString().split('T')[0];
    this.currentDate.set(dateStr);
    const clubId = this.getActiveClubId();
    if (clubId) this.loadBookings(clubId);
  }

  goToToday(): void {
    this.currentDate.set(new Date().toISOString().split('T')[0]);
    const clubId = this.getActiveClubId();
    if (clubId) this.loadBookings(clubId);
  }

  openNewBookingModal(): void {
    this.modalTime = '14:00';
    this.modalCustomerName = '';
    this.modalCustomerPhone = '';
    this.showCreateModal.set(true);
  }

  openSlotBooking(courtId: string, hourStr: string): void {
    this.modalCourtId = courtId;
    this.modalTime = hourStr;
    this.modalCustomerName = '';
    this.modalCustomerPhone = '';
    this.showCreateModal.set(true);
  }

  openBookingDetails(b: AdminBooking): void {
    this.selectedBooking.set(b);
  }

  submitManualBooking(): void {
    const clubId = this.getActiveClubId();
    if (!clubId) return;

    this.isSubmitting.set(true);
    const periodStart = `${this.currentDate()}T${this.modalTime}:00Z`;

    this.adminService
      .createBooking(clubId, {
        court_id: this.modalCourtId,
        period_start: periodStart,
        duration_minutes: 60,
        customer_name: this.modalCustomerName.trim(),
        customer_phone: this.modalCustomerPhone.trim(),
        price_cents: Number(this.modalPriceCents) || 8000000,
        payment_status: this.modalPaymentStatus
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.showCreateModal.set(false);
          this.loadBookings(clubId);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          alert(err.error?.detail || 'Error al crear la reserva manual');
        }
      });
  }

  updateStatus(newStatus: 'cancelled' | 'no_show' | 'completed' | 'confirmed'): void {
    const b = this.selectedBooking();
    const clubId = this.getActiveClubId();
    if (!b || !clubId) return;

    this.adminService.updateBookingStatus(clubId, b.id, newStatus).subscribe({
      next: () => {
        this.selectedBooking.set(null);
        this.loadBookings(clubId);
      },
      error: (err) => {
        alert(err.error?.detail || 'Error al actualizar el estado de la reserva');
      }
    });
  }

  logout(): void {
    this.authStore.clearSession();
    this.router.navigate(['/auth/login']);
  }

  formatCents(cents?: number): string {
    if (!cents) return '$0 COP';
    return '$' + (cents / 100).toLocaleString('es-CO') + ' COP';
  }

  getBookingCardClasses(b: AdminBooking): string {
    if (b.status === 'confirmed') {
      return 'bg-[#0d2247] border-[#0056FB]/60 text-white hover:border-[#0056FB] shadow-[0_0_15px_rgba(0,86,251,0.2)]';
    }
    if (b.status === 'held') {
      return 'bg-[#2b1e0f] border-amber-500/50 text-amber-200 hover:border-amber-400';
    }
    return 'bg-[#071328] border-white/[0.08] text-[#8fa3c7]';
  }
}
