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
import { ClubStaffCreate, ClubStaffMember } from '../../services/club-admin.service';

@Component({
  selector: 'app-club-staff-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Section Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="font-serif italic text-xl text-slate-900">Personal & Recepcionistas</h2>
            <span class="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0056FB] border border-blue-200 text-[10px] font-mono tracking-wider uppercase font-medium">
              {{ staffList.length }} Miembros
            </span>
          </div>
          <p class="text-xs text-slate-500 font-sans mt-0.5">
            Alta y gestión de cuentas para recepcionistas de mostrador y administradores de sede
          </p>
        </div>

        <button
          type="button"
          (click)="openCreateModal()"
          class="px-4 py-2.5 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] text-white font-medium text-xs tracking-wider uppercase font-mono transition-all duration-300 shadow-md flex items-center justify-center gap-2 active:scale-95"
        >
          <span>+ Nuevo Recepcionista</span>
        </button>
      </div>

      <!-- Staff Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        @for (member of staffList; track member.id) {
          <div class="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs hover:border-[#0056FB]/50 transition-all duration-300 flex flex-col justify-between">
            <div class="space-y-4">
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center font-mono text-sm text-slate-700 shadow-xs">
                    {{ member.user_full_name.slice(0, 2).toUpperCase() }}
                  </div>
                  <div>
                    <h3 class="font-sans font-semibold text-slate-900 text-sm">
                      {{ member.user_full_name }}
                    </h3>
                    <p class="text-xs font-mono text-slate-500 truncate max-w-[180px]">
                      {{ member.user_email }}
                    </p>
                  </div>
                </div>

                <span
                  class="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold border"
                  [ngClass]="getRoleBadgeClass(member.role)"
                >
                  {{ member.role === 'admin' ? 'Administrador' : (member.role === 'owner' ? 'Dueño' : 'Recepcionista') }}
                </span>
              </div>

              <div class="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-mono space-y-1.5">
                <div class="flex justify-between text-slate-500">
                  <span>Teléfono:</span>
                  <span class="text-slate-800">{{ member.user_phone || 'No registrado' }}</span>
                </div>
                <div class="flex justify-between text-slate-500">
                  <span>Estado:</span>
                  <span class="text-emerald-700 font-semibold">Activo</span>
                </div>
              </div>
            </div>

            <!-- Delete / Remove Action -->
            <div class="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
              <span class="text-[10px] font-mono text-slate-400">
                Alta: {{ member.created_at | date:'mediumDate' }}
              </span>

              <button
                type="button"
                (click)="deleteStaff.emit(member.id)"
                class="text-xs font-mono uppercase tracking-wider text-rose-500 hover:text-rose-800 transition-colors"
                title="Revocar acceso al club"
              >
                Eliminar
              </button>
            </div>
          </div>
        }
      </div>

      <!-- MODAL: CREAR RECEPCIONISTA / STAFF -->
      @if (showModal()) {
        <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-lg p-7 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 font-sans text-slate-900">
            <div class="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span class="text-[10px] uppercase tracking-[0.2em] text-[#0056FB] font-mono font-semibold block">
                  Equipo de Club
                </span>
                <h3 class="font-serif italic text-2xl text-slate-900">
                  Registrar Recepcionista
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
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  [(ngModel)]="form.full_name"
                  name="staffFullName"
                  placeholder="Ej: Laura Gómez (Turno Mañana)"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                />
              </div>

              <div>
                <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
                  Correo Electrónico (Login) *
                </label>
                <input
                  type="email"
                  required
                  [(ngModel)]="form.email"
                  name="staffEmail"
                  placeholder="laura.recepcion@club.com"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
                    Contraseña Inicial *
                  </label>
                  <input
                    type="password"
                    required
                    [(ngModel)]="form.password"
                    name="staffPass"
                    placeholder="••••••••••••"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  />
                </div>

                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    [(ngModel)]="form.phone"
                    name="staffPhone"
                    placeholder="+57 300 000 0000"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
                  Rol en la Sede
                </label>
                <select
                  [(ngModel)]="form.role"
                  name="staffRole"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                >
                  <option value="staff">📋 Recepcionista / Staff (Atención & Turnos)</option>
                  <option value="admin">🏢 Administrador de Club (Control Total de Sede)</option>
                </select>
              </div>

              <div class="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-slate-600 font-sans">
                💡 El recepcionista podrá iniciar sesión en <strong>/auth/login</strong> con este correo y contraseña para atender el mostrador y gestionar la ocupación.
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
                  [disabled]="!form.full_name || !form.email || !form.password"
                  class="flex-1 py-3 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] disabled:opacity-40 text-white font-medium text-xs font-mono uppercase tracking-wider transition-all shadow-md"
                >
                  Crear Recepcionista
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class ClubStaffManagerComponent {
  @Input({ required: true }) staffList: ClubStaffMember[] = [];
  @Output() saveStaff = new EventEmitter<ClubStaffCreate>();
  @Output() deleteStaff = new EventEmitter<string>();

  readonly showModal = signal<boolean>(false);

  form: ClubStaffCreate = {
    full_name: '',
    email: '',
    password: '',
    phone: '',
    role: 'staff'
  };

  openCreateModal(): void {
    this.form = {
      full_name: '',
      email: '',
      password: '',
      phone: '',
      role: 'staff'
    };
    this.showModal.set(true);
  }

  submitForm(): void {
    if (!this.form.full_name.trim() || !this.form.email.trim() || !this.form.password?.trim()) return;
    this.saveStaff.emit({ ...this.form });
    this.showModal.set(false);
  }

  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'owner':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'admin':
        return 'bg-blue-50 text-[#0056FB] border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  }
}
