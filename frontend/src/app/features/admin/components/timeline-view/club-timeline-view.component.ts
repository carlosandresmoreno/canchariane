import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminBlock, AdminBooking, AdminCourt } from '../../services/club-admin.service';

interface TimelineRow {
  hourStr: string;
  hourNum: number;
}

@Component({
  selector: 'app-club-timeline-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Top Calendar Control Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="font-serif italic text-xl text-slate-900">Agenda & Recepción</h2>
            <span class="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0056FB] border border-blue-200 text-[10px] font-mono tracking-wider uppercase font-medium">
              Turnos en Vivo
            </span>
          </div>
          <p class="text-xs text-slate-500 font-sans mt-0.5">
            Gestiona reservas de mostrador y bloquea canchas por torneos, eventos o reparaciones
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
          <!-- Date Navigator -->
          <div class="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs font-mono shadow-xs">
            <button
              type="button"
              (click)="dayChanged.emit(-1)"
              class="p-2 hover:bg-slate-200/80 rounded-lg text-slate-600 hover:text-slate-900 transition-colors"
              title="Día anterior"
            >
              ◀
            </button>
            <button
              type="button"
              (click)="todayClicked.emit()"
              class="px-3.5 py-1.5 hover:bg-slate-200/80 rounded-lg text-slate-800 hover:text-slate-950 transition-colors tracking-wider uppercase text-[11px] font-medium"
            >
              {{ formattedDateDisplay }}
            </button>
            <button
              type="button"
              (click)="dayChanged.emit(1)"
              class="p-2 hover:bg-slate-200/80 rounded-lg text-slate-600 hover:text-slate-900 transition-colors"
              title="Día siguiente"
            >
              ▶
            </button>
          </div>

          <!-- Compartir Link Portal Button -->
          <button
            type="button"
            (click)="openShareModal.emit()"
            class="px-3.5 py-2.5 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-[#0056FB] font-medium text-xs tracking-wider uppercase font-mono transition-all duration-300 shadow-xs flex items-center justify-center gap-1.5 active:scale-95"
            title="Compartir enlace público del portal para que los clientes reserven en línea"
          >
            <span>🔗 Compartir Portal</span>
          </button>

          <!-- Bloquear Horario Button -->
          <button
            type="button"
            (click)="openNewBlockModal.emit({})"
            class="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs tracking-wider uppercase font-mono transition-all duration-300 shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
            title="Bloquear canchas por campeonato, reparación o evento"
          >
            <span>🔒 Bloquear Horario</span>
          </button>

          <!-- Nueva Reserva Button -->
          <button
            type="button"
            (click)="openNewBookingModal.emit()"
            class="px-4 py-2.5 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] text-white font-medium text-xs tracking-wider uppercase font-mono transition-all duration-300 shadow-md flex items-center justify-center gap-2 active:scale-95"
          >
            <span>+ Nueva Reserva</span>
          </button>
        </div>
      </div>

      <!-- Active Blocks Banner for Today -->
      @if (todayBlocksCount > 0) {
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 px-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs font-mono shadow-xs">
          <div class="flex items-center gap-2.5">
            <span class="text-lg">⚠️</span>
            <div>
              <span class="font-bold">{{ todayBlocksCount }} bloqueo(s) activo(s)</span>
              <span class="text-amber-800 font-sans block sm:inline sm:ml-1">
                (Torneo, Reparaciones o Eventos). Estos horarios no están disponibles para reservas de clientes.
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

      <!-- Multi-Court Timeline Table -->
      <div class="rounded-3xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div class="overflow-x-auto">
          <div class="min-w-[760px]">
            <!-- Header Row (Courts) -->
            <div
              class="grid border-b border-slate-200 bg-slate-50 text-xs font-mono font-medium text-slate-700"
              [style.grid-template-columns]="gridColumnsStyle"
            >
              <div class="p-4 text-center border-r border-slate-200 text-slate-400 text-[10px] tracking-[0.2em] uppercase font-mono">
                HORA
              </div>
              @for (court of courts; track court.id) {
                <div class="p-4 text-center border-r border-slate-200 last:border-r-0 flex items-center justify-center gap-2">
                  <span class="w-1.5 h-1.5 rounded-full bg-[#0056FB]"></span>
                  <span class="font-sans font-semibold text-slate-900 tracking-wide">{{ court.name }}</span>
                  <span class="text-slate-400 font-normal text-[10px] uppercase font-mono tracking-wider">({{ court.sport }})</span>
                </div>
              }
            </div>

            <!-- Hour Rows -->
            @for (row of timelineRows; track row.hourStr) {
              <div
                class="grid border-b border-slate-100 hover:bg-slate-50/60 transition-colors"
                [style.grid-template-columns]="gridColumnsStyle"
              >
                <!-- Time Label -->
                <div class="p-3 border-r border-slate-200 text-xs font-mono text-slate-500 flex items-center justify-center bg-slate-50/40">
                  {{ row.hourStr }}
                </div>

                <!-- Cells per Court -->
                @for (court of courts; track court.id) {
                  @let block = getBlockForCell(court.id, row.hourNum);
                  @let booking = getBookingForCell(court.id, row.hourNum);
                  <div class="p-1.5 border-r border-slate-100 last:border-r-0 min-h-[76px] flex items-center justify-center transition-colors relative">
                    <!-- CASE 1: BLOCKED CELL (MAINTENANCE, TOURNAMENT, EVENT) -->
                    @if (block) {
                      <div
                        (click)="selectBlock.emit(block)"
                        class="w-full h-full p-2 rounded-xl text-left cursor-pointer transition-all duration-200 border flex flex-col justify-between shadow-xs group"
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
                      <!-- CASE 2: REGULAR CUSTOMER BOOKING -->
                      <div
                        (click)="selectBooking.emit(booking)"
                        class="w-full h-full p-2 rounded-xl text-left cursor-pointer transition-all duration-200 border flex flex-col justify-between shadow-xs"
                        [ngClass]="getBookingBadgeClass(booking.status)"
                      >
                        <div class="flex items-center justify-between gap-1">
                          <span class="font-mono text-[10px] font-bold uppercase truncate">
                            {{ booking.customer_name }}
                          </span>
                          <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/80 border border-current font-semibold uppercase">
                            {{ booking.status }}
                          </span>
                        </div>
                        <div class="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-1">
                          <span>Cod: {{ booking.code }}</span>
                          <span class="font-semibold text-slate-700">
                            {{ (booking.price_cents / 100).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }) }}
                          </span>
                        </div>
                      </div>
                    } @else {
                      <!-- CASE 3: FREE SLOT -->
                      <button
                        type="button"
                        (click)="slotClicked.emit({ courtId: court.id, hourStr: row.hourStr })"
                        class="w-full h-full rounded-xl border border-dashed border-slate-200/90 hover:border-[#0056FB] hover:bg-blue-50/40 flex items-center justify-center transition-all group"
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
    </div>
  `
})
export class ClubTimelineViewComponent {
  @Input({ required: true }) courts: AdminCourt[] = [];
  @Input({ required: true }) bookings: AdminBooking[] = [];
  @Input() blocks: AdminBlock[] = [];
  @Input({ required: true }) currentDate!: string;
  @Input({ required: true }) formattedDateDisplay!: string;

  @Output() dayChanged = new EventEmitter<number>();
  @Output() todayClicked = new EventEmitter<void>();
  @Output() openNewBookingModal = new EventEmitter<void>();
  @Output() openNewBlockModal = new EventEmitter<{ courtId?: string; hourStr?: string }>();
  @Output() slotClicked = new EventEmitter<{ courtId: string; hourStr: string }>();
  @Output() selectBooking = new EventEmitter<AdminBooking>();
  @Output() selectBlock = new EventEmitter<AdminBlock>();
  @Output() openShareModal = new EventEmitter<void>();

  readonly timelineRows: TimelineRow[] = Array.from({ length: 16 }, (_, i) => {
    const h = i + 7;
    return {
      hourStr: `${h.toString().padStart(2, '0')}:00`,
      hourNum: h
    };
  });

  get gridColumnsStyle(): string {
    return `90px repeat(${Math.max(this.courts.length, 1)}, minmax(180px, 1fr))`;
  }

  get todayBlocksCount(): number {
    if (!this.currentDate || !this.blocks?.length) return 0;
    const [y, m, d] = this.currentDate.split('-').map(Number);
    const dayStart = new Date(y, m - 1, d, 0, 0, 0).getTime();
    const dayEnd = new Date(y, m - 1, d, 23, 59, 59).getTime();

    return this.blocks.filter((b) => {
      const bStart = new Date(b.period_start).getTime();
      const bEnd = new Date(b.period_end).getTime();
      return dayStart < bEnd && dayEnd > bStart;
    }).length;
  }

  getBlockForCell(courtId: string, hourNum: number): AdminBlock | undefined {
    if (!this.currentDate || !this.blocks?.length) return undefined;
    const [year, month, day] = this.currentDate.split('-').map(Number);
    const cellStart = new Date(year, month - 1, day, hourNum, 0, 0).getTime();
    const cellEnd = new Date(year, month - 1, day, hourNum + 1, 0, 0).getTime();

    return this.blocks.find((b) => {
      if (b.court_id && b.court_id !== courtId) return false;
      const bStart = new Date(b.period_start).getTime();
      const bEnd = new Date(b.period_end).getTime();
      return cellStart < bEnd && cellEnd > bStart;
    });
  }

  getBookingForCell(courtId: string, hourNum: number): AdminBooking | undefined {
    return this.bookings.find((b) => {
      if (b.court_id !== courtId) return false;
      const start = new Date(b.period_start);
      return start.getHours() === hourNum;
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
        return 'bg-purple-50/95 border-purple-300 text-purple-900 hover:border-purple-600';
      case 'maintenance':
        return 'bg-amber-50/95 border-amber-300 text-amber-950 hover:border-amber-600';
      case 'event':
        return 'bg-indigo-50/95 border-indigo-300 text-indigo-950 hover:border-indigo-600';
      case 'weather':
        return 'bg-sky-50/95 border-sky-300 text-sky-950 hover:border-sky-600';
      case 'closure':
        return 'bg-rose-50/95 border-rose-300 text-rose-950 hover:border-rose-600';
      default:
        return 'bg-slate-100 border-slate-300 text-slate-800 hover:border-slate-500';
    }
  }

  formatBlockTime(block: AdminBlock): string {
    const start = new Date(block.period_start);
    const end = new Date(block.period_end);
    const sh = start.getHours().toString().padStart(2, '0');
    const sm = start.getMinutes().toString().padStart(2, '0');
    const eh = end.getHours().toString().padStart(2, '0');
    const em = end.getMinutes().toString().padStart(2, '0');
    return `${sh}:${sm} - ${eh}:${em}`;
  }

  getBookingBadgeClass(status: string): string {
    switch (status) {
      case 'confirmed':
        return 'bg-blue-50/90 border-blue-200 text-[#0056FB] hover:border-[#0056FB]';
      case 'completed':
        return 'bg-emerald-50/90 border-emerald-200 text-emerald-800 hover:border-emerald-500';
      case 'no_show':
        return 'bg-amber-50/90 border-amber-200 text-amber-800 hover:border-amber-500';
      case 'cancelled':
        return 'bg-slate-50 border-slate-200 text-slate-400 line-through';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-400';
    }
  }
}

