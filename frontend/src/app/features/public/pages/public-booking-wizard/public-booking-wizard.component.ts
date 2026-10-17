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
    <div class="relative min-h-screen bg-white text-slate-900 flex flex-col justify-between selection:bg-[#0056FB] selection:text-white overflow-x-hidden font-sans">
      <!-- Clean Luminous Ambient Glow -->
      <div class="ambient-lighting"></div>

      <!-- Top Quiet Luxury Header -->
      <header class="relative z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl sticky top-0">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center font-serif italic text-lg text-[#0056FB] shadow-xs">
              C
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-mono text-[10px] tracking-[0.25em] text-slate-500 uppercase">Club</span>
                <span class="w-1.5 h-1.5 rounded-full bg-[#0056FB]"></span>
                <span class="text-xs text-slate-500">{{ club()?.timezone || 'America/Bogota' }}</span>
              </div>
              <h1 class="font-serif italic text-xl sm:text-2xl text-slate-900 tracking-tight leading-none mt-0.5">
                {{ club()?.name || 'Club Deportivo' }}
              </h1>
            </div>
          </div>

          <div class="flex items-center gap-2.5">
            <a
              routerLink="/lookup"
              class="text-xs font-mono uppercase tracking-wider text-slate-600 hover:text-slate-950 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-400 transition-all shadow-xs hidden sm:inline-flex"
            >
              Consultar Reserva
            </a>
            <a
              [routerLink]="['/auth/login']"
              [queryParams]="{ club: club()?.slug, type: 'club' }"
              class="text-xs font-mono uppercase tracking-wider text-[#0056FB] hover:text-[#0048d6] px-3.5 py-2 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200 transition-all shadow-xs flex items-center gap-1.5 font-medium"
              title="Acceso para recepcionistas y administración del club"
            >
              <span>Acceso Personal</span>
              <span class="text-[10px]">➔</span>
            </a>
          </div>
        </div>
      </header>

      <!-- Main Step Container -->
      <main class="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full flex-1">
        <!-- Minimalist Step Indicator -->
        <nav aria-label="Progreso" class="mb-10">
          <div class="flex items-center justify-between max-w-md mx-auto border-b border-slate-200 pb-3 text-xs">
            <div class="flex items-center gap-2" [class.text-slate-900]="currentStep() >= 1" [class.text-slate-400]="currentStep() < 1">
              <span class="font-mono text-[11px] font-semibold" [class.text-[#0056FB]]="currentStep() >= 1">01</span>
              <span class="tracking-wider uppercase text-[10px]">Cancha & Hora</span>
            </div>
            <span class="text-slate-300">/</span>
            <div class="flex items-center gap-2" [class.text-slate-900]="currentStep() >= 2" [class.text-slate-400]="currentStep() < 2">
              <span class="font-mono text-[11px] font-semibold" [class.text-[#0056FB]]="currentStep() >= 2">02</span>
              <span class="tracking-wider uppercase text-[10px]">Tus Datos</span>
            </div>
            <span class="text-slate-300">/</span>
            <div class="flex items-center gap-2" [class.text-slate-900]="currentStep() >= 3" [class.text-slate-400]="currentStep() < 3">
              <span class="font-mono text-[11px] font-semibold" [class.text-[#0056FB]]="currentStep() >= 3">03</span>
              <span class="tracking-wider uppercase text-[10px]">Confirmación</span>
            </div>
          </div>
        </nav>

        <!-- ============================================================= -->
        <!-- PASO 1: SELECCIÓN DE FECHA, HORA Y CANCHA                     -->
        <!-- ============================================================= -->
        @if (currentStep() === 1) {
          <div class="space-y-8 animate-in fade-in duration-500">
            <!-- Date Carousel Selector -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <span class="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-medium">1. Fecha de Juego</span>
                <span class="text-xs text-slate-500 font-mono">{{ selectedDate() }}</span>
              </div>

              <div class="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
                @for (day of availableDays(); track day.dateStr) {
                  <button
                    type="button"
                    (click)="selectDate(day.dateStr)"
                    class="px-5 py-3 rounded-2xl border text-left shrink-0 transition-all duration-300"
                    [ngClass]="selectedDate() === day.dateStr 
                      ? 'bg-[#0056FB] border-[#0056FB] text-white shadow-md' 
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/70 shadow-xs'"
                  >
                    <div class="text-[10px] font-mono uppercase tracking-wider opacity-80">{{ day.label }}</div>
                    <div class="text-sm font-semibold mt-0.5 tracking-tight">{{ day.fullLabel }}</div>
                  </button>
                }
              </div>
            </div>

            <!-- Hour Selector -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <span class="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-medium">2. Franja Horaria</span>
                <span class="font-mono text-xs text-slate-500">
                  {{ distinctHours().length }} horarios disponibles
                </span>
              </div>

              @if (distinctHours().length === 0 && !isLoadingSlots()) {
                <div class="p-8 rounded-3xl bg-slate-50 border border-slate-200 text-center text-slate-500 font-light text-sm shadow-xs">
                  No hay horarios programados para esta fecha. Selecciona otro día.
                </div>
              } @else {
                <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                  @for (hour of distinctHours(); track hour) {
                    <button
                      type="button"
                      (click)="selectHour(hour)"
                      class="px-4 py-2.5 rounded-xl border font-mono text-xs shrink-0 transition-all duration-300"
                      [ngClass]="selectedHour() === hour 
                        ? 'bg-[#0056FB] text-white font-bold border-[#0056FB] shadow-md' 
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/70 shadow-xs'"
                    >
                      {{ hour }}
                    </button>
                  }
                </div>
              }
            </div>

            <!-- View Switcher & Court Selector -->
            <div>
              <div class="flex items-center justify-between mb-4">
                <span class="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-medium">3. Selección de Cancha</span>
                <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs shadow-inner">
                  <button
                    type="button"
                    (click)="activeView.set('map')"
                    class="px-3 py-1 rounded-lg transition-all"
                    [ngClass]="activeView() === 'map' ? 'bg-white text-slate-900 font-medium shadow-xs' : 'text-slate-500 hover:text-slate-900'"
                  >
                    Plano SVG
                  </button>
                  <button
                    type="button"
                    (click)="activeView.set('list')"
                    class="px-3 py-1 rounded-lg transition-all"
                    [ngClass]="activeView() === 'list' ? 'bg-white text-slate-900 font-medium shadow-xs' : 'text-slate-500 hover:text-slate-900'"
                  >
                    Lista
                  </button>
                </div>
              </div>

              <!-- Interactive SVG Court Map View -->
              @if (activeView() === 'map') {
                <app-court-map
                  [layout]="layout()"
                  [slots]="slotsForSelectedHour()"
                  [selectedCourtId]="selectedCourtId()"
                  (courtSelect)="onCourtSelect($event)"
                />
              }

              <!-- Alternative Grid/List View -->
              @if (activeView() === 'list') {
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  @for (court of club()?.courts || []; track court.id) {
                    @let slot = getSlotForCourt(court.id);
                    @let isAvailable = !!(slot && slot.is_available);
                    @let isSelected = selectedCourtId() === court.id;
                    <div
                      class="p-5 rounded-2xl border transition-all duration-300 cursor-pointer shadow-xs"
                      [ngClass]="isSelected 
                        ? 'bg-white border-[#0056FB] ring-2 ring-[#0056FB]/20 shadow-md' 
                        : isAvailable 
                          ? 'bg-white border-slate-200 hover:border-slate-400 shadow-xs' 
                          : 'bg-slate-50/70 border-slate-200/60 opacity-40 cursor-not-allowed'"
                      (click)="isAvailable && onCourtSelect(court.id)"
                    >
                      <div class="flex items-start justify-between">
                        <div>
                          <div class="text-[10px] font-mono uppercase tracking-widest text-slate-400">{{ court.sport }}</div>
                          <h3 class="font-semibold text-slate-900 text-base mt-0.5">{{ court.name }}</h3>
                          <p class="text-xs text-slate-500 mt-1 capitalize">{{ formatSurface(court.surface) }} • {{ formatPlayerFormat(court.player_format) }}</p>
                        </div>
                        <div>
                          @if (isAvailable && slot) {
                            <span class="font-mono text-xs font-semibold text-[#0056FB] bg-[#EFF6FF] px-2.5 py-1 rounded-full border border-[#0056FB]/30">
                              {{ formatCents(slot.price_cents) }}
                            </span>
                          } @else {
                            <span class="text-[10px] font-mono uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                              Ocupada
                            </span>
                          }
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Sticky Bottom Selection Action Drawer -->
            @if (selectedCourtId() && selectedSlot()) {
              <div class="sticky bottom-4 z-30 p-4 sm:p-5 rounded-3xl bg-white/95 backdrop-blur-2xl border border-slate-200 shadow-[0_15px_40px_rgba(0,0,0,0.08)] flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-bottom-4 duration-300">
                <div class="flex items-center gap-4 text-left w-full sm:w-auto">
                  <div class="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center font-serif italic text-xl text-[#0056FB] shadow-xs">
                    ✓
                  </div>
                  <div>
                    <div class="text-[10px] font-mono uppercase tracking-widest text-slate-400">Selección Actual</div>
                    <div class="font-semibold text-slate-900 text-base leading-tight">{{ selectedSlot()?.court_name }}</div>
                    <div class="text-xs text-slate-500 font-mono mt-0.5">
                      {{ selectedDate() }} • {{ selectedSlot()?.local_start_time }} - {{ selectedSlot()?.local_end_time }}
                    </div>
                  </div>
                </div>

                <div class="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
                  <div class="text-left sm:text-right">
                    <div class="text-[10px] uppercase font-mono tracking-wider text-slate-400">Tarifa Total</div>
                    <div class="font-serif italic text-2xl text-slate-900 leading-none">
                      {{ formatCents(selectedSlot()?.price_cents) }}
                    </div>
                  </div>

                  <button
                    type="button"
                    [disabled]="isHolding()"
                    (click)="proceedToHold()"
                    class="py-3 px-6 rounded-2xl bg-[#0056FB] hover:bg-[#0048d6] disabled:opacity-50 text-white font-medium text-xs tracking-wider uppercase font-mono transition-all shadow-md hover:shadow-lg flex items-center gap-2 active:scale-95"
                  >
                    @if (isHolding()) {
                      <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Bloqueando...</span>
                    } @else {
                      <span>Reservar Ahora</span>
                      <span class="text-sm">→</span>
                    }
                  </button>
                </div>
              </div>
            }
          </div>
        }

        <!-- ============================================================= -->
        <!-- PASO 2: CHECKOUT DE INVITADO + TEMPORIZADOR DE HOLD           -->
        <!-- ============================================================= -->
        @if (currentStep() === 2 && hold()) {
          <div class="max-w-xl mx-auto space-y-6 animate-in fade-in duration-500">
            <!-- Hold Status Banner -->
            <div class="flex items-center justify-between p-4 rounded-3xl bg-white/95 backdrop-blur-2xl border border-slate-200 shadow-sm">
              <div>
                <span class="text-[10px] font-mono uppercase tracking-widest text-slate-400 block">Cancha Bloqueada</span>
                <span class="font-semibold text-slate-900 text-sm">{{ selectedSlot()?.court_name }}</span>
              </div>
              <app-countdown-timer
                [expiresAt]="hold()?.expires_at || null"
                (expired)="onHoldExpired()"
              />
            </div>

            <!-- Guest Form Card -->
            <form (ngSubmit)="confirmBooking()" class="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-[0_15px_45px_rgba(0,0,0,0.05)] space-y-5">
              <div class="border-b border-slate-100 pb-4">
                <h2 class="font-serif italic text-2xl text-slate-900">Detalles del Titular</h2>
                <p class="text-xs text-slate-500 mt-1">Ingresa tus datos para vincular el código de reserva.</p>
              </div>

              <div>
                <label for="name" class="block text-[11px] font-mono uppercase tracking-wider text-slate-600 mb-1.5">
                  Nombre Completo
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  [(ngModel)]="customerName"
                  name="customerName"
                  placeholder="Ej: Carlos Moreno"
                  class="w-full px-4 py-3 rounded-2xl bg-slate-50/70 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#0056FB] focus:outline-none focus:ring-1 focus:ring-[#0056FB]/30 text-sm transition-colors"
                />
              </div>

              <div>
                <label for="phone" class="block text-[11px] font-mono uppercase tracking-wider text-slate-600 mb-1.5">
                  Teléfono Móvil
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  [(ngModel)]="customerPhone"
                  name="customerPhone"
                  placeholder="Ej: +57 300 123 4567"
                  class="w-full px-4 py-3 rounded-2xl bg-slate-50/70 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#0056FB] focus:outline-none focus:ring-1 focus:ring-[#0056FB]/30 text-sm transition-colors font-mono"
                />
              </div>

              <div>
                <label for="email" class="block text-[11px] font-mono uppercase tracking-wider text-slate-600 mb-1.5">
                  Correo Electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  [(ngModel)]="customerEmail"
                  name="customerEmail"
                  placeholder="carlos@example.com"
                  class="w-full px-4 py-3 rounded-2xl bg-slate-50/70 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#0056FB] focus:outline-none focus:ring-1 focus:ring-[#0056FB]/30 text-sm transition-colors"
                />
              </div>

              <!-- Price Summary -->
              <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span class="text-xs text-slate-600 font-mono">Total a Pagar en Sitio:</span>
                <span class="font-serif italic text-2xl text-slate-900">{{ formatCents(hold()?.price_cents) }}</span>
              </div>

              <!-- Action Buttons -->
              <div class="flex gap-3 pt-2">
                <button
                  type="button"
                  (click)="cancelHoldAndGoBack()"
                  class="py-3 px-5 rounded-2xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-mono uppercase tracking-wider transition-all"
                >
                  Regresar
                </button>
                <button
                  type="submit"
                  [disabled]="isConfirming() || !customerName || !customerPhone || !customerEmail"
                  class="flex-1 py-3 px-6 rounded-2xl bg-[#0056FB] hover:bg-[#0048d6] disabled:opacity-40 text-white font-medium text-xs font-mono uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 active:scale-95"
                >
                  @if (isConfirming()) {
                    <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Confirmando...</span>
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
          <div class="max-w-xl mx-auto space-y-8 text-center animate-in zoom-in-95 duration-500">
            <div class="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-[#0056FB] shadow-xs">
              <svg class="w-8 h-8 text-[#0056FB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div>
              <h2 class="font-serif italic text-3xl sm:text-4xl text-slate-900">Reserva Confirmada</h2>
              <p class="text-slate-500 text-xs mt-1">Hemos asegurado tu turno en las instalaciones del club.</p>
            </div>

            <!-- Architectural Receipt Card -->
            <div class="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.06)] text-left space-y-6">
              <div class="text-center py-4 border-y border-slate-100">
                <div class="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-1">Código de Acceso</div>
                <div class="font-mono text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-widest select-all">
                  {{ confirmedBooking()?.code }}
                </div>
                <div class="text-[11px] text-slate-400 mt-1 font-mono">Presenta este código al ingresar a la pista</div>
              </div>

              <div class="grid grid-cols-2 gap-4 text-xs font-sans">
                <div>
                  <span class="text-slate-400 uppercase font-mono text-[10px] block">Cancha</span>
                  <span class="font-semibold text-slate-900 text-sm">{{ confirmedBooking()?.court_name }}</span>
                </div>
                <div>
                  <span class="text-slate-400 uppercase font-mono text-[10px] block">Titular</span>
                  <span class="font-semibold text-slate-900 text-sm">{{ confirmedBooking()?.customer_name }}</span>
                </div>
                <div>
                  <span class="text-slate-400 uppercase font-mono text-[10px] block">Importe</span>
                  <span class="font-serif italic text-xl text-slate-900">{{ formatCents(confirmedBooking()?.price_cents) }}</span>
                </div>
                <div>
                  <span class="text-slate-400 uppercase font-mono text-[10px] block">Liquidación</span>
                  <span class="font-mono text-[11px] text-[#0056FB] uppercase bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#0056FB]/30 inline-block">{{ confirmedBooking()?.payment_status }}</span>
                </div>
              </div>

              <div class="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                <a
                  [href]="getWhatsAppShareUrl()"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex-1 py-3 px-4 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] text-white font-mono uppercase tracking-wider text-xs text-center transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  <span>Compartir en WhatsApp</span>
                </a>
                <button
                  type="button"
                  (click)="downloadIcs()"
                  class="py-3 px-4 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-mono uppercase tracking-wider transition-all"
                >
                  Guardar (.ics)
                </button>
              </div>

              <div class="pt-1">
                <a
                  [routerLink]="['/lookup']"
                  [queryParams]="{ code: confirmedBooking()?.code }"
                  class="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 text-xs font-mono uppercase tracking-wider transition-all block text-center"
                >
                  🔍 Consultar o Cancelar este turno
                </a>
              </div>
            </div>

            <div class="pt-4">
              <button
                type="button"
                (click)="resetWizard()"
                class="text-xs text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-widest font-mono"
              >
                ← Realizar otra reserva
              </button>
            </div>
          </div>
        }
      </main>

      <!-- Minimalist Editorial Footer -->
      <footer class="relative z-10 border-t border-slate-200 py-8 text-center text-xs text-slate-400 font-mono tracking-widest">
        CANCHARIANE &copy; 2026 • ARIANEDEVS
      </footer>
    </div>
  `
})
export class PublicBookingWizardComponent implements OnInit {
  private readonly publicService = inject(PublicBookingService);

  readonly slug = input<string>('club-alpha');

  // State Signals
  readonly club = signal<PublicClub | null>(null);
  readonly layout = signal<PublicClubLayout | null>(null);
  readonly allDaySlots = signal<PublicSlot[]>([]);
  readonly selectedDate = signal<string>('');
  readonly selectedHour = signal<string>('');
  readonly selectedCourtId = signal<string | null>(null);
  readonly activeView = signal<'map' | 'list'>('map');

  // Flow Signals
  readonly currentStep = signal<1 | 2 | 3>(1);
  readonly isHolding = signal<boolean>(false);
  readonly isConfirming = signal<boolean>(false);
  readonly isLoadingSlots = signal<boolean>(false);
  readonly hold = signal<CreateHoldResponse | null>(null);
  readonly confirmedBooking = signal<PublicBookingResponse | null>(null);

  // Form Fields
  customerName = '';
  customerPhone = '';
  customerEmail = '';

  readonly availableDays = computed<DayOption[]>(() => {
    const days: DayOption[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dd = d.getDate().toString().padStart(2, '0');
      const mm = (d.getMonth() + 1).toString().padStart(2, '0');
      let label = `${dd}/${mm}`;
      if (i === 0) label = 'Hoy';
      else if (i === 1) label = 'Mañana';
      else {
        const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        label = weekdays[d.getDay()];
      }
      days.push({
        dateStr,
        label,
        fullLabel: `${dd}/${mm}`
      });
    }
    return days;
  });

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

  readonly slotsForSelectedHour = computed<PublicSlot[]>(() => {
    const hour = this.selectedHour();
    if (!hour) return [];
    return this.allDaySlots().filter((s) => s.local_start_time === hour);
  });

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
    this.selectedCourtId.set(null);
  }

  onCourtSelect(courtId: string): void {
    this.selectedCourtId.set(courtId);
  }

  getSlotForCourt(courtId: string): PublicSlot | undefined {
    return this.slotsForSelectedHour().find((s) => s.court_id === courtId);
  }

  proceedToHold(): void {
    const slot = this.selectedSlot();
    const clubSlug = this.slug();
    if (!slot || !clubSlug) return;

    this.isHolding.set(true);
    this.publicService
      .createHold(clubSlug, {
        court_id: slot.court_id,
        start_time: slot.start_time,
        duration_minutes: slot.duration_minutes
      })
      .subscribe({
        next: (holdRes) => {
          this.hold.set(holdRes);
          this.isHolding.set(false);
          this.currentStep.set(2);
        },
        error: (err) => {
          this.isHolding.set(false);
          const detail = err.error?.detail;
          const msg = typeof detail === 'string'
            ? detail
            : (Array.isArray(detail) ? detail.map((d: any) => d.msg).join(' | ') : 'El slot ya no está disponible. Selecciona otro.');
          alert(msg);
          this.loadAvailability();
        }
      });
  }

  confirmBooking(): void {
    const currentHold = this.hold();
    const clubSlug = this.slug();
    if (!currentHold || !clubSlug) return;

    this.isConfirming.set(true);
    const idempotencyKey = 'idemp-' + Math.random().toString(36).substring(2) + Date.now();

    this.publicService
      .confirmBooking(clubSlug, idempotencyKey, {
        hold_id: currentHold.hold_id,
        customer_name: this.customerName.trim(),
        customer_phone: this.customerPhone.trim(),
        customer_email: this.customerEmail.trim()
      })
      .subscribe({
        next: (booking) => {
          this.confirmedBooking.set(booking);
          this.isConfirming.set(false);
          this.currentStep.set(3);
        },
        error: (err) => {
          this.isConfirming.set(false);
          const detail = err.error?.detail;
          const msg = typeof detail === 'string'
            ? detail
            : (Array.isArray(detail) ? detail.map((d: any) => d.msg).join(' | ') : 'No se pudo confirmar la reserva. Intenta de nuevo.');
          alert(msg);
        }
      });
  }

  cancelHoldAndGoBack(): void {
    this.currentStep.set(1);
    this.hold.set(null);
  }

  onHoldExpired(): void {
    alert('El tiempo de reserva de 10 minutos ha expirado. Por favor selecciona tu horario de nuevo.');
    this.currentStep.set(1);
    this.hold.set(null);
    this.selectedCourtId.set(null);
    this.loadAvailability();
  }

  resetWizard(): void {
    this.currentStep.set(1);
    this.hold.set(null);
    this.confirmedBooking.set(null);
    this.selectedCourtId.set(null);
    this.customerName = '';
    this.customerPhone = '';
    this.customerEmail = '';
    this.loadAvailability();
  }

  formatCents(cents?: number): string {
    if (!cents) return '$0 COP';
    return '$' + (cents / 100).toLocaleString('es-CO') + ' COP';
  }

  getWhatsAppShareUrl(): string {
    const b = this.confirmedBooking();
    if (!b) return '#';
    const text = encodeURIComponent(
      `¡Hola! Confirmé mi reserva deportiva en ${b.club_name}.\nCancha: ${b.court_name}\nCódigo: ${b.code}\nFecha: ${b.start_time}`
    );
    return `https://wa.me/?text=${text}`;
  }

  downloadIcs(): void {
    const b = this.confirmedBooking();
    if (!b) return;
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Canchariane//Reservas//ES',
      'BEGIN:VEVENT',
      `SUMMARY:Reserva ${b.court_name} (${b.club_name})`,
      `DESCRIPTION:Código de reserva: ${b.code}`,
      `DTSTART:${new Date(b.start_time).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTEND:${new Date(b.end_time).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
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

  formatPlayerFormat(fmt: string): string {
    switch (fmt) {
      case '5x5': return 'Fútbol 5 (5x5)';
      case '6x6': return 'Fútbol 6 (6x6)';
      case '7x7': return 'Fútbol 7 (7x7)';
      case '8x8': return 'Fútbol 8 (8x8)';
      case '9x9': return 'Fútbol 9 (9x9)';
      case '11x11': return 'Fútbol 11 (11x11)';
      case 'doubles': return 'Dobles';
      case 'singles': return 'Individual';
      case '3x3': return '3 vs 3';
      case '2x2': return '2 vs 2';
      case 'custom': return 'Libre';
      default: return fmt;
    }
  }

  formatSurface(surface: string): string {
    switch (surface) {
      case 'synthetic_grass': return 'Césped Sintético';
      case 'turf': return 'Gramilla';
      case 'clay': return 'Polvo de Ladrillo';
      case 'hard_court': return 'Pista Dura';
      case 'wood': return 'Madera';
      case 'rubber': return 'Poliuretano';
      case 'sand': return 'Arena';
      default: return surface;
    }
  }
}
