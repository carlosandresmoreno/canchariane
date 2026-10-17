import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BusinessHourItem,
  BusinessHoursAdminResponse
} from '../../services/club-admin.service';

interface DayConfig {
  weekday: number;
  name: string;
  shortName: string;
  isOpen: boolean;
  opens_at: string;
  closes_at: string;
  closes_next_day: boolean;
}

const DEFAULT_DAYS: { weekday: number; name: string; shortName: string }[] = [
  { weekday: 0, name: 'Lunes', shortName: 'Lun' },
  { weekday: 1, name: 'Martes', shortName: 'Mar' },
  { weekday: 2, name: 'Miércoles', shortName: 'Mié' },
  { weekday: 3, name: 'Jueves', shortName: 'Jue' },
  { weekday: 4, name: 'Viernes', shortName: 'Vie' },
  { weekday: 5, name: 'Sábado', shortName: 'Sáb' },
  { weekday: 6, name: 'Domingo', shortName: 'Dom' }
];

@Component({
  selector: 'app-club-business-hours-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Section Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="font-serif italic text-xl text-slate-900">Horarios de Atención</h2>
            <span class="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0056FB] border border-blue-200 text-[10px] font-mono tracking-wider uppercase font-medium">
              {{ openDaysCount() }} Días Activos
            </span>
          </div>
          <p class="text-xs text-slate-500 font-sans mt-0.5">
            Define los días y horas en los que tu club está en servicio para habilitar las reservas públicas
          </p>
        </div>

        <div class="flex items-center gap-2">
          <!-- Quick Preset: Copy Monday to all open days -->
          <button
            type="button"
            (click)="copyMondayToAll()"
            class="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-mono text-xs font-medium transition-all shadow-xs active:scale-95"
            title="Aplica la hora de apertura y cierre del Lunes a todos los demás días abiertos"
          >
            📋 Replicar Lunes
          </button>

          <!-- Save Button -->
          <button
            type="button"
            (click)="saveHours()"
            [disabled]="isSaving"
            class="px-5 py-2.5 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] text-white font-medium text-xs tracking-wider uppercase font-mono transition-all duration-300 shadow-md flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            @if (isSaving) {
              <span class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>Guardando...</span>
            } @else {
              <span>💾 Guardar Horarios</span>
            }
          </button>
        </div>
      </div>

      <!-- Information Callout -->
      <div class="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-start gap-3 text-xs text-slate-600">
        <span class="text-base text-[#0056FB] leading-none shrink-0 mt-0.5">💡</span>
        <div class="space-y-1">
          <p class="font-medium text-slate-800">
            ¿Cómo influyen los horarios en las reservas de tus clientes?
          </p>
          <p class="text-slate-500 font-light leading-relaxed">
            Las franjas horarias del portal público se calculan en base a estas horas. Si marcas un día como <strong class="text-slate-700 font-medium">Cerrado</strong>, el sistema no ofrecerá turnos para esa fecha y avisará al cliente que seleccione otro día.
          </p>
        </div>
      </div>

      <!-- Days List / Grid -->
      <div class="bg-white rounded-3xl border border-slate-200/90 shadow-xs divide-y divide-slate-100 overflow-hidden">
        @for (day of days(); track day.weekday; let idx = $index) {
          <div
            class="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors"
            [ngClass]="day.isOpen ? 'bg-white' : 'bg-slate-50/60'"
          >
            <!-- Day Name & Status Toggle -->
            <div class="flex items-center gap-4 min-w-[200px]">
              <!-- Custom Toggle Switch -->
              <button
                type="button"
                (click)="toggleDayOpen(idx)"
                class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                [ngClass]="day.isOpen ? 'bg-[#0056FB]' : 'bg-slate-300'"
                [title]="day.isOpen ? 'Hacer clic para cerrar este día' : 'Hacer clic para abrir este día'"
              >
                <span
                  class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out"
                  [ngClass]="day.isOpen ? 'translate-x-5' : 'translate-x-0'"
                ></span>
              </button>

              <div>
                <div class="flex items-center gap-2">
                  <span class="font-serif italic text-base text-slate-900 font-medium">
                    {{ day.name }}
                  </span>
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold border"
                    [ngClass]="day.isOpen 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-slate-100 text-slate-400 border-slate-200'"
                  >
                    {{ day.isOpen ? 'Abierto' : 'Cerrado' }}
                  </span>
                </div>
                <span class="text-[11px] text-slate-400 font-mono">
                  {{ day.isOpen ? 'Genera franjas disponibles' : 'No admite reservas' }}
                </span>
              </div>
            </div>

            <!-- Hours Input Controls (Active when open) -->
            @if (day.isOpen) {
              <div class="flex flex-wrap items-center gap-3 sm:gap-4 font-mono text-xs">
                <!-- Opening Time -->
                <div class="flex items-center gap-2">
                  <span class="text-slate-400 text-[11px] uppercase tracking-wider">Abre:</span>
                  <input
                    type="time"
                    [(ngModel)]="day.opens_at"
                    (ngModelChange)="onTimeChanged()"
                    class="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:outline-none focus:border-[#0056FB] focus:ring-2 focus:ring-[#0056FB]/10 shadow-2xs"
                  />
                </div>

                <!-- Closing Time -->
                <div class="flex items-center gap-2">
                  <span class="text-slate-400 text-[11px] uppercase tracking-wider">Cierra:</span>
                  <input
                    type="time"
                    [(ngModel)]="day.closes_at"
                    (ngModelChange)="onTimeChanged()"
                    class="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:outline-none focus:border-[#0056FB] focus:ring-2 focus:ring-[#0056FB]/10 shadow-2xs"
                  />
                </div>

                <!-- Closes next day checkbox -->
                <label class="flex items-center gap-1.5 text-slate-500 cursor-pointer select-none text-[11px]">
                  <input
                    type="checkbox"
                    [(ngModel)]="day.closes_next_day"
                    (ngModelChange)="onTimeChanged()"
                    class="rounded border-slate-300 text-[#0056FB] focus:ring-[#0056FB]"
                  />
                  <span>Cierra al día siguiente (madrugada)</span>
                </label>
              </div>
            } @else {
              <!-- Closed State Placard -->
              <div class="flex items-center gap-2 text-slate-400 font-mono text-xs italic">
                <span>🚫</span>
                <span>Instalaciones cerradas al público durante todo el día</span>
              </div>
            }
          </div>
        }
      </div>

      <!-- Quick Actions Footer -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-mono p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
        <div class="flex items-center gap-3">
          <button
            type="button"
            (click)="setAllDaysOpen(true)"
            class="text-[#0056FB] hover:underline font-medium"
          >
            ✓ Abrir todos los días
          </button>
          <span class="text-slate-300">|</span>
          <button
            type="button"
            (click)="setWeekdaysOnly()"
            class="text-[#0056FB] hover:underline font-medium"
          >
            Lunes a Viernes únicamente
          </button>
        </div>

        <span class="text-[11px] text-slate-400">
          Recuerda guardar los cambios para aplicarlos al portal público
        </span>
      </div>
    </div>
  `
})
export class ClubBusinessHoursManagerComponent implements OnChanges {
  @Input() hours: BusinessHoursAdminResponse[] = [];
  @Input() isSaving = false;
  @Output() save = new EventEmitter<BusinessHourItem[]>();

  readonly days = signal<DayConfig[]>(
    DEFAULT_DAYS.map((d) => ({
      weekday: d.weekday,
      name: d.name,
      shortName: d.shortName,
      isOpen: true,
      opens_at: '06:00',
      closes_at: '23:00',
      closes_next_day: false
    }))
  );

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['hours'] && this.hours) {
      this.syncWithBackendHours(this.hours);
    }
  }

  openDaysCount(): number {
    return this.days().filter((d) => d.isOpen).length;
  }

  syncWithBackendHours(backendHours: BusinessHoursAdminResponse[]): void {
    const updated: DayConfig[] = DEFAULT_DAYS.map((d) => {
      const match = backendHours.find((h) => h.weekday === d.weekday);
      if (match) {
        return {
          weekday: d.weekday,
          name: d.name,
          shortName: d.shortName,
          isOpen: true,
          opens_at: match.opens_at.slice(0, 5),
          closes_at: match.closes_at.slice(0, 5),
          closes_next_day: match.closes_next_day
        };
      } else {
        // If the day is absent in backend, it is closed
        return {
          weekday: d.weekday,
          name: d.name,
          shortName: d.shortName,
          isOpen: false,
          opens_at: '06:00',
          closes_at: '23:00',
          closes_next_day: false
        };
      }
    });

    this.days.set(updated);
  }

  toggleDayOpen(idx: number): void {
    const current = [...this.days()];
    current[idx] = {
      ...current[idx],
      isOpen: !current[idx].isOpen
    };
    this.days.set(current);
  }

  onTimeChanged(): void {
    // Triggers local change detection if needed
    this.days.set([...this.days()]);
  }

  copyMondayToAll(): void {
    const current = [...this.days()];
    const monday = current.find((d) => d.weekday === 0);
    if (!monday) return;

    const updated = current.map((d) => {
      if (d.isOpen && d.weekday !== 0) {
        return {
          ...d,
          opens_at: monday.opens_at,
          closes_at: monday.closes_at,
          closes_next_day: monday.closes_next_day
        };
      }
      return d;
    });
    this.days.set(updated);
  }

  setAllDaysOpen(open: boolean): void {
    const updated = this.days().map((d) => ({
      ...d,
      isOpen: open,
      opens_at: d.opens_at || '06:00',
      closes_at: d.closes_at || '23:00'
    }));
    this.days.set(updated);
  }

  setWeekdaysOnly(): void {
    const updated = this.days().map((d) => ({
      ...d,
      isOpen: d.weekday >= 0 && d.weekday <= 4 // Monday to Friday
    }));
    this.days.set(updated);
  }

  saveHours(): void {
    // Only send days that are marked as open
    const payload: BusinessHourItem[] = this.days()
      .filter((d) => d.isOpen)
      .map((d) => ({
        weekday: d.weekday,
        opens_at: d.opens_at.length === 5 ? `${d.opens_at}:00` : d.opens_at,
        closes_at: d.closes_at.length === 5 ? `${d.closes_at}:00` : d.closes_at,
        closes_next_day: d.closes_next_day
      }));

    this.save.emit(payload);
  }
}
