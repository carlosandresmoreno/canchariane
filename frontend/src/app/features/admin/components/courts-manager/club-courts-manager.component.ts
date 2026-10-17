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
import { AdminCourt, AdminCourtCreate } from '../../services/club-admin.service';

@Component({
  selector: 'app-club-courts-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Section Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="font-serif italic text-xl text-slate-900">Catálogo de Canchas</h2>
            <span class="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0056FB] border border-blue-200 text-[10px] font-mono tracking-wider uppercase font-medium">
              {{ courts.length }} Pistas
            </span>
          </div>
          <p class="text-xs text-slate-500 font-sans mt-0.5">
            Configuración de pistas deportivas, superficies, iluminación y disponibilidad
          </p>
        </div>

        <button
          type="button"
          (click)="openCreateModal()"
          class="px-4 py-2.5 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] text-white font-medium text-xs tracking-wider uppercase font-mono transition-all duration-300 shadow-md flex items-center justify-center gap-2 active:scale-95"
        >
          <span>+ Nueva Cancha</span>
        </button>
      </div>

      <!-- Courts Grid Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        @for (court of courts; track court.id) {
          <div class="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs hover:border-[#0056FB]/50 transition-all duration-300 flex flex-col justify-between group">
            <div class="space-y-4">
              <!-- Top Row -->
              <div class="flex items-start justify-between">
                <div>
                  <span class="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                    Posición #{{ court.position }}
                  </span>
                  <h3 class="font-serif italic text-xl text-slate-900 font-medium group-hover:text-[#0056FB] transition-colors">
                    {{ court.name }}
                  </h3>
                </div>

                <span
                  class="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold border"
                  [ngClass]="court.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'"
                >
                  {{ court.is_active ? 'Activa' : 'Pausada' }}
                </span>
              </div>

              <!-- Badges Info -->
              <div class="grid grid-cols-3 gap-2 text-xs font-mono">
                <div class="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span class="text-[9px] uppercase tracking-wider text-slate-400 block">Deporte</span>
                  <span class="font-semibold text-slate-800 capitalize">{{ getSportLabel(court.sport) }}</span>
                </div>
                <div class="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span class="text-[9px] uppercase tracking-wider text-slate-400 block">Formato</span>
                  <span class="font-semibold text-slate-800 truncate block">{{ formatPlayerFormat(court.player_format) }}</span>
                </div>
                <div class="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span class="text-[9px] uppercase tracking-wider text-slate-400 block">Superficie</span>
                  <span class="font-semibold text-slate-800 truncate block">{{ getSurfaceLabel(court.surface) }}</span>
                </div>
              </div>

              <!-- Features -->
              <div class="flex items-center gap-3 text-xs text-slate-600 font-mono">
                <span class="flex items-center gap-1.5" [class.text-[#0056FB]]="court.is_covered">
                  <span>{{ court.is_covered ? '✓' : '✗' }}</span>
                  <span>{{ court.is_covered ? 'Techada' : 'Descubierta' }}</span>
                </span>
                <span>•</span>
                <span class="flex items-center gap-1.5" [class.text-[#0056FB]]="court.has_lighting">
                  <span>{{ court.has_lighting ? '💡' : '🌑' }}</span>
                  <span>{{ court.has_lighting ? 'Con Iluminación' : 'Sin Luz' }}</span>
                </span>
              </div>
            </div>

            <!-- Actions -->
            <div class="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                (click)="toggleActive.emit(court)"
                class="text-xs font-mono uppercase tracking-wider text-slate-500 hover:text-slate-900 transition-colors"
              >
                {{ court.is_active ? 'Desactivar' : 'Reactivar' }}
              </button>

              <button
                type="button"
                (click)="openEditModal(court)"
                class="px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-mono uppercase tracking-wider transition-colors"
              >
                Editar
              </button>
            </div>
          </div>
        }
      </div>

      <!-- MODAL: CREAR / EDITAR CANCHA -->
      @if (showModal()) {
        <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-lg p-7 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 font-sans text-slate-900">
            <div class="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span class="text-[10px] uppercase tracking-[0.2em] text-[#0056FB] font-mono font-semibold block">
                  {{ isEditing() ? 'Editar Pista' : 'Nueva Pista' }}
                </span>
                <h3 class="font-serif italic text-2xl text-slate-900">
                  {{ isEditing() ? form.name : 'Configurar Cancha' }}
                </h3>
              </div>
              <button
                type="button"
                (click)="showModal.set(false)"
                class="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            <form (ngSubmit)="submitForm()" class="space-y-4">
              <div>
                <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
                  Nombre de la Cancha *
                </label>
                <input
                  type="text"
                  required
                  [(ngModel)]="form.name"
                  name="courtName"
                  placeholder="Ej: Cancha Central #1"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
                    Deporte
                  </label>
                  <select
                    [(ngModel)]="form.sport"
                    name="courtSport"
                    (ngModelChange)="onSportChange($event)"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  >
                    <option value="football">⚽ Fútbol</option>
                    <option value="padel">🎾 Pádel</option>
                    <option value="tennis">🎾 Tenis</option>
                    <option value="pickleball">🏓 Pickleball</option>
                    <option value="basketball">🏀 Baloncesto</option>
                    <option value="volleyball">🏐 Voleibol</option>
                    <option value="squash">🏸 Squash</option>
                  </select>
                </div>

                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
                    Superficie
                  </label>
                  <select
                    [(ngModel)]="form.surface"
                    name="courtSurface"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  >
                    <option value="synthetic_grass">Césped Sintético</option>
                    <option value="turf">Gramilla Natural</option>
                    <option value="clay">Polvo de Ladrillo (Clay)</option>
                    <option value="hard_court">Pista Dura / Resina</option>
                    <option value="wood">Madera / Parquet</option>
                    <option value="rubber">Poliuretano / Caucho</option>
                    <option value="sand">Arena (Playa)</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
                    Posición / Orden
                  </label>
                  <input
                    type="number"
                    [(ngModel)]="form.position"
                    name="courtPos"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  />
                </div>

                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
                    Formato Juego
                  </label>
                  <select
                    [(ngModel)]="form.player_format"
                    name="courtFormat"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  >
                    <optgroup label="⚽ Fútbol / Deportes de Equipo">
                      <option value="5x5">Fútbol 5 / Micro (5 vs 5)</option>
                      <option value="6x6">Fútbol 6 (6 vs 6)</option>
                      <option value="7x7">Fútbol 7 (7 vs 7)</option>
                      <option value="8x8">Fútbol 8 (8 vs 8)</option>
                      <option value="9x9">Fútbol 9 (9 vs 9)</option>
                      <option value="11x11">Fútbol 11 (11 vs 11)</option>
                    </optgroup>
                    <optgroup label="🎾 Raqueta / Parejas">
                      <option value="doubles">Dobles (Parejas / 4 Jugadores)</option>
                      <option value="singles">Individual (Singles / 2 Jugadores)</option>
                    </optgroup>
                    <optgroup label="🏀 Baloncesto & Vóley">
                      <option value="3x3">3 vs 3 (Media Cancha / Street)</option>
                      <option value="5x5">5 vs 5 (Cancha Completa)</option>
                      <option value="2x2">2 vs 2 (Vóley Playa)</option>
                      <option value="6x6">6 vs 6 (Vóley Sala)</option>
                    </optgroup>
                    <optgroup label="Otros">
                      <option value="custom">Formato Libre / Personalizado</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="covered"
                    [(ngModel)]="form.is_covered"
                    name="isCovered"
                    class="w-4 h-4 rounded text-[#0056FB]"
                  />
                  <label for="covered" class="text-xs font-mono text-slate-700 cursor-pointer">
                    Cancha Techada / Cubierta
                  </label>
                </div>

                <div class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="lighting"
                    [(ngModel)]="form.has_lighting"
                    name="hasLighting"
                    class="w-4 h-4 rounded text-[#0056FB]"
                  />
                  <label for="lighting" class="text-xs font-mono text-slate-700 cursor-pointer">
                    Dispone de Iluminación Nocturna LED
                  </label>
                </div>
              </div>

              <div class="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  (click)="showModal.set(false)"
                  class="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-mono uppercase tracking-wider hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  [disabled]="!form.name"
                  class="flex-1 py-3 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] disabled:opacity-40 text-white font-medium text-xs font-mono uppercase tracking-wider transition-all shadow-md"
                >
                  {{ isEditing() ? 'Guardar Cambios' : 'Crear Cancha' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class ClubCourtsManagerComponent {
  @Input({ required: true }) courts: AdminCourt[] = [];
  @Output() saveCourt = new EventEmitter<{ courtId?: string; data: AdminCourtCreate }>();
  @Output() toggleActive = new EventEmitter<AdminCourt>();

  readonly showModal = signal<boolean>(false);
  readonly isEditing = signal<boolean>(false);
  selectedCourtId: string | null = null;

  form: AdminCourtCreate = {
    name: '',
    sport: 'football',
    surface: 'synthetic_grass',
    player_format: '5x5',
    is_covered: false,
    has_lighting: true,
    position: 1
  };

  onSportChange(sport: string): void {
    if (sport === 'football') {
      if (!['5x5', '6x6', '7x7', '8x8', '9x9', '11x11'].includes(this.form.player_format)) {
        this.form.player_format = '5x5';
      }
      if (this.form.surface !== 'synthetic_grass' && this.form.surface !== 'turf') {
        this.form.surface = 'synthetic_grass';
      }
    } else if (sport === 'padel' || sport === 'pickleball') {
      if (!['doubles', 'singles'].includes(this.form.player_format)) {
        this.form.player_format = 'doubles';
      }
    } else if (sport === 'tennis') {
      if (!['doubles', 'singles'].includes(this.form.player_format)) {
        this.form.player_format = 'singles';
      }
    } else if (sport === 'basketball') {
      if (!['3x3', '5x5'].includes(this.form.player_format)) {
        this.form.player_format = '5x5';
      }
      this.form.surface = 'hard_court';
    } else if (sport === 'volleyball') {
      if (!['2x2', '6x6'].includes(this.form.player_format)) {
        this.form.player_format = '6x6';
      }
    }
  }

  getSportLabel(sport: string): string {
    switch (sport) {
      case 'football': return 'Fútbol';
      case 'padel': return 'Pádel';
      case 'tennis': return 'Tenis';
      case 'pickleball': return 'Pickleball';
      case 'basketball': return 'Baloncesto';
      case 'volleyball': return 'Voleibol';
      case 'squash': return 'Squash';
      default: return sport;
    }
  }

  getSurfaceLabel(surface: string): string {
    switch (surface) {
      case 'synthetic_grass': return 'Césped Sintético';
      case 'turf': return 'Gramilla Natural';
      case 'clay': return 'Polvo de Ladrillo';
      case 'hard_court': return 'Pista Dura';
      case 'wood': return 'Madera / Parquet';
      case 'rubber': return 'Poliuretano';
      case 'sand': return 'Arena';
      default: return surface;
    }
  }

  formatPlayerFormat(fmt: string): string {
    switch (fmt) {
      case '5x5': return 'Fútbol 5 (5x5)';
      case '6x6': return 'Fútbol 6 (6x6)';
      case '7x7': return 'Fútbol 7 (7x7)';
      case '8x8': return 'Fútbol 8 (8x8)';
      case '9x9': return 'Fútbol 9 (9x9)';
      case '11x11': return 'Fútbol 11 (11x11)';
      case 'doubles': return 'Dobles (4P)';
      case 'singles': return 'Individual (2P)';
      case '3x3': return '3 vs 3';
      case '2x2': return '2 vs 2';
      case 'custom': return 'Libre';
      default: return fmt;
    }
  }

  openCreateModal(): void {
    this.isEditing.set(false);
    this.selectedCourtId = null;
    this.form = {
      name: '',
      sport: 'football',
      surface: 'synthetic_grass',
      player_format: '5x5',
      is_covered: false,
      has_lighting: true,
      position: this.courts.length + 1
    };
    this.showModal.set(true);
  }

  openEditModal(court: AdminCourt): void {
    this.isEditing.set(true);
    this.selectedCourtId = court.id;
    this.form = {
      name: court.name,
      sport: court.sport,
      surface: court.surface,
      player_format: court.player_format,
      is_covered: court.is_covered,
      has_lighting: court.has_lighting,
      position: court.position
    };
    this.showModal.set(true);
  }

  submitForm(): void {
    if (!this.form.name.trim()) return;
    this.saveCourt.emit({
      courtId: this.selectedCourtId ?? undefined,
      data: { ...this.form }
    });
    this.showModal.set(false);
  }
}
