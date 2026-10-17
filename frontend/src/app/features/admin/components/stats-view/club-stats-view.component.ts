import {
  ChangeDetectionStrategy,
  Component,
  Input
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminCourt } from '../../services/club-admin.service';

@Component({
  selector: 'app-club-stats-view',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Section Header -->
      <div class="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs">
        <div class="flex items-center gap-2">
          <h2 class="font-serif italic text-xl text-slate-900">Rendimiento & Métricas del Club</h2>
          <span class="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0056FB] border border-blue-200 text-[10px] font-mono tracking-wider uppercase font-medium">
            KPIs de Gestión
          </span>
        </div>
        <p class="text-xs text-slate-500 font-sans mt-0.5">
          Resumen ejecutivo de recaudación, demanda horaria y utilización de pistas
        </p>
      </div>

      <!-- KPI Monoliths -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div class="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs group hover:border-[#0056FB]/40 transition-all duration-300">
          <span class="text-[10px] text-slate-400 uppercase font-mono tracking-[0.2em] block mb-2">Tasa Ocupación</span>
          <div class="text-3xl sm:text-4xl font-serif italic text-slate-900">
            {{ occupancyPct }}%
          </div>
          <span class="text-[11px] text-slate-500 font-mono mt-1 block">Capacidad de pista hoy</span>
        </div>

        <div class="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs group hover:border-[#0056FB]/40 transition-all duration-300">
          <span class="text-[10px] text-slate-400 uppercase font-mono tracking-[0.2em] block mb-2">Recaudación Estimada</span>
          <div class="text-3xl sm:text-4xl font-serif italic text-slate-900">
            {{ formatCents(totalRevenueCents) }}
          </div>
          <span class="text-[11px] text-slate-500 font-mono mt-1 block">Ingresos de la jornada</span>
        </div>

        <div class="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs group hover:border-[#0056FB]/40 transition-all duration-300">
          <span class="text-[10px] text-slate-400 uppercase font-mono tracking-[0.2em] block mb-2">Partidos Agendados</span>
          <div class="text-3xl sm:text-4xl font-serif italic text-slate-900">
            {{ totalBookings }}
          </div>
          <span class="text-[11px] text-slate-500 font-mono mt-1 block">Turnos reservados</span>
        </div>

        <div class="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs group hover:border-[#0056FB]/40 transition-all duration-300">
          <span class="text-[10px] text-slate-400 uppercase font-mono tracking-[0.2em] block mb-2">Pistas Activas</span>
          <div class="text-3xl sm:text-4xl font-serif italic text-slate-900">
            {{ courts.length }}
          </div>
          <span class="text-[11px] text-slate-500 font-mono mt-1 block">Canchas en producción</span>
        </div>
      </div>

      <!-- Court Performance Breakdown -->
      <div class="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        <h3 class="font-serif italic text-lg text-slate-900">Distribución por Cancha</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs font-mono">
            <thead>
              <tr class="border-b border-slate-200 text-slate-400 uppercase tracking-wider text-[10px]">
                <th class="py-3 px-4">Cancha</th>
                <th class="py-3 px-4">Deporte</th>
                <th class="py-3 px-4">Superficie</th>
                <th class="py-3 px-4 text-center">Estado</th>
                <th class="py-3 px-4 text-right">Rendimiento</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (court of courts; track court.id) {
                <tr class="hover:bg-slate-50/60 transition-colors">
                  <td class="py-3.5 px-4 font-semibold text-slate-900 font-sans text-sm">
                    {{ court.name }}
                  </td>
                  <td class="py-3.5 px-4 text-slate-600 capitalize">
                    {{ court.sport }}
                  </td>
                  <td class="py-3.5 px-4 text-slate-600 capitalize">
                    {{ court.surface }}
                  </td>
                  <td class="py-3.5 px-4 text-center">
                    <span
                      class="px-2 py-0.5 rounded-full text-[10px] uppercase font-semibold border"
                      [ngClass]="court.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'"
                    >
                      {{ court.is_active ? 'Activa' : 'Pausada' }}
                    </span>
                  </td>
                  <td class="py-3.5 px-4 text-right font-medium text-slate-800">
                    Operativa 100%
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class ClubStatsViewComponent {
  @Input({ required: true }) courts: AdminCourt[] = [];
  @Input({ required: true }) occupancyPct = 0;
  @Input({ required: true }) totalRevenueCents = 0;
  @Input({ required: true }) totalBookings = 0;

  formatCents(cents: number): string {
    return (cents / 100).toLocaleString('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    });
  }
}
