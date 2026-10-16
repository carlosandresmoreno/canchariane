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
import { Router, RouterLink } from '@angular/router';

import { AuthStore } from '../../../../core/state/auth.store';
import { AdminBooking, AdminCourt, ClubAdminService } from '../../services/club-admin.service';

interface TimelineRow {
  hourStr: string; // "07:00"
  hourNum: number;
}

@Component({
  selector: 'app-club-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-white text-slate-900 flex flex-col selection:bg-[#0056FB] selection:text-white relative overflow-hidden font-sans">
      <!-- Clean Luminous Ambient Glow -->
      <div class="ambient-lighting"></div>

      <!-- Top Architectural Navbar -->
      <header class="border-b border-slate-200/80 bg-white/90 backdrop-blur-xl sticky top-0 z-30">
        <div class="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center font-serif italic text-sm text-[#0056FB] shadow-xs">
              C
            </div>
            <div>
              <div class="flex items-center gap-2.5">
                <h1 class="font-display font-semibold text-slate-900 text-sm sm:text-base tracking-wide">Panel de Operaciones</h1>
                <span class="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0056FB] border border-blue-200 text-[10px] font-mono tracking-wider uppercase flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-[#0056FB] animate-pulse"></span>
                  SSE Sincronizado
                </span>
              </div>
              <p class="text-[11px] text-slate-500 font-mono tracking-wider uppercase">Recepción & Gestión de Pistas</p>
            </div>
          </div>

          <!-- User controls & Date navigation -->
          <div class="flex items-center gap-4">
            @if (authStore.isSuperadmin()) {
              <a
                routerLink="/superadmin"
                class="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#0056FB] hover:text-[#0048d6] font-mono text-xs uppercase tracking-wider transition-colors shadow-xs flex items-center gap-1.5 font-medium"
              >
                <span>👑 Superadmin</span>
              </a>
            }

            <div class="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs font-mono shadow-xs">
              <button
                type="button"
                (click)="navigateDay(-1)"
                class="p-2 hover:bg-slate-200/80 rounded-lg text-slate-600 hover:text-slate-900 transition-colors"
                title="Día anterior"
              >
                ◀
              </button>
              <button
                type="button"
                (click)="goToToday()"
                class="px-3.5 py-1.5 hover:bg-slate-200/80 rounded-lg text-slate-800 hover:text-slate-950 transition-colors tracking-wider uppercase text-[11px] font-medium"
              >
                {{ formattedDateDisplay() }}
              </button>
              <button
                type="button"
                (click)="navigateDay(1)"
                class="p-2 hover:bg-slate-200/80 rounded-lg text-slate-600 hover:text-slate-900 transition-colors"
                title="Día siguiente"
              >
                ▶
              </button>
            </div>

            <!-- User Menu -->
            <div class="flex items-center gap-3 pl-3 border-l border-slate-200">
              <div class="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-mono font-medium text-slate-700 shadow-xs">
                {{ authStore.userInitials() }}
              </div>
              <button
                type="button"
                (click)="logout()"
                class="text-xs uppercase tracking-wider font-mono text-slate-500 hover:text-slate-900 transition-colors hidden sm:inline"
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
          <div class="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-between group hover:border-[#0056FB]/40 transition-all duration-300">
            <div>
              <span class="text-[10px] text-slate-400 uppercase font-mono tracking-[0.2em] block mb-2">Ocupación Hoy</span>
              <div class="text-3xl sm:text-4xl font-serif italic text-slate-900">
                {{ occupancyPct() }}%
              </div>
              <span class="text-[11px] text-slate-500 font-mono mt-1 block">Capacidad de pista reservada</span>
            </div>
            <div class="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-[#0056FB] font-mono text-sm group-hover:scale-105 transition-transform shadow-xs">
              %
            </div>
          </div>

          <div class="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-between group hover:border-[#0056FB]/40 transition-all duration-300">
            <div>
              <span class="text-[10px] text-slate-400 uppercase font-mono tracking-[0.2em] block mb-2">Recaudación Estimada</span>
              <div class="text-3xl sm:text-4xl font-serif italic text-slate-900">
                {{ formatCents(totalRevenueCents()) }}
              </div>
              <span class="text-[11px] text-slate-500 font-mono mt-1 block">Ingresos de la jornada</span>
            </div>
            <div class="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-[#0056FB] font-mono text-sm group-hover:scale-105 transition-transform shadow-xs">
              $
            </div>
          </div>

          <div class="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-between group hover:border-[#0056FB]/40 transition-all duration-300">
            <div>
              <span class="text-[10px] text-slate-400 uppercase font-mono tracking-[0.2em] block mb-2">Turnos Confirmados</span>
              <div class="text-3xl sm:text-4xl font-serif italic text-slate-900">
                {{ activeBookingsCount() }}
              </div>
              <span class="text-[11px] text-slate-500 font-mono mt-1 block">Partidos programados</span>
            </div>
            <div class="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-[#0056FB] font-mono text-sm group-hover:scale-105 transition-transform shadow-xs">
              #
            </div>
          </div>
        </div>

        <!-- Timeline Grid Calendar (Architectural Blueprint) -->
        <div class="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div class="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <h2 class="font-serif italic text-xl sm:text-2xl text-slate-900">Matriz de Ocupación por Cancha</h2>
              <p class="text-xs text-slate-500 font-mono mt-0.5">Haz clic sobre cualquier celda libre para crear una reserva de mostrador</p>
            </div>
            <button
              type="button"
              (click)="openNewBookingModal()"
              class="px-5 py-2.5 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] text-white font-medium text-xs tracking-wider uppercase font-mono transition-all duration-300 shadow-md flex items-center justify-center gap-2 active:scale-95"
            >
              <span>+ Nueva Reserva</span>
            </button>
          </div>

          <!-- Multi-court timeline table -->
          <div class="overflow-x-auto">
            <div class="min-w-[760px]">
              <!-- Header Row (Courts) -->
              <div class="grid border-b border-slate-200 bg-slate-50 text-xs font-mono font-medium text-slate-700"
                   [style.grid-template-columns]="gridColumnsStyle()">
                <div class="p-4 text-center border-r border-slate-200 text-slate-400 text-[10px] tracking-[0.2em] uppercase">
                  HORA
                </div>
                @for (court of courts(); track court.id) {
                  <div class="p-4 text-center border-r border-slate-200 last:border-r-0 flex items-center justify-center gap-2.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-[#0056FB]"></span>
                    <span class="font-sans font-semibold text-slate-900 tracking-wide">{{ court.name }}</span>
                    <span class="text-slate-400 font-normal text-[10px] uppercase font-mono tracking-wider">({{ court.sport }})</span>
                  </div>
                }
              </div>

              <!-- Hour Rows -->
              @for (row of timelineRows; track row.hourStr) {
                <div class="grid border-b border-slate-100 hover:bg-slate-50/60 transition-colors"
                     [style.grid-template-columns]="gridColumnsStyle()">
                  <!-- Time Label -->
                  <div class="p-3 border-r border-slate-200 text-xs font-mono text-slate-500 flex items-center justify-center bg-slate-50/40">
                    {{ row.hourStr }}
                  </div>

                  <!-- Cells per Court -->
                  @for (court of courts(); track court.id) {
                    @let booking = getBookingForCell(court.id, row.hourNum);
                    <div
                      class="p-1.5 border-r border-slate-100 last:border-r-0 min-h-[72px] flex items-center justify-center transition-colors relative"
                    >
                      @if (booking) {
                        <!-- Booked Slot Card -->
                        <div
                          class="w-full h-full p-2.5 rounded-2xl border text-xs cursor-pointer transition-all flex flex-col justify-between shadow-xs"
                          [ngClass]="getBookingCardClasses(booking)"
                          (click)="openBookingDetails(booking)"
                        >
                          <div class="flex items-center justify-between gap-1">
                            <span class="font-medium truncate max-w-[130px] text-slate-900 text-xs">{{ booking.customer_name }}</span>
                            <span class="font-mono text-[9px] uppercase tracking-wider text-slate-500">{{ booking.code }}</span>
                          </div>
                          <div class="flex items-center justify-between text-[11px] mt-1.5 pt-1.5 border-t border-slate-200/60">
                            <span class="text-slate-500 font-mono text-[10px]">{{ booking.customer_phone }}</span>
                            <span class="font-serif italic text-[#0056FB] font-semibold">{{ formatCents(booking.price_cents) }}</span>
                          </div>
                        </div>
                      } @else {
                        <!-- Empty Cell: Click to Create Booking -->
                        <button
                          type="button"
                          (click)="openSlotBooking(court.id, row.hourStr)"
                          class="w-full h-full rounded-2xl hover:bg-blue-50/50 border border-transparent hover:border-[#0056FB]/20 transition-all flex items-center justify-center group"
                          title="Crear reserva en este horario"
                        >
                          <span class="text-[11px] font-mono text-slate-400 group-hover:text-[#0056FB] transition-colors uppercase tracking-wider">
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
        <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-lg p-7 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 font-sans text-slate-900">
            <div class="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span class="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono block">Mostrador & Teléfono</span>
                <h3 class="font-serif italic text-2xl text-slate-900">Nueva Reserva Manual</h3>
              </div>
              <button
                type="button"
                (click)="showCreateModal.set(false)"
                class="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:border-slate-400 transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            <form (ngSubmit)="submitManualBooking()" class="space-y-4">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Pista</label>
                  <select
                    [(ngModel)]="modalCourtId"
                    name="modalCourtId"
                    class="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  >
                    @for (c of courts(); track c.id) {
                      <option [value]="c.id">{{ c.name }}</option>
                    }
                  </select>
                </div>

                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Hora Inicio</label>
                  <input
                    type="time"
                    [(ngModel)]="modalTime"
                    name="modalTime"
                    class="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Nombre del Titular *</label>
                <input
                  type="text"
                  required
                  [(ngModel)]="modalCustomerName"
                  name="modalCustomerName"
                  placeholder="Ej: Daniel Gómez"
                  class="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                />
              </div>

              <div>
                <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Teléfono / WhatsApp *</label>
                <input
                  type="tel"
                  required
                  [(ngModel)]="modalCustomerPhone"
                  name="modalCustomerPhone"
                  placeholder="Ej: +57 311 000 1122"
                  class="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Tarifa (COP)</label>
                  <input
                    type="number"
                    step="5000"
                    [(ngModel)]="modalPriceCents"
                    name="modalPriceCents"
                    class="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  />
                </div>

                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Estado Pago</label>
                  <select
                    [(ngModel)]="modalPaymentStatus"
                    name="modalPaymentStatus"
                    class="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  >
                    <option value="paid">Pagado en Sitio</option>
                    <option value="pending_on_site">Pendiente por Pagar</option>
                  </select>
                </div>
              </div>

              <div class="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  (click)="showCreateModal.set(false)"
                  class="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-mono uppercase tracking-wider hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  [disabled]="isSubmitting() || !modalCustomerName || !modalCustomerPhone"
                  class="flex-1 py-3 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] disabled:opacity-40 text-white font-medium text-xs font-mono uppercase tracking-wider transition-all duration-300 shadow-md"
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
        <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-md p-7 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 font-sans text-slate-900">
            <div class="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <span class="text-[10px] font-mono text-slate-500 tracking-[0.2em] uppercase block mb-1">CÓDIGO: {{ selectedBooking()?.code }}</span>
                <h3 class="font-serif italic text-2xl text-slate-900">{{ selectedBooking()?.customer_name }}</h3>
              </div>
              <button
                type="button"
                (click)="selectedBooking.set(null)"
                class="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:border-slate-400 transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            <div class="space-y-3 text-xs">
              <div class="flex justify-between py-1.5 border-b border-slate-100">
                <span class="text-slate-500 font-mono uppercase text-[10px] tracking-wider">Cancha</span>
                <span class="font-medium text-slate-900">{{ selectedBooking()?.court_name }}</span>
              </div>
              <div class="flex justify-between py-1.5 border-b border-slate-100">
                <span class="text-slate-500 font-mono uppercase text-[10px] tracking-wider">Teléfono</span>
                <span class="font-mono text-slate-900">{{ selectedBooking()?.customer_phone }}</span>
              </div>
              <div class="flex justify-between py-1.5 border-b border-slate-100">
                <span class="text-slate-500 font-mono uppercase text-[10px] tracking-wider">Valor</span>
                <span class="font-serif italic text-slate-900 text-base font-semibold">{{ formatCents(selectedBooking()?.price_cents) }}</span>
              </div>
              <div class="flex justify-between py-1.5 border-b border-slate-100">
                <span class="text-slate-500 font-mono uppercase text-[10px] tracking-wider">Estado Pago</span>
                <span class="font-mono text-[#0056FB] uppercase px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-[10px]">{{ selectedBooking()?.payment_status }}</span>
              </div>
            </div>

            <!-- Quick Action Buttons -->
            <div class="space-y-2 pt-2">
              <button
                type="button"
                (click)="updateStatus('completed')"
                class="w-full py-3 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] text-white font-mono uppercase tracking-wider text-xs transition-colors shadow-md"
              >
                ✓ Marcar como Completada
              </button>
              <button
                type="button"
                (click)="updateStatus('no_show')"
                class="w-full py-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-mono uppercase tracking-wider text-xs transition-colors shadow-xs"
              >
                ⚠ Marcar No-Show
              </button>
              <button
                type="button"
                (click)="updateStatus('cancelled')"
                class="w-full py-3 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 font-mono uppercase tracking-wider text-xs transition-colors"
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
      return 'bg-blue-50/80 border-[#0056FB]/40 text-slate-900 hover:border-[#0056FB] shadow-xs';
    }
    if (b.status === 'held') {
      return 'bg-amber-50 border-amber-200 text-amber-900 hover:border-amber-400';
    }
    return 'bg-slate-50 border-slate-200 text-slate-500';
  }
}
