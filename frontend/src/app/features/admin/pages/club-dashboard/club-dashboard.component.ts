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
    <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      <!-- Top Navbar -->
      <header class="border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-30">
        <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-slate-950 shadow-md">
              C
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h1 class="font-display font-bold text-white text-base sm:text-lg">Panel de Administración</h1>
                <span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  SSE En Vivo
                </span>
              </div>
              <p class="text-xs text-slate-400">Recepción & Gestión de Canchas</p>
            </div>
          </div>

          <!-- User controls & Date navigation -->
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700 text-xs font-semibold">
              <button
                type="button"
                (click)="navigateDay(-1)"
                class="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
                title="Día anterior"
              >
                ◀
              </button>
              <button
                type="button"
                (click)="goToToday()"
                class="px-2.5 py-1 hover:bg-slate-700 rounded-lg text-slate-200 hover:text-white transition-colors"
              >
                {{ formattedDateDisplay() }}
              </button>
              <button
                type="button"
                (click)="navigateDay(1)"
                class="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
                title="Día siguiente"
              >
                ▶
              </button>
            </div>

            <!-- User Menu -->
            <div class="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div class="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-emerald-400">
                {{ authStore.userInitials() }}
              </div>
              <button
                type="button"
                (click)="logout()"
                class="text-xs text-slate-400 hover:text-rose-400 transition-colors hidden sm:inline"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main class="max-w-7xl mx-auto px-4 py-6 w-full flex-1 space-y-6">
        <!-- KPI Strip -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg flex items-center justify-between">
            <div>
              <span class="text-xs text-slate-400 uppercase font-semibold">Ocupación Hoy</span>
              <div class="text-2xl font-display font-extrabold text-white mt-1">
                {{ occupancyPct() }}%
              </div>
            </div>
            <div class="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xl">
              %
            </div>
          </div>

          <div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg flex items-center justify-between">
            <div>
              <span class="text-xs text-slate-400 uppercase font-semibold">Ingresos del Día</span>
              <div class="text-2xl font-display font-extrabold text-emerald-400 mt-1">
                {{ formatCents(totalRevenueCents()) }}
              </div>
            </div>
            <div class="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 font-bold text-lg">
              $
            </div>
          </div>

          <div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg flex items-center justify-between">
            <div>
              <span class="text-xs text-slate-400 uppercase font-semibold">Reservas Activas</span>
              <div class="text-2xl font-display font-extrabold text-white mt-1">
                {{ activeBookingsCount() }}
              </div>
            </div>
            <div class="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-lg">
              🎾
            </div>
          </div>
        </div>

        <!-- Timeline Grid Calendar -->
        <div class="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl overflow-hidden">
          <div class="p-4 border-b border-slate-800 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <h2 class="font-bold text-sm sm:text-base text-white">Rejilla de Reservas (Mostrador & Online)</h2>
              <span class="text-xs text-slate-500 hidden sm:inline">• Haz clic en cualquier espacio vacío para crear una reserva rápida</span>
            </div>
            <button
              type="button"
              (click)="openNewBookingModal()"
              class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md flex items-center gap-1.5"
            >
              <span>+ Nueva Reserva</span>
            </button>
          </div>

          <!-- Multi-court timeline table -->
          <div class="overflow-x-auto">
            <div class="min-w-[700px]">
              <!-- Header Row (Courts) -->
              <div class="grid border-b border-slate-800 bg-slate-950/70 text-xs font-bold text-slate-300"
                   [style.grid-template-columns]="gridColumnsStyle()">
                <div class="p-3 text-center border-r border-slate-800 text-slate-500 font-mono">
                  HORA
                </div>
                @for (court of courts(); track court.id) {
                  <div class="p-3 text-center border-r border-slate-800 last:border-r-0 flex items-center justify-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>{{ court.name }}</span>
                    <span class="text-slate-500 font-normal text-[10px] uppercase">({{ court.sport }})</span>
                  </div>
                }
              </div>

              <!-- Hour Rows -->
              @for (row of timelineRows; track row.hourStr) {
                <div class="grid border-b border-slate-800/60 hover:bg-slate-800/20 transition-colors"
                     [style.grid-template-columns]="gridColumnsStyle()">
                  <!-- Time Label -->
                  <div class="p-3 border-r border-slate-800 text-xs font-mono font-semibold text-slate-400 flex items-center justify-center bg-slate-950/40">
                    {{ row.hourStr }}
                  </div>

                  <!-- Cells per Court -->
                  @for (court of courts(); track court.id) {
                    @let booking = getBookingForCell(court.id, row.hourNum);
                    <div
                      class="p-1.5 border-r border-slate-800/60 last:border-r-0 min-h-[64px] flex items-center justify-center transition-colors relative"
                    >
                      @if (booking) {
                        <!-- Booked Slot Card -->
                        <div
                          class="w-full h-full p-2 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between"
                          [ngClass]="getBookingCardClasses(booking)"
                          (click)="openBookingDetails(booking)"
                        >
                          <div class="flex items-center justify-between">
                            <span class="font-bold truncate max-w-[120px]">{{ booking.customer_name }}</span>
                            <span class="font-mono text-[10px] uppercase opacity-80">{{ booking.code }}</span>
                          </div>
                          <div class="flex items-center justify-between text-[11px] mt-1 pt-1 border-t border-slate-700/40">
                            <span class="opacity-80">{{ booking.customer_phone }}</span>
                            <span class="font-semibold">{{ formatCents(booking.price_cents) }}</span>
                          </div>
                        </div>
                      } @else {
                        <!-- Empty Cell: Click to Create Booking -->
                        <button
                          type="button"
                          (click)="openSlotBooking(court.id, row.hourStr)"
                          class="w-full h-full rounded-xl hover:bg-emerald-950/20 hover:border-emerald-500/40 border border-transparent transition-all flex items-center justify-center group"
                          title="Crear reserva en este horario"
                        >
                          <span class="text-xs text-slate-600 group-hover:text-emerald-400 font-semibold group-hover:scale-110 transition-transform">
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
        <div class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-lg p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 class="font-bold text-base text-white">Nueva Reserva Mostrador</h3>
              <button
                type="button"
                (click)="showCreateModal.set(false)"
                class="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form (ngSubmit)="submitManualBooking()" class="space-y-4">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-slate-300 mb-1">Cancha</label>
                  <select
                    [(ngModel)]="modalCourtId"
                    name="modalCourtId"
                    class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    @for (c of courts(); track c.id) {
                      <option [value]="c.id">{{ c.name }}</option>
                    }
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-300 mb-1">Hora Inicio</label>
                  <input
                    type="time"
                    [(ngModel)]="modalTime"
                    name="modalTime"
                    class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">Nombre del Cliente *</label>
                <input
                  type="text"
                  required
                  [(ngModel)]="modalCustomerName"
                  name="modalCustomerName"
                  placeholder="Ej: Daniel Gómez"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">Teléfono / WhatsApp *</label>
                <input
                  type="tel"
                  required
                  [(ngModel)]="modalCustomerPhone"
                  name="modalCustomerPhone"
                  placeholder="Ej: +57 311 000 1122"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-slate-300 mb-1">Tarifa (COP)</label>
                  <input
                    type="number"
                    step="5000"
                    [(ngModel)]="modalPriceCents"
                    name="modalPriceCents"
                    class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-300 mb-1">Estado de Pago</label>
                  <select
                    [(ngModel)]="modalPaymentStatus"
                    name="modalPaymentStatus"
                    class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500"
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
                  class="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  [disabled]="isSubmitting() || !modalCustomerName || !modalCustomerPhone"
                  class="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm shadow-md"
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
        <div class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div class="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <span class="text-xs font-mono text-emerald-400 font-bold">{{ selectedBooking()?.code }}</span>
                <h3 class="font-bold text-lg text-white">{{ selectedBooking()?.customer_name }}</h3>
              </div>
              <button
                type="button"
                (click)="selectedBooking.set(null)"
                class="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div class="space-y-2 text-xs">
              <div class="flex justify-between py-1 border-b border-slate-800">
                <span class="text-slate-400">Cancha:</span>
                <span class="font-bold text-white">{{ selectedBooking()?.court_name }}</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-800">
                <span class="text-slate-400">Teléfono:</span>
                <span class="font-bold text-white">{{ selectedBooking()?.customer_phone }}</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-800">
                <span class="text-slate-400">Valor:</span>
                <span class="font-bold text-emerald-400 font-display">{{ formatCents(selectedBooking()?.price_cents) }}</span>
              </div>
              <div class="flex justify-between py-1 border-b border-slate-800">
                <span class="text-slate-400">Estado Pago:</span>
                <span class="font-semibold text-amber-300 uppercase">{{ selectedBooking()?.payment_status }}</span>
              </div>
            </div>

            <!-- Quick Action Buttons -->
            <div class="space-y-2 pt-2">
              <button
                type="button"
                (click)="updateStatus('completed')"
                class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors"
              >
                ✓ Marcar como Completada
              </button>
              <button
                type="button"
                (click)="updateStatus('no_show')"
                class="w-full py-2.5 rounded-xl bg-amber-600/80 hover:bg-amber-600 text-white font-bold text-xs shadow-md transition-colors"
              >
                ⚠ Marcar No-Show (No Asistió)
              </button>
              <button
                type="button"
                (click)="updateStatus('cancelled')"
                class="w-full py-2.5 rounded-xl border border-rose-800 text-rose-400 hover:bg-rose-950/40 font-bold text-xs transition-colors"
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
      return 'bg-emerald-950/50 border-emerald-600/50 text-emerald-200';
    }
    if (b.status === 'held') {
      return 'bg-amber-950/50 border-amber-600/50 text-amber-200';
    }
    return 'bg-rose-950/40 border-rose-800/40 text-rose-300';
  }
}
