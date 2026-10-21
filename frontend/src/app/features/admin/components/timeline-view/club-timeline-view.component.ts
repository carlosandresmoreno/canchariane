import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminBlock, AdminBooking, AdminCourt } from '../../services/club-admin.service';

interface TimelineRow {
  hourStr: string;
  hourNum: number;
}

export type TimelineViewMode = 'day' | 'week' | 'list';

export interface WeekDayItem {
  dateStr: string;
  dayName: string;
  dayNumber: number;
  monthName: string;
  isToday: boolean;
  isSelected: boolean;
  bookingCount: number;
  hasBlocks: boolean;
}

@Component({
  selector: 'app-club-timeline-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4 pb-20 sm:pb-0">
      <!-- 1. TOP CONTROL BAR (TITLE, DATE, FAST ACTIONS) -->
      <div class="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <!-- Title & Badges -->
          <div>
            <div class="flex items-center gap-2">
              <h2 class="font-serif italic text-xl sm:text-2xl text-slate-900">Agenda & Calendario</h2>
              <span class="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0056FB] border border-blue-200 text-[10px] font-mono tracking-wider uppercase font-semibold">
                Turnos en Vivo
              </span>
            </div>
            <p class="text-xs text-slate-500 font-sans mt-0.5">
              Visualiza disponibilidad, agenda turnos y bloquea canchas estilo Google Calendar.
            </p>
          </div>

          <!-- Date Navigation Bar -->
          <div class="flex flex-wrap items-center gap-2">
            <div class="flex items-center gap-1 bg-slate-50 p-1 sm:p-1.5 rounded-2xl border border-slate-200 text-xs font-mono shadow-xs">
              <!-- Anterior -->
              <button
                type="button"
                (click)="dayChanged.emit(-1)"
                class="w-8 h-8 flex items-center justify-center hover:bg-slate-200/80 active:scale-95 rounded-xl text-slate-700 transition-all font-bold"
                title="Día anterior"
              >
                ◀
              </button>

              <!-- Calendario Datepicker Interactivo -->
              <label
                class="relative flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-[#0056FB] cursor-pointer transition-colors shadow-2xs group"
                title="Toca para elegir cualquier fecha en el calendario"
              >
                <span class="text-sm group-hover:scale-110 transition-transform">📅</span>
                <span class="text-xs font-semibold text-slate-900 tracking-wide capitalize select-none">
                  {{ formattedDateDisplay }}
                </span>
                <input
                  type="date"
                  [value]="currentDate"
                  (change)="onDateInputChange($event)"
                  class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  title="Seleccionar fecha"
                />
              </label>

              <!-- Siguiente -->
              <button
                type="button"
                (click)="dayChanged.emit(1)"
                class="w-8 h-8 flex items-center justify-center hover:bg-slate-200/80 active:scale-95 rounded-xl text-slate-700 transition-all font-bold"
                title="Día siguiente"
              >
                ▶
              </button>

              <!-- Botón Hoy -->
              <button
                type="button"
                (click)="todayClicked.emit()"
                class="px-2.5 py-1.5 hover:bg-blue-50 text-slate-700 hover:text-[#0056FB] rounded-xl text-[11px] font-semibold tracking-wider uppercase transition-colors"
                title="Ir al día de hoy"
              >
                Hoy
              </button>
            </div>

            <!-- Botones de Acción (Desktop/Tablet) -->
            <div class="hidden sm:flex items-center gap-2">
              <button
                type="button"
                (click)="openShareModal.emit()"
                class="px-3 py-2 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-[#0056FB] font-medium text-xs tracking-wider uppercase font-mono transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
                title="Compartir enlace público del portal"
              >
                <span>🔗 Compartir</span>
              </button>

              <button
                type="button"
                (click)="openNewBlockModal.emit({})"
                class="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs tracking-wider uppercase font-mono transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
                title="Bloquear por torneo o reparación"
              >
                <span>🔒 Bloquear</span>
              </button>

              <button
                type="button"
                (click)="openNewBookingModal.emit()"
                class="px-4 py-2 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] text-white font-medium text-xs tracking-wider uppercase font-mono transition-all shadow-md flex items-center gap-1.5 active:scale-95"
              >
                <span>+ Nueva Reserva</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 2. GOOGLE CALENDAR WEEK DAYS RIBBON (7 DÍAS INTERACTIVOS) -->
        <div class="p-2 sm:p-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
          <div class="flex items-center justify-between px-1 text-[11px] font-mono text-slate-500">
            <span class="font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <span>🗓️</span>
              <span>Semana: {{ weekRangeDisplay }}</span>
            </span>

            <div class="flex items-center gap-1.5">
              <button
                type="button"
                (click)="dayChanged.emit(-7)"
                class="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-2xs font-semibold text-[10px] uppercase"
                title="Retroceder 1 semana"
              >
                ◀ Sem. Anterior
              </button>
              <button
                type="button"
                (click)="dayChanged.emit(7)"
                class="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-2xs font-semibold text-[10px] uppercase"
                title="Avanzar 1 semana"
              >
                Sem. Siguiente ▶
              </button>
            </div>
          </div>

          <!-- 7 Day Pills Ribbon -->
          <div class="grid grid-cols-7 gap-1 sm:gap-2">
            @for (day of weekDays(); track day.dateStr) {
              <button
                type="button"
                (click)="dateSelected.emit(day.dateStr)"
                [ngClass]="day.isSelected
                  ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400/40 border-blue-600'
                  : (day.isToday ? 'bg-white text-slate-900 border-blue-400 font-bold' : 'bg-white text-slate-700 border-slate-200')"
                class="py-2 px-1 sm:px-2 rounded-2xl border transition-all text-center flex flex-col items-center justify-center gap-0.5 relative group hover:border-blue-600 cursor-pointer"
              >
                <!-- Day Name (Lun, Mar, Mié...) -->
                <span
                  class="text-[10px] sm:text-xs font-mono uppercase tracking-wider font-semibold"
                  [ngClass]="day.isSelected ? 'text-white' : (day.isToday ? 'text-blue-600' : 'text-slate-500')"
                >
                  {{ day.dayName }}
                </span>

                <!-- Day Number -->
                <span
                  class="text-sm sm:text-lg font-bold font-sans tracking-tight"
                  [ngClass]="day.isSelected ? 'text-white' : 'text-slate-900'"
                >
                  {{ day.dayNumber }}
                </span>

                <!-- Indicators -->
                <div class="flex items-center gap-1 h-2">
                  @if (day.isToday) {
                    <span
                      class="text-[8px] font-mono uppercase px-1 py-0.1 rounded font-bold"
                      [ngClass]="day.isSelected ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'"
                    >
                      Hoy
                    </span>
                  } @else if (day.bookingCount > 0) {
                    <span
                      class="w-1.5 h-1.5 rounded-full"
                      [ngClass]="day.isSelected ? 'bg-white' : 'bg-emerald-500'"
                      title="{{ day.bookingCount }} reserva(s)"
                    ></span>
                  }
                </div>
              </button>
            }
          </div>
        </div>

        <!-- 3. VIEW MODE SELECTOR & COURT FILTER TABS -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <!-- Calendar View Modes: Día | Semana | Agenda -->
          <div class="flex items-center gap-1 p-1 bg-slate-100/90 rounded-2xl w-fit border border-slate-200/80 text-xs font-mono">
            <button
              type="button"
              (click)="viewMode.set('day')"
              [ngClass]="viewMode() === 'day' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600'"
              class="px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
            >
              <span>📅</span>
              <span>Día (Parrilla)</span>
            </button>

            <button
              type="button"
              (click)="viewMode.set('week')"
              [ngClass]="viewMode() === 'week' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600'"
              class="px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
            >
              <span>📆</span>
              <span>Semana (7 Días)</span>
            </button>

            <button
              type="button"
              (click)="viewMode.set('list')"
              [ngClass]="viewMode() === 'list' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600'"
              class="px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
            >
              <span>📋</span>
              <span>Agenda (Lista)</span>
              @if (dayBookingsCount > 0) {
                <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-[#0056FB] font-bold">
                  {{ dayBookingsCount }}
                </span>
              }
            </button>
          </div>

          <!-- Court Filter Pills -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-mono scrollbar-none">
            <span class="text-slate-400 text-[10px] uppercase tracking-wider shrink-0 mr-1 hidden sm:inline">Cancha:</span>
            <button
              type="button"
              (click)="selectedCourtFilter.set('all')"
              [ngClass]="selectedCourtFilter() === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600'"
              class="px-3 py-1.5 rounded-xl border border-slate-200 transition-all shrink-0 hover:bg-slate-100 font-medium"
            >
              Todas ({{ courts.length }})
            </button>

            @for (c of courts; track c.id) {
              <button
                type="button"
                (click)="selectedCourtFilter.set(c.id)"
                [ngClass]="selectedCourtFilter() === c.id ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600'"
                class="px-3 py-1.5 rounded-xl border border-slate-200 transition-all shrink-0 hover:bg-slate-100 font-medium truncate max-w-[150px]"
              >
                {{ c.name }}
              </button>
            }
          </div>
        </div>

        <!-- 4. QUICK STATS STRIP -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 font-mono text-xs">
          <div class="p-2.5 rounded-2xl bg-blue-50/60 border border-blue-100/80 flex items-center gap-2.5">
            <span class="text-base">📅</span>
            <div>
              <div class="text-[10px] uppercase text-blue-600 font-semibold tracking-wider">Reservas Hoy</div>
              <div class="text-sm font-bold text-slate-900">{{ dayBookingsCount }} turno(s)</div>
            </div>
          </div>

          <div class="p-2.5 rounded-2xl bg-emerald-50/60 border border-emerald-100/80 flex items-center gap-2.5">
            <span class="text-base">💰</span>
            <div>
              <div class="text-[10px] uppercase text-emerald-700 font-semibold tracking-wider">Recaudo Estimado</div>
              <div class="text-sm font-bold text-slate-900">
                {{ (dayRevenueCents / 100).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }) }}
              </div>
            </div>
          </div>

          <div class="p-2.5 rounded-2xl bg-purple-50/60 border border-purple-100/80 flex items-center gap-2.5">
            <span class="text-base">🔒</span>
            <div>
              <div class="text-[10px] uppercase text-purple-700 font-semibold tracking-wider">Bloqueos Activos</div>
              <div class="text-sm font-bold text-slate-900">{{ todayBlocksCount }} horario(s)</div>
            </div>
          </div>

          <div class="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5">
            <span class="text-base">🎾</span>
            <div>
              <div class="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">Canchas Club</div>
              <div class="text-sm font-bold text-slate-900">{{ courts.length }} activa(s)</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ACTIVE BLOCKS BANNER -->
      @if (todayBlocksCount > 0) {
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 px-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs font-mono shadow-xs">
          <div class="flex items-center gap-2.5">
            <span class="text-lg">⚠️</span>
            <div>
              <span class="font-bold">{{ todayBlocksCount }} bloqueo(s) activo(s) para hoy</span>
              <span class="text-amber-800 font-sans block sm:inline sm:ml-1">
                (Torneo, Reparaciones o Eventos). Estos horarios están bloqueados para reservas públicas.
              </span>
            </div>
          </div>
          <button
            type="button"
            (click)="openNewBlockModal.emit({})"
            class="text-[11px] font-semibold text-amber-900 hover:text-amber-700 underline uppercase tracking-wider font-mono shrink-0"
          >
            + Añadir Bloqueo
          </button>
        </div>
      }

      <!-- ============================================================ -->
      <!-- VIEW 1: VISTA DÍA (PARRILLA MULTI-CANCHAS ESTILO CALENDARIO) -->
      <!-- ============================================================ -->
      @if (viewMode() === 'day') {
        <div class="rounded-3xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div class="sm:hidden px-4 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-mono text-slate-500 flex items-center justify-between">
            <span>👉 Desliza para ver más canchas</span>
            <span class="text-[#0056FB] font-bold">Hora Fija 📌</span>
          </div>

          <div class="overflow-x-auto relative">
            <div [style.min-width]="dayGridMinWidth">
              <!-- Header Row (Courts) -->
              <div
                class="grid border-b border-slate-200 bg-slate-50 text-xs font-mono font-medium text-slate-700 sticky top-0 z-10"
                [style.grid-template-columns]="dayGridColumnsStyle"
              >
                <div class="p-3.5 text-center border-r border-slate-200 text-slate-500 text-[10px] tracking-[0.2em] uppercase font-mono sticky left-0 bg-slate-100 z-20 shadow-xs">
                  HORA
                </div>

                @for (court of displayedCourts(); track court.id) {
                  <div class="p-3.5 text-center border-r border-slate-200 last:border-r-0 flex items-center justify-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-[#0056FB]"></span>
                    <span class="font-sans font-bold text-slate-900 tracking-wide text-xs sm:text-sm truncate">
                      {{ court.name }}
                    </span>
                    <span class="text-slate-400 font-normal text-[10px] uppercase font-mono tracking-wider hidden sm:inline">
                      ({{ court.sport }})
                    </span>
                  </div>
                }
              </div>

              <!-- Hour Rows -->
              @for (row of timelineRows; track row.hourStr) {
                <div
                  class="grid border-b border-slate-100 hover:bg-slate-50/50 transition-colors relative"
                  [style.grid-template-columns]="dayGridColumnsStyle"
                >
                  <!-- Sticky Hour Label -->
                  <div class="p-2 sm:p-3 border-r border-slate-200 text-xs font-mono font-semibold text-slate-600 flex items-center justify-center sticky left-0 bg-white z-20 shadow-xs select-none">
                    {{ row.hourStr }}
                  </div>

                  <!-- Cells per Court -->
                  @for (court of displayedCourts(); track court.id) {
                    @let block = getBlockForCell(currentDate, court.id, row.hourNum);
                    @let booking = getBookingForCell(currentDate, court.id, row.hourNum);
                    <div class="p-1 sm:p-1.5 border-r border-slate-100 last:border-r-0 min-h-[74px] sm:min-h-[82px] flex items-center justify-center transition-colors relative">
                      <!-- BLOCKED EVENT -->
                      @if (block) {
                        <div
                          (click)="selectBlock.emit(block)"
                          class="w-full h-full p-2 rounded-xl text-left cursor-pointer transition-all duration-200 border-l-4 flex flex-col justify-between shadow-xs group"
                          [ngClass]="getBlockBadgeClass(block.kind)"
                          title="Horario Bloqueado - Clic para ver o desbloquear"
                        >
                          <div class="flex items-center justify-between gap-1">
                            <span class="font-mono text-[10px] font-bold uppercase truncate flex items-center gap-1">
                              <span>{{ getBlockIcon(block.kind) }}</span>
                              <span class="truncate">{{ block.reason || getBlockKindLabel(block.kind) }}</span>
                            </span>
                            <span class="text-[9px] font-mono px-1 py-0.2 rounded bg-white/90 border border-current font-semibold uppercase">
                              {{ getBlockKindLabel(block.kind) }}
                            </span>
                          </div>
                          <div class="flex items-center justify-between text-[10px] font-mono mt-1">
                            <span class="text-[9px] opacity-80">{{ formatBlockTime(block) }}</span>
                            <span class="text-[9px] font-semibold underline group-hover:scale-105 transition-transform">
                              Desbloquear
                            </span>
                          </div>
                        </div>
                      } @else if (booking) {
                        <!-- CUSTOMER BOOKING EVENT (GOOGLE CALENDAR CARD STYLE) -->
                        <div
                          (click)="selectBooking.emit(booking)"
                          class="w-full h-full p-2 sm:p-2.5 rounded-xl text-left cursor-pointer transition-all duration-200 border border-l-4 flex flex-col justify-between shadow-2xs hover:shadow-md hover:scale-[1.01]"
                          [ngClass]="getBookingBadgeClass(booking.status)"
                        >
                          <div class="flex items-center justify-between gap-1">
                            <span class="font-mono text-[11px] font-bold uppercase truncate text-slate-900">
                              {{ booking.customer_name }}
                            </span>
                            <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/90 border border-current font-semibold uppercase">
                              {{ booking.status }}
                            </span>
                          </div>
                          <div class="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-1">
                            <span>Cod: {{ booking.code }}</span>
                            <span class="font-bold text-slate-800">
                              {{ (booking.price_cents / 100).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }) }}
                            </span>
                          </div>
                        </div>
                      } @else {
                        <!-- FREE SLOT -->
                        <button
                          type="button"
                          (click)="slotClicked.emit({ courtId: court.id, hourStr: row.hourStr, dateStr: currentDate })"
                          class="w-full h-full rounded-xl border border-dashed border-slate-200/90 hover:border-[#0056FB] hover:bg-blue-50/50 active:bg-blue-100 flex items-center justify-center transition-all group"
                          title="Crear reserva en este horario"
                        >
                          <span class="text-[11px] font-mono text-slate-400 group-hover:text-[#0056FB] transition-colors uppercase tracking-wider font-medium">
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
      }

      <!-- ============================================================ -->
      <!-- VIEW 2: VISTA SEMANA (7 DÍAS EN COLUMNAS ESTILO CALENDAR)   -->
      <!-- ============================================================ -->
      @if (viewMode() === 'week') {
        <div class="rounded-3xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div class="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-mono text-slate-600 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-900">Vista Semanal:</span>
              <span>{{ activeCourtNameForWeek }}</span>
            </div>
            <span class="text-[11px] text-slate-400 hidden sm:inline">Haz clic en cualquier hora libre para agendar</span>
          </div>

          <div class="overflow-x-auto relative">
            <div class="min-w-[840px]">
              <!-- Week Columns Header -->
              <div
                class="grid border-b border-slate-200 bg-slate-50 text-xs font-mono font-medium text-slate-700 sticky top-0 z-10"
                style="grid-template-columns: 75px repeat(7, minmax(110px, 1fr))"
              >
                <div class="p-3 text-center border-r border-slate-200 text-slate-500 text-[10px] tracking-[0.2em] uppercase font-mono sticky left-0 bg-slate-100 z-20 shadow-xs">
                  HORA
                </div>

                @for (day of weekDays(); track day.dateStr) {
                  <div
                    (click)="dateSelected.emit(day.dateStr)"
                    class="p-3 text-center border-r border-slate-200 last:border-r-0 cursor-pointer hover:bg-slate-100/80 transition-colors"
                    [ngClass]="day.isSelected ? 'bg-blue-50/70' : ''"
                  >
                    <div class="text-[10px] font-bold uppercase font-mono" [ngClass]="(day.isSelected || day.isToday) ? 'text-blue-600 font-bold' : 'text-slate-600'">
                      {{ day.dayName }}
                    </div>
                    <div class="text-sm font-bold font-sans" [ngClass]="(day.isSelected || day.isToday) ? 'text-blue-600 font-bold' : 'text-slate-900'">
                      {{ day.dayNumber }}
                    </div>
                  </div>
                }
              </div>

              <!-- Week Hour Rows -->
              @for (row of timelineRows; track row.hourStr) {
                <div
                  class="grid border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                  style="grid-template-columns: 75px repeat(7, minmax(110px, 1fr))"
                >
                  <div class="p-2 border-r border-slate-200 text-xs font-mono font-semibold text-slate-600 flex items-center justify-center sticky left-0 bg-white z-20 shadow-xs select-none">
                    {{ row.hourStr }}
                  </div>

                  @for (day of weekDays(); track day.dateStr) {
                    @let courtIdForWeek = selectedCourtFilter() === 'all' ? (courts.length > 0 ? courts[0].id : '') : selectedCourtFilter();
                    @let block = getBlockForCell(day.dateStr, courtIdForWeek, row.hourNum);
                    @let booking = getBookingForCell(day.dateStr, courtIdForWeek, row.hourNum);
                    <div class="p-1 border-r border-slate-100 last:border-r-0 min-h-[64px] flex items-center justify-center transition-colors relative">
                      @if (block) {
                        <div
                          (click)="selectBlock.emit(block)"
                          class="w-full h-full p-1.5 rounded-lg text-left cursor-pointer border-l-2 text-[10px] font-mono flex flex-col justify-between truncate"
                          [ngClass]="getBlockBadgeClass(block.kind)"
                        >
                          <span class="font-bold truncate">{{ block.reason || getBlockKindLabel(block.kind) }}</span>
                          <span class="text-[9px] opacity-75">Bloqueado</span>
                        </div>
                      } @else if (booking) {
                        <div
                          (click)="selectBooking.emit(booking)"
                          class="w-full h-full p-1.5 rounded-lg text-left cursor-pointer border-l-2 text-[10px] font-mono flex flex-col justify-between truncate"
                          [ngClass]="getBookingBadgeClass(booking.status)"
                        >
                          <span class="font-bold truncate text-slate-900">{{ booking.customer_name }}</span>
                          <span class="text-[9px] font-semibold text-slate-600">Cod: {{ booking.code }}</span>
                        </div>
                      } @else {
                        <button
                          type="button"
                          (click)="slotClicked.emit({ courtId: courtIdForWeek, hourStr: row.hourStr, dateStr: day.dateStr })"
                          class="w-full h-full rounded-lg border border-dashed border-slate-200/80 hover:border-[#0056FB] hover:bg-blue-50/50 flex items-center justify-center transition-all group"
                          title="Reservar el {{ day.dayName }} {{ day.dayNumber }} a las {{ row.hourStr }}"
                        >
                          <span class="text-[10px] font-mono text-slate-300 group-hover:text-[#0056FB]">
                            +
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
      }

      <!-- ============================================================ -->
      <!-- VIEW 3: VISTA AGENDA / LISTA (CRONOLÓGICO FEED)              -->
      <!-- ============================================================ -->
      @if (viewMode() === 'list') {
        <div class="space-y-4">
          <div class="flex items-center justify-between text-xs font-mono px-1">
            <span class="text-slate-500 font-medium">Turnos de {{ formattedDateDisplay }}</span>
            <span class="text-slate-400">{{ chronologicalEntries().length }} turno(s) agendado(s)</span>
          </div>

          @if (chronologicalEntries().length === 0) {
            <div class="p-10 rounded-3xl bg-white border border-slate-200 text-center space-y-3 shadow-xs">
              <span class="text-4xl block">🏖️</span>
              <h3 class="font-serif italic text-lg text-slate-800">No hay reservas ni bloqueos para este día</h3>
              <p class="text-xs text-slate-500 font-sans max-w-sm mx-auto">
                Todas las canchas están disponibles. Puedes crear una reserva manual o usar la parrilla para seleccionar un horario.
              </p>
              <div class="pt-2">
                <button
                  type="button"
                  (click)="openNewBookingModal.emit()"
                  class="px-4 py-2.5 rounded-xl bg-[#0056FB] text-white font-mono text-xs font-medium uppercase tracking-wider shadow-sm hover:bg-[#0048d6] transition-all"
                >
                  + Crear Primera Reserva
                </button>
              </div>
            </div>
          } @else {
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              @for (item of chronologicalEntries(); track item.uniqueKey) {
                @if (item.type === 'booking') {
                  @let b = item.booking!;
                  <div
                    (click)="selectBooking.emit(b)"
                    class="p-4 rounded-2xl bg-white border border-slate-200 hover:border-[#0056FB] hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 group border-l-4 border-l-[#0056FB]"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                        <div>
                          <span class="font-mono text-xs font-bold text-slate-900 block">
                            {{ formatItemTime(b.period_start, b.period_end) }}
                          </span>
                          <span class="text-[11px] font-sans font-medium text-slate-500">
                            {{ b.court_name }}
                          </span>
                        </div>
                      </div>

                      <span
                        class="text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase font-bold"
                        [ngClass]="getBookingBadgeClass(b.status)"
                      >
                        {{ b.status }}
                      </span>
                    </div>

                    <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div class="truncate">
                        <span class="font-semibold text-slate-900 truncate block">{{ b.customer_name }}</span>
                        <span class="text-[11px] text-slate-400 font-mono">{{ b.customer_phone || 'Sin teléfono' }}</span>
                      </div>

                      @if (b.customer_phone) {
                        <div class="flex items-center gap-1.5 shrink-0" (click)="$event.stopPropagation()">
                          <a
                            [href]="'https://wa.me/' + cleanPhoneForWhatsApp(b.customer_phone)"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold transition-colors"
                            title="Abrir WhatsApp"
                          >
                            💬
                          </a>
                          <a
                            [href]="'tel:' + b.customer_phone"
                            class="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#0056FB] flex items-center justify-center text-xs font-bold transition-colors"
                            title="Llamar al cliente"
                          >
                            📞
                          </a>
                        </div>
                      }
                    </div>

                    <div class="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1">
                      <span>Cod: {{ b.code }}</span>
                      <span class="font-bold text-slate-800 text-xs">
                        {{ (b.price_cents / 100).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }) }}
                      </span>
                    </div>
                  </div>
                } @else {
                  @let blk = item.block!;
                  <div
                    (click)="selectBlock.emit(blk)"
                    class="p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 shadow-xs group border-l-4"
                    [ngClass]="getBlockBadgeClass(blk.kind)"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <span class="text-base">{{ getBlockIcon(blk.kind) }}</span>
                        <div>
                          <span class="font-mono text-xs font-bold block">
                            {{ formatItemTime(blk.period_start, blk.period_end) }}
                          </span>
                          <span class="text-[11px] font-medium opacity-80">
                            {{ getCourtNameById(blk.court_id) }}
                          </span>
                        </div>
                      </div>

                      <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/90 border border-current font-bold uppercase">
                        {{ getBlockKindLabel(blk.kind) }}
                      </span>
                    </div>

                    <div class="text-xs pt-1 border-t border-current/10">
                      <span class="font-medium opacity-90 truncate block">
                        {{ blk.reason || 'Sin motivo especificado' }}
                      </span>
                    </div>

                    <div class="flex items-center justify-between text-[10px] font-mono opacity-80 pt-1">
                      <span>Bloqueo Interno</span>
                      <span class="font-bold underline group-hover:scale-105 transition-transform">
                        Gestionar / Desbloquear ↗
                      </span>
                    </div>
                  </div>
                }
              }
            </div>
          }
        </div>
      }

      <!-- MOBILE BOTTOM FLOATING BAR -->
      <div class="sm:hidden fixed bottom-4 left-4 right-4 z-40 flex items-center gap-2 p-2 rounded-2xl bg-slate-950/90 backdrop-blur-md border border-slate-800 shadow-2xl">
        <button
          type="button"
          (click)="openNewBookingModal.emit()"
          class="flex-1 py-2.5 px-3 rounded-xl bg-[#0056FB] text-white font-mono text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 shadow-md"
        >
          <span>+ Nueva Reserva</span>
        </button>

        <button
          type="button"
          (click)="openNewBlockModal.emit({})"
          class="py-2.5 px-3 rounded-xl bg-slate-800 text-slate-200 font-mono text-xs font-medium uppercase tracking-wider flex items-center justify-center gap-1 active:scale-95"
          title="Bloquear canchas"
        >
          <span>🔒 Bloquear</span>
        </button>

        <button
          type="button"
          (click)="cycleViewMode()"
          class="py-2.5 px-3 rounded-xl bg-slate-800 text-slate-200 font-mono text-xs font-medium uppercase tracking-wider flex items-center justify-center active:scale-95"
          title="Cambiar vista (Día / Semana / Agenda)"
        >
          <span>{{ viewMode() === 'day' ? '📆' : viewMode() === 'week' ? '📋' : '📅' }}</span>
        </button>
      </div>
    </div>
  `
})
export class ClubTimelineViewComponent {
  readonly _courts = signal<AdminCourt[]>([]);
  @Input({ required: true }) set courts(val: AdminCourt[]) {
    this._courts.set(val || []);
  }
  get courts(): AdminCourt[] {
    return this._courts();
  }

  readonly _bookings = signal<AdminBooking[]>([]);
  @Input({ required: true }) set bookings(val: AdminBooking[]) {
    this._bookings.set(val || []);
  }
  get bookings(): AdminBooking[] {
    return this._bookings();
  }

  readonly _blocks = signal<AdminBlock[]>([]);
  @Input() set blocks(val: AdminBlock[]) {
    this._blocks.set(val || []);
  }
  get blocks(): AdminBlock[] {
    return this._blocks();
  }

  readonly _currentDate = signal<string>('');
  @Input({ required: true }) set currentDate(val: string) {
    this._currentDate.set(val || '');
  }
  get currentDate(): string {
    return this._currentDate();
  }

  readonly _formattedDateDisplay = signal<string>('');
  @Input({ required: true }) set formattedDateDisplay(val: string) {
    this._formattedDateDisplay.set(val || '');
  }
  get formattedDateDisplay(): string {
    return this._formattedDateDisplay();
  }

  @Output() dayChanged = new EventEmitter<number>();
  @Output() dateSelected = new EventEmitter<string>();
  @Output() todayClicked = new EventEmitter<void>();
  @Output() openNewBookingModal = new EventEmitter<void>();
  @Output() openNewBlockModal = new EventEmitter<{ courtId?: string; hourStr?: string }>();
  @Output() slotClicked = new EventEmitter<{ courtId: string; hourStr: string; dateStr?: string }>();
  @Output() selectBooking = new EventEmitter<AdminBooking>();
  @Output() selectBlock = new EventEmitter<AdminBlock>();
  @Output() openShareModal = new EventEmitter<void>();

  // Interactive UI State
  readonly viewMode = signal<TimelineViewMode>('day');
  readonly selectedCourtFilter = signal<string>('all');

  readonly timelineRows: TimelineRow[] = Array.from({ length: 16 }, (_, i) => {
    const h = i + 7;
    return {
      hourStr: `${h.toString().padStart(2, '0')}:00`,
      hourNum: h
    };
  });

  // Week Days computation (7 days: Monday to Sunday)
  readonly weekDays = computed<WeekDayItem[]>(() => {
    const cur = this._currentDate();
    const allBookings = this._bookings();
    const allBlocks = this._blocks();
    if (!cur) return [];
    const [y, m, d] = cur.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(y, m - 1, d + diffToMonday);

    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    const result: WeekDayItem[] = [];
    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

    for (let i = 0; i < 7; i++) {
      const dt = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const dtYear = dt.getFullYear();
      const dtMonth = (dt.getMonth() + 1).toString().padStart(2, '0');
      const dtDay = dt.getDate().toString().padStart(2, '0');
      const dtStr = `${dtYear}-${dtMonth}-${dtDay}`;

      const dayStart = new Date(`${dtStr}T00:00:00-05:00`).getTime();
      const dayEnd = new Date(`${dtStr}T23:59:59-05:00`).getTime();

      const bCount = allBookings.filter(b => {
        const bStart = new Date(b.period_start).getTime();
        const bEnd = new Date(b.period_end).getTime();
        return dayStart < bEnd && dayEnd > bStart && b.status !== 'cancelled';
      }).length;

      const blkCount = allBlocks.some(blk => {
        const blkStart = new Date(blk.period_start).getTime();
        const blkEnd = new Date(blk.period_end).getTime();
        return dayStart < blkEnd && dayEnd > blkStart;
      });

      result.push({
        dateStr: dtStr,
        dayName: dayNames[i],
        dayNumber: dt.getDate(),
        monthName: monthNames[dt.getMonth()],
        isToday: dtStr === todayStr,
        isSelected: dtStr === cur,
        bookingCount: bCount,
        hasBlocks: blkCount
      });
    }

    return result;
  });

  get weekRangeDisplay(): string {
    const days = this.weekDays();
    if (!days.length) return '';
    const first = days[0];
    const last = days[6];
    return `${first.dayNumber} ${first.monthName} - ${last.dayNumber} ${last.monthName}`;
  }

  get activeCourtNameForWeek(): string {
    const filter = this.selectedCourtFilter();
    const all = this._courts();
    if (filter === 'all') {
      return all[0] ? `${all[0].name} (${all[0].sport})` : 'Cancha 1';
    }
    const c = all.find(item => item.id === filter);
    return c ? `${c.name} (${c.sport})` : 'Cancha';
  }

  // Filtered courts based on active court pill (reacts to both filter and courts signal)
  readonly displayedCourts = computed(() => {
    const filter = this.selectedCourtFilter();
    const all = this._courts();
    if (filter === 'all') return all;
    return all.filter(c => c.id === filter);
  });

  get dayGridColumnsStyle(): string {
    const count = this.displayedCourts().length;
    if (count <= 1) {
      return '70px 1fr';
    }
    return `75px repeat(${count}, minmax(180px, 1fr))`;
  }

  get dayGridMinWidth(): string {
    const count = this.displayedCourts().length;
    if (count <= 1) return '100%';
    return `${Math.max(count * 180 + 75, 600)}px`;
  }

  // Daily stats for selected day
  get dayBookingsCount(): number {
    const cur = this._currentDate();
    if (!cur) return 0;
    const dayStart = new Date(`${cur}T00:00:00-05:00`).getTime();
    const dayEnd = new Date(`${cur}T23:59:59-05:00`).getTime();

    return this._bookings().filter(b => {
      const bStart = new Date(b.period_start).getTime();
      const bEnd = new Date(b.period_end).getTime();
      return dayStart < bEnd && dayEnd > bStart && (b.status === 'confirmed' || b.status === 'completed');
    }).length;
  }

  get dayRevenueCents(): number {
    const cur = this._currentDate();
    if (!cur) return 0;
    const dayStart = new Date(`${cur}T00:00:00-05:00`).getTime();
    const dayEnd = new Date(`${cur}T23:59:59-05:00`).getTime();

    return this._bookings()
      .filter(b => {
        const bStart = new Date(b.period_start).getTime();
        const bEnd = new Date(b.period_end).getTime();
        return dayStart < bEnd && dayEnd > bStart && b.status !== 'cancelled';
      })
      .reduce((acc, b) => acc + (b.price_cents || 0), 0);
  }

  get todayBlocksCount(): number {
    const cur = this._currentDate();
    const blks = this._blocks();
    if (!cur || !blks.length) return 0;
    const dayStart = new Date(`${cur}T00:00:00-05:00`).getTime();
    const dayEnd = new Date(`${cur}T23:59:59-05:00`).getTime();

    return blks.filter((b) => {
      const bStart = new Date(b.period_start).getTime();
      const bEnd = new Date(b.period_end).getTime();
      return dayStart < bEnd && dayEnd > bStart;
    }).length;
  }

  readonly chronologicalEntries = computed(() => {
    const filter = this.selectedCourtFilter();
    const cur = this._currentDate();
    if (!cur) return [];

    const dayStart = new Date(`${cur}T00:00:00-05:00`).getTime();
    const dayEnd = new Date(`${cur}T23:59:59-05:00`).getTime();

    const entries: {
      type: 'booking' | 'block';
      start: number;
      booking?: AdminBooking;
      block?: AdminBlock;
      uniqueKey: string;
    }[] = [];

    for (const b of this._bookings()) {
      if (filter !== 'all' && b.court_id !== filter) continue;
      const bStart = new Date(b.period_start).getTime();
      const bEnd = new Date(b.period_end).getTime();
      if (dayStart < bEnd && dayEnd > bStart) {
        entries.push({
          type: 'booking',
          start: bStart,
          booking: b,
          uniqueKey: `booking-${b.id}`
        });
      }
    }

    for (const blk of this._blocks()) {
      if (filter !== 'all' && blk.court_id && blk.court_id !== filter) continue;
      const bStart = new Date(blk.period_start).getTime();
      const bEnd = new Date(blk.period_end).getTime();
      if (dayStart < bEnd && dayEnd > bStart) {
        entries.push({
          type: 'block',
          start: bStart,
          block: blk,
          uniqueKey: `block-${blk.id}`
        });
      }
    }

    return entries.sort((a, b) => a.start - b.start);
  });

  onDateInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input?.value) {
      this.dateSelected.emit(input.value);
    }
  }

  cycleViewMode(): void {
    const current = this.viewMode();
    if (current === 'day') this.viewMode.set('week');
    else if (current === 'week') this.viewMode.set('list');
    else this.viewMode.set('day');
  }

  cleanPhoneForWhatsApp(phone: string): string {
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 10) return `57${clean}`;
    return clean;
  }

  getCourtNameById(courtId: string | null | undefined): string {
    if (!courtId) return 'Todas las Canchas';
    const court = this.courts.find(c => c.id === courtId);
    return court ? `${court.name} (${court.sport})` : 'Cancha';
  }

  formatItemTime(startIso: string, endIso: string): string {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const sh = start.toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    const eh = end.toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return `${sh} - ${eh}`;
  }

  getBlockForCell(dateStr: string, courtId: string, hourNum: number): AdminBlock | undefined {
    const blks = this._blocks();
    if (!dateStr || !blks.length) return undefined;
    const hStr = hourNum.toString().padStart(2, '0');
    const nextHStr = (hourNum + 1).toString().padStart(2, '0');
    const cellStart = new Date(`${dateStr}T${hStr}:00:00-05:00`).getTime();
    const cellEnd = new Date(`${dateStr}T${nextHStr}:00:00-05:00`).getTime();

    return blks.find((b) => {
      if (b.court_id && b.court_id !== courtId) return false;
      const bStart = new Date(b.period_start).getTime();
      const bEnd = new Date(b.period_end).getTime();
      return cellStart < bEnd && cellEnd > bStart;
    });
  }

  getBookingForCell(dateStr: string, courtId: string, hourNum: number): AdminBooking | undefined {
    const bkgs = this._bookings();
    if (!dateStr || !bkgs.length) return undefined;
    const hStr = hourNum.toString().padStart(2, '0');
    const nextHStr = (hourNum + 1).toString().padStart(2, '0');
    const cellStart = new Date(`${dateStr}T${hStr}:00:00-05:00`).getTime();
    const cellEnd = new Date(`${dateStr}T${nextHStr}:00:00-05:00`).getTime();

    return bkgs.find((b) => {
      if (b.court_id !== courtId) return false;
      const bStart = new Date(b.period_start).getTime();
      const bEnd = new Date(b.period_end).getTime();
      return cellStart < bEnd && cellEnd > bStart;
    });
  }

  getBlockIcon(kind: string): string {
    switch (kind) {
      case 'tournament': return '🏆';
      case 'maintenance': return '🛠️';
      case 'event': return '🎪';
      case 'weather': return '🌧️';
      case 'closure': return '⛔';
      default: return '🔒';
    }
  }

  getBlockKindLabel(kind: string): string {
    switch (kind) {
      case 'tournament': return 'Torneo';
      case 'maintenance': return 'Mantenimiento';
      case 'event': return 'Evento';
      case 'weather': return 'Clima';
      case 'closure': return 'Cierre';
      default: return 'Bloqueado';
    }
  }

  getBlockBadgeClass(kind: string): string {
    switch (kind) {
      case 'tournament':
        return 'bg-purple-50/95 border-purple-400 text-purple-900 hover:border-purple-600 border-l-purple-600';
      case 'maintenance':
        return 'bg-amber-50/95 border-amber-400 text-amber-950 hover:border-amber-600 border-l-amber-600';
      case 'event':
        return 'bg-indigo-50/95 border-indigo-400 text-indigo-950 hover:border-indigo-600 border-l-indigo-600';
      case 'weather':
        return 'bg-sky-50/95 border-sky-400 text-sky-950 hover:border-sky-600 border-l-sky-600';
      case 'closure':
        return 'bg-rose-50/95 border-rose-400 text-rose-950 hover:border-rose-600 border-l-rose-600';
      default:
        return 'bg-slate-100 border-slate-300 text-slate-800 hover:border-slate-500 border-l-slate-600';
    }
  }

  formatBlockTime(block: AdminBlock): string {
    const start = new Date(block.period_start);
    const end = new Date(block.period_end);
    const sh = start.toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const eh = end.toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return `${sh} - ${eh}`;
  }

  getBookingBadgeClass(status: string): string {
    switch (status) {
      case 'confirmed':
        return 'bg-blue-50/90 border-blue-200 text-[#0056FB] hover:border-[#0056FB] border-l-[#0056FB]';
      case 'completed':
        return 'bg-emerald-50/90 border-emerald-200 text-emerald-800 hover:border-emerald-500 border-l-emerald-600';
      case 'no_show':
        return 'bg-amber-50/90 border-amber-200 text-amber-800 hover:border-amber-500 border-l-amber-500';
      case 'cancelled':
        return 'bg-slate-50 border-slate-200 text-slate-400 line-through border-l-slate-400';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-400 border-l-slate-500';
    }
  }
}
