import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { PublicBookingService } from '../../services/public-booking.service';
import { CourtMapComponent } from '../../components/court-map/court-map.component';
import { CountdownTimerComponent } from '../../components/countdown-timer/countdown-timer.component';
import {
  CreateHoldResponse,
  PublicBookingResponse,
  PublicClub,
  PublicClubLayout,
  PublicSlot
} from '../../models/public.models';

interface DayOption {
  dateStr: string; // "2026-10-20"
  label: string;   // "Hoy", "Mañana", "Mié 22"
  fullLabel: string;
}

@Component({
  selector: 'app-public-booking-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CourtMapComponent, CountdownTimerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      <!-- Top Navbar -->
      <header class="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-40">
        <div class="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center font-extrabold text-white text-lg shadow-lg shadow-emerald-900/30">
              C
            </div>
            <div>
              <h1 class="font-display font-bold text-base sm:text-lg leading-tight text-white tracking-tight">
                {{ club()?.name || 'Cargando club...' }}
              </h1>
              <p class="text-xs text-slate-400 flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                <span>{{ club()?.address || 'Pádel & Deporte' }}</span>
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <a
              routerLink="/lookup"
              class="text-xs sm:text-sm font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700/80 hover:bg-slate-800 transition-colors"
            >
              Consultar Reserva
            </a>
          </div>
        </div>
      </header>

      <!-- Main Step Container -->
      <main class="max-w-5xl mx-auto px-4 py-6 w-full flex-1">
        <!-- Wizard Step Indicator -->
        <nav aria-label="Progreso de la reserva" class="mb-8">
          <ol class="flex items-center justify-center gap-2 sm:gap-4 max-w-md mx-auto">
            <li class="flex items-center gap-2" [class.text-emerald-400]="currentStep() >= 1" [class.text-slate-500]="currentStep() < 1">
              <span class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors"
                    [class.border-emerald-500]="currentStep() >= 1"
                    [class.bg-emerald-500]="currentStep() >= 1"
                    [class.text-slate-950]="currentStep() >= 1"
                    [class.border-slate-700]="currentStep() < 1">1</span>
              <span class="text-xs sm:text-sm font-semibold">Cancha & Hora</span>
            </li>
            <div class="w-8 h-[2px]" [class.bg-emerald-500]="currentStep() >= 2" [class.bg-slate-800]="currentStep() < 2"></div>
            <li class="flex items-center gap-2" [class.text-emerald-400]="currentStep() >= 2" [class.text-slate-500]="currentStep() < 2">
              <span class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors"
                    [class.border-emerald-500]="currentStep() >= 2"
                    [class.bg-emerald-500]="currentStep() >= 2"
                    [class.text-slate-950]="currentStep() >= 2"
                    [class.border-slate-700]="currentStep() < 2">2</span>
              <span class="text-xs sm:text-sm font-semibold">Tus Datos</span>
            </li>
            <div class="w-8 h-[2px]" [class.bg-emerald-500]="currentStep() >= 3" [class.bg-slate-800]="currentStep() < 3"></div>
            <li class="flex items-center gap-2" [class.text-emerald-400]="currentStep() >= 3" [class.text-slate-500]="currentStep() < 3">
              <span class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors"
                    [class.border-emerald-500]="currentStep() >= 3"
                    [class.bg-emerald-500]="currentStep() >= 3"
                    [class.text-slate-950]="currentStep() >= 3"
                    [class.border-slate-700]="currentStep() < 3">3</span>
              <span class="text-xs sm:text-sm font-semibold">Confirmación</span>
            </li>
          </ol>
        </nav>

        <!-- ============================================================= -->
        <!-- PASO 1: SELECCIÓN DE FECHA, HORA Y CANCHA                     -->
        <!-- ============================================================= -->
        @if (currentStep() === 1) {
          <div class="space-y-6">
            <!-- Date Carousel Selector -->
            <div>
              <label class="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
                1. Selecciona el Día
              </label>
              <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                @for (day of availableDays(); track day.dateStr) {
                  <button
                    type="button"
                    (click)="selectDate(day.dateStr)"
                    class="px-4 py-2.5 rounded-xl border text-left shrink-0 transition-all font-medium"
                    [ngClass]="selectedDate() === day.dateStr ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-950' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'"
                  >
                    <div class="text-xs opacity-80">{{ day.label }}</div>
                    <div class="text-sm font-bold">{{ day.fullLabel }}</div>
                  </button>
                }
              </div>
            </div>

            <!-- Hour Selector -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="block text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  2. Selecciona la Hora
                </label>
                <div class="text-xs text-slate-400">
                  {{ distinctHours().length }} horarios disponibles
                </div>
              </div>

              @if (distinctHours().length === 0 && !isLoadingSlots()) {
                <div class="p-6 rounded-xl bg-slate-900 border border-slate-800 text-center text-slate-400">
                  No hay horarios disponibles para esta fecha. Prueba seleccionando otro día.
                </div>
              } @else {
                <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                  @for (hour of distinctHours(); track hour) {
                    <button
                      type="button"
                      (click)="selectHour(hour)"
                      class="px-4 py-2 rounded-xl border font-mono text-sm shrink-0 transition-all"
                      [ngClass]="selectedHour() === hour ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-bold' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'"
                    >
                      {{ hour }}
                    </button>
                  }
                </div>
              }
            </div>

            <!-- View Switcher & Court Selector -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <label class="block text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  3. Elige tu Cancha
                </label>
                <div class="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs font-medium">
                  <button
                    type="button"
                    (click)="viewMode.set('map')"
                    class="px-2.5 py-1 rounded-md transition-colors"
                    [class.bg-slate-800]="viewMode() === 'map'"
                    [class.text-white]="viewMode() === 'map'"
                    [class.text-slate-400]="viewMode() !== 'map'"
                  >
                    Mapa Interactivo
                  </button>
                  <button
                    type="button"
                    (click)="viewMode.set('list')"
                    class="px-2.5 py-1 rounded-md transition-colors"
                    [class.bg-slate-800]="viewMode() === 'list'"
                    [class.text-white]="viewMode() === 'list'"
                    [class.text-slate-400]="viewMode() !== 'list'"
                  >
                    Lista
                  </button>
                </div>
              </div>

              @if (viewMode() === 'map') {
                <app-court-map
                  [layout]="layout()"
                  [slots]="slotsForSelectedHour()"
                  [selectedCourtId]="selectedCourtId()"
                  (courtSelect)="onCourtSelected($event)"
                />
              } @else {
                <!-- List View of Courts -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  @for (slot of slotsForSelectedHour(); track slot.court_id) {
                    <div
                      class="p-5 rounded-2xl border transition-all cursor-pointer relative"
                      [ngClass]="getCourtCardClass(slot)"
                      (click)="slot.is_available && onCourtSelected(slot.court_id)"
                    >
                      <div class="flex items-start justify-between mb-3">
                        <div>
                          <h4 class="font-bold text-base text-white">{{ slot.court_name }}</h4>
                          <p class="text-xs text-slate-400 font-mono">{{ slot.local_start_time }} - {{ slot.local_end_time }}</p>
                        </div>
                        @if (slot.is_available) {
                          <span class="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                            Disponible
                          </span>
                        } @else {
                          <span class="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 text-xs font-semibold">
                            Ocupada
                          </span>
                        }
                      </div>

                      <div class="flex items-center justify-between pt-3 border-t border-slate-800/80">
                        <span class="text-xs text-slate-400">Tarifa 60 min</span>
                        <span class="font-display font-bold text-lg text-emerald-400">
                          {{ formatCents(slot.price_cents) }}
                        </span>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Sticky Bottom Action Bar -->
            <div class="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800/90 z-30 shadow-2xl">
              <div class="max-w-5xl mx-auto flex items-center justify-between gap-4">
                <div>
                  @if (selectedSlot()) {
                    <div class="text-xs text-slate-400 font-medium">Seleccionado:</div>
                    <div class="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                      <span>{{ selectedSlot()?.court_name }}</span>
                      <span class="text-emerald-400 font-mono">{{ selectedSlot()?.local_start_time }}</span>
                      <span class="text-slate-500">•</span>
                      <span class="text-emerald-400 font-display">{{ formatCents(selectedSlot()?.price_cents) }}</span>
                    </div>
                  } @else {
                    <div class="text-sm text-slate-400">Selecciona una hora y cancha en el mapa para continuar</div>
                  }
                </div>

                <button
                  type="button"
                  [disabled]="!selectedSlot() || isCreatingHold()"
                  (click)="proceedToHold()"
                  class="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 text-slate-950 font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 shrink-0 min-h-[48px]"
                >
                  @if (isCreatingHold()) {
                    <span class="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                    <span>Apartando...</span>
                  } @else {
                    <span>Continuar</span>
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  }
                </button>
              </div>
            </div>
            <!-- Spacer for bottom bar -->
            <div class="h-20"></div>
          </div>
        }

        <!-- ============================================================= -->
        <!-- PASO 2: FORMULARIO DE INVITADO Y CUENTA REGRESIVA             -->
        <!-- ============================================================= -->
        @if (currentStep() === 2) {
          <div class="max-w-xl mx-auto space-y-6">
            <!-- Hold Active Alert Banner -->
            <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4 shadow-xl">
              <div>
                <h3 class="text-sm font-bold text-white flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Cancha apartada exclusivamente para ti
                </h3>
                <p class="text-xs text-slate-400">Completa tus datos antes de que expire el tiempo.</p>
              </div>
              <app-countdown-timer
                [expiresAt]="holdData()?.expires_at || null"
                (expired)="onHoldExpired()"
              />
            </div>

            <!-- Booking Summary Card -->
            <div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h4 class="text-xs uppercase tracking-wider text-slate-400 font-semibold">Resumen de la Reserva</h4>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span class="text-slate-400 block text-xs">Cancha</span>
                  <span class="font-bold text-white">{{ selectedSlot()?.court_name }}</span>
                </div>
                <div>
                  <span class="text-slate-400 block text-xs">Fecha</span>
                  <span class="font-bold text-white">{{ selectedDate() }}</span>
                </div>
                <div>
                  <span class="text-slate-400 block text-xs">Horario</span>
                  <span class="font-bold text-white font-mono">{{ selectedSlot()?.local_start_time }} - {{ selectedSlot()?.local_end_time }}</span>
                </div>
                <div>
                  <span class="text-slate-400 block text-xs">Total a pagar</span>
                  <span class="font-bold text-emerald-400 font-display text-lg">{{ formatCents(selectedSlot()?.price_cents) }}</span>
                </div>
              </div>
            </div>

            <!-- Guest Form -->
            <form (ngSubmit)="confirmBooking()" class="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h4 class="text-sm font-bold text-white">Datos de Contacto</h4>

              <div>
                <label for="cust-name" class="block text-xs font-semibold text-slate-300 mb-1.5">Nombre Completo *</label>
                <input
                  id="cust-name"
                  type="text"
                  required
                  [(ngModel)]="guestName"
                  name="guestName"
                  placeholder="Ej: Carlos Moreno"
                  class="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                />
              </div>

              <div>
                <label for="cust-phone" class="block text-xs font-semibold text-slate-300 mb-1.5">Teléfono / WhatsApp *</label>
                <input
                  id="cust-phone"
                  type="tel"
                  required
                  [(ngModel)]="guestPhone"
                  name="guestPhone"
                  placeholder="Ej: +57 300 123 4567"
                  class="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                />
              </div>

              <div>
                <label for="cust-email" class="block text-xs font-semibold text-slate-300 mb-1.5">Correo Electrónico *</label>
                <input
                  id="cust-email"
                  type="email"
                  required
                  [(ngModel)]="guestEmail"
                  name="guestEmail"
                  placeholder="carlos@ejemplo.com"
                  class="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                />
              </div>

              @if (bookingError()) {
                <div class="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs">
                  {{ bookingError() }}
                </div>
              }

              <div class="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  (click)="cancelHoldAndBack()"
                  class="px-5 py-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-semibold text-sm transition-colors"
                >
                  Cambiar Cancha
                </button>
                <button
                  type="submit"
                  [disabled]="isConfirming() || !guestName || !guestPhone || !guestEmail"
                  class="flex-1 py-3 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  @if (isConfirming()) {
                    <span class="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                    <span>Confirmando Reserva...</span>
                  } @else {
                    <span>Confirmar Reserva</span>
                  }
                </button>
              </div>
            </form>
          </div>
        }

        <!-- ============================================================= -->
        <!-- PASO 3: CONFIRMACIÓN EXITOSA Y CÓDIGO CAN-XXXXXX               -->
        <!-- ============================================================= -->
        @if (currentStep() === 3 && confirmedBooking()) {
          <div class="max-w-xl mx-auto space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
            <!-- Success Icon -->
            <div class="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-950">
              <svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div>
              <h2 class="text-2xl sm:text-3xl font-display font-extrabold text-white">¡Reserva Confirmada!</h2>
              <p class="text-slate-400 text-sm mt-1">Hemos registrado tu reserva exitosamente en el club.</p>
            </div>

            <!-- Booking Code Display Box -->
            <div class="p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/40 shadow-2xl relative">
              <div class="text-xs uppercase tracking-widest text-emerald-400 font-bold mb-1">Código de Reserva</div>
              <div class="font-mono text-3xl sm:text-4xl font-extrabold text-white tracking-widest select-all my-2">
                {{ confirmedBooking()?.code }}
              </div>
              <p class="text-xs text-slate-400">Presenta este código al llegar a recepción.</p>

              <div class="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 gap-4 text-left text-xs">
                <div>
                  <span class="text-slate-500 block">Cancha</span>
                  <span class="font-bold text-white text-sm">{{ confirmedBooking()?.court_name }}</span>
                </div>
                <div>
                  <span class="text-slate-500 block">Titular</span>
                  <span class="font-bold text-white text-sm">{{ confirmedBooking()?.customer_name }}</span>
                </div>
                <div>
                  <span class="text-slate-500 block">Total</span>
                  <span class="font-bold text-emerald-400 text-sm font-display">{{ formatCents(confirmedBooking()?.price_cents) }}</span>
                </div>
                <div>
                  <span class="text-slate-500 block">Estado de Pago</span>
                  <span class="font-semibold text-amber-300 text-xs uppercase">{{ confirmedBooking()?.payment_status }}</span>
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-col sm:flex-row gap-3">
              <a
                [href]="getWhatsAppShareUrl()"
                target="_blank"
                rel="noopener noreferrer"
                class="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg"
              >
                <span>Compartir en WhatsApp</span>
              </a>

              <button
                type="button"
                (click)="downloadIcs()"
                class="py-3 px-4 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <span>Agregar a Calendario (.ics)</span>
              </button>
            </div>

            <div class="pt-4">
              <button
                type="button"
                (click)="resetWizard()"
                class="text-xs text-slate-400 hover:text-white underline transition-colors"
              >
                Hacer otra reserva en {{ club()?.name }}
              </button>
            </div>
          </div>
        }
      </main>

      <!-- Footer -->
      <footer class="border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        Powered by Canchariane v2 • Sistema de Reservas en Tiempo Real
      </footer>
    </div>
  `
})
export class PublicBookingWizardComponent implements OnInit {
  private readonly publicService = inject(PublicBookingService);

  // Inputs via route binding (e.g. /c/:slug)
  readonly slug = input<string>('club-alpha');

  // State Signals
  readonly currentStep = signal<number>(1);
  readonly club = signal<PublicClub | null>(null);
  readonly layout = signal<PublicClubLayout | null>(null);
  readonly viewMode = signal<'map' | 'list'>('map');

  readonly selectedDate = signal<string>('');
  readonly selectedHour = signal<string>('');
  readonly selectedCourtId = signal<string | null>(null);

  readonly allDaySlots = signal<PublicSlot[]>([]);
  readonly isLoadingSlots = signal<boolean>(false);
  readonly isCreatingHold = signal<boolean>(false);
  readonly isConfirming = signal<boolean>(false);

  readonly holdData = signal<CreateHoldResponse | null>(null);
  readonly confirmedBooking = signal<PublicBookingResponse | null>(null);
  readonly bookingError = signal<string | null>(null);

  // Guest Form
  guestName = '';
  guestPhone = '';
  guestEmail = '';

  // Next 14 days
  readonly availableDays = computed<DayOption[]>(() => {
    const days: DayOption[] = [];
    const now = new Date();
    const dows = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      let label = `${dows[d.getDay()]}`;
      if (i === 0) label = 'Hoy';
      if (i === 1) label = 'Mañana';

      days.push({
        dateStr,
        label,
        fullLabel: `${dd}/${mm}`
      });
    }
    return days;
  });

  // Unique hours in active day
  readonly distinctHours = computed<string[]>(() => {
    const slots = this.allDaySlots();
    const set = new Set<string>();
    for (const s of slots) {
      if (s.local_start_time) {
        set.add(s.local_start_time);
      }
    }
    return Array.from(set).sort();
  });

  // Slots matching selected hour
  readonly slotsForSelectedHour = computed<PublicSlot[]>(() => {
    const hour = this.selectedHour();
    if (!hour) return [];
    return this.allDaySlots().filter((s) => s.local_start_time === hour);
  });

  // Active chosen slot
  readonly selectedSlot = computed<PublicSlot | null>(() => {
    const courtId = this.selectedCourtId();
    if (!courtId) return null;
    return this.slotsForSelectedHour().find((s) => s.court_id === courtId && s.is_available) || null;
  });

  ngOnInit(): void {
    const today = this.availableDays()[0]?.dateStr;
    if (today) {
      this.selectedDate.set(today);
    }
    this.loadClubAndLayout();
    this.loadAvailability();
  }

  loadClubAndLayout(): void {
    const clubSlug = this.slug();
    this.publicService.getClub(clubSlug).subscribe({
      next: (c) => this.club.set(c),
      error: () => console.error('Error fetching club')
    });

    this.publicService.getClubLayout(clubSlug).subscribe({
      next: (l) => this.layout.set(l),
      error: () => console.error('Error fetching layout')
    });
  }

  loadAvailability(): void {
    const dateStr = this.selectedDate();
    const clubSlug = this.slug();
    if (!dateStr || !clubSlug) return;

    this.isLoadingSlots.set(true);
    this.publicService.getAvailability(clubSlug, dateStr).subscribe({
      next: (slots) => {
        this.allDaySlots.set(slots);
        this.isLoadingSlots.set(false);
        // Default to first available hour if none chosen
        const hours = this.distinctHours();
        if (hours.length > 0 && !hours.includes(this.selectedHour())) {
          this.selectedHour.set(hours[0]);
        }
      },
      error: () => {
        this.isLoadingSlots.set(false);
      }
    });
  }

  selectDate(d: string): void {
    this.selectedDate.set(d);
    this.selectedCourtId.set(null);
    this.loadAvailability();
  }

  selectHour(h: string): void {
    this.selectedHour.set(h);
    // If current selected court is not available at new hour, clear it
    const available = this.slotsForSelectedHour().find((s) => s.court_id === this.selectedCourtId() && s.is_available);
    if (!available) {
      this.selectedCourtId.set(null);
    }
  }

  onCourtSelected(courtId: string): void {
    this.selectedCourtId.set(courtId);
  }

  proceedToHold(): void {
    const slot = this.selectedSlot();
    const clubSlug = this.slug();
    if (!slot || !clubSlug) return;

    this.isCreatingHold.set(true);
    this.bookingError.set(null);

    this.publicService
      .createHold(clubSlug, {
        court_id: slot.court_id,
        start_time: slot.start_time,
        duration_minutes: slot.duration_minutes
      })
      .subscribe({
        next: (hold) => {
          this.holdData.set(hold);
          this.isCreatingHold.set(false);
          this.currentStep.set(2);
        },
        error: (err) => {
          this.isCreatingHold.set(false);
          this.bookingError.set(err.error?.detail || 'No fue posible apartar la cancha. Por favor elige otro horario.');
        }
      });
  }

  cancelHoldAndBack(): void {
    this.currentStep.set(1);
    this.holdData.set(null);
  }

  onHoldExpired(): void {
    alert('El tiempo de reserva temporal ha expirado. Por favor selecciona tu horario nuevamente.');
    this.currentStep.set(1);
    this.holdData.set(null);
    this.loadAvailability();
  }

  confirmBooking(): void {
    const hold = this.holdData();
    const clubSlug = this.slug();
    if (!hold || !clubSlug) return;

    this.isConfirming.set(true);
    this.bookingError.set(null);

    // Generate client-side idempotency UUID
    const idempotencyKey = crypto.randomUUID();

    this.publicService
      .confirmBooking(clubSlug, idempotencyKey, {
        hold_id: hold.hold_id,
        customer_name: this.guestName.trim(),
        customer_phone: this.guestPhone.trim(),
        customer_email: this.guestEmail.trim()
      })
      .subscribe({
        next: (booking) => {
          this.confirmedBooking.set(booking);
          this.isConfirming.set(false);
          this.currentStep.set(3);
        },
        error: (err) => {
          this.isConfirming.set(false);
          this.bookingError.set(err.error?.detail || 'Error al confirmar la reserva. Intenta nuevamente.');
        }
      });
  }

  resetWizard(): void {
    this.currentStep.set(1);
    this.holdData.set(null);
    this.confirmedBooking.set(null);
    this.selectedCourtId.set(null);
    this.loadAvailability();
  }

  formatCents(cents?: number): string {
    if (!cents) return '$0 COP';
    return '$' + (cents / 100).toLocaleString('es-CO') + ' COP';
  }

  getWhatsAppShareUrl(): string {
    const b = this.confirmedBooking();
    if (!b) return '';
    const text = encodeURIComponent(
      `¡Hola! Confirmé mi reserva en ${this.club()?.name}:\n` +
      `🎾 Cancha: ${b.court_name}\n` +
      `📅 Fecha: ${this.selectedDate()}\n` +
      `⏰ Hora: ${this.selectedHour()}\n` +
      `🔑 Código de reserva: ${b.code}`
    );
    return `https://wa.me/?text=${text}`;
  }

  downloadIcs(): void {
    const b = this.confirmedBooking();
    if (!b) return;

    const start = new Date(b.start_time).toISOString().replace(/-|:|\.\d+/g, '');
    const end = new Date(b.end_time).toISOString().replace(/-|:|\.\d+/g, '');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Canchariane//Padel Booking//ES',
      'BEGIN:VEVENT',
      `SUMMARY:Partido de Pádel - ${b.court_name}`,
      `DESCRIPTION:Reserva confirmada en ${this.club()?.name}. Código: ${b.code}`,
      `LOCATION:${this.club()?.address || this.club()?.name}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `reserva-${b.code}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  getCourtCardClass(slot: PublicSlot): string {
    if (this.selectedCourtId() === slot.court_id) {
      return 'border-emerald-500 bg-emerald-950/20';
    }
    if (!slot.is_available) {
      return 'border-slate-800 bg-slate-900/70 opacity-50 cursor-not-allowed';
    }
    return 'border-slate-800 bg-slate-900/70 hover:border-slate-700';
  }
}
