import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  AdminCourt,
  ClubAdminService,
  ClubOccupancyReport,
  ClubRevenueReport,
  DailyStoreSale
} from '../../services/club-admin.service';

export type StatsFilterPreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

@Component({
  selector: 'app-club-stats-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4 sm:space-y-6 max-w-5xl mx-auto">
      <!-- Minimalist Header & Filter Bar -->
      <div class="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3.5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="font-serif italic text-lg sm:text-xl text-slate-900 tracking-tight">
                Estadísticas & Finanzas
              </h2>
              <span class="px-2 py-0.5 rounded-full bg-blue-50 text-[#0056FB] border border-blue-200/80 text-[10px] font-mono font-medium tracking-wide">
                {{ periodLabel() }}
              </span>
            </div>
            <p class="text-xs text-slate-500 font-sans mt-0.5">
              Métricas consolidadas de canchas, ocupación y ventas de tienda
            </p>
          </div>

          <!-- Subtle Status / Loading indicator -->
          <div class="flex items-center gap-2 self-start sm:self-auto">
            @if (isLoading()) {
              <span class="inline-flex items-center gap-1.5 text-xs font-mono text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 animate-pulse">
                <svg class="animate-spin h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Actualizando...
              </span>
            } @else {
              <span class="text-[11px] font-mono text-slate-400">
                {{ startDate() === endDate() ? startDate() : startDate() + ' al ' + endDate() }}
              </span>
            }
          </div>
        </div>

        <!-- Quick Filter Pills (Mobile horizontal scroll friendly) -->
        <div class="pt-2 border-t border-slate-100">
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            <button
              type="button"
              (click)="setPreset('today')"
              [class]="selectedPreset() === 'today'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/70'"
              class="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold font-mono tracking-tight transition-all active:scale-95"
            >
              Hoy
            </button>
            <button
              type="button"
              (click)="setPreset('yesterday')"
              [class]="selectedPreset() === 'yesterday'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/70'"
              class="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold font-mono tracking-tight transition-all active:scale-95"
            >
              Ayer
            </button>
            <button
              type="button"
              (click)="setPreset('week')"
              [class]="selectedPreset() === 'week'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/70'"
              class="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold font-mono tracking-tight transition-all active:scale-95"
            >
              Esta Semana
            </button>
            <button
              type="button"
              (click)="setPreset('month')"
              [class]="selectedPreset() === 'month'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/70'"
              class="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold font-mono tracking-tight transition-all active:scale-95"
            >
              Este Mes
            </button>
            <button
              type="button"
              (click)="setPreset('custom')"
              [class]="selectedPreset() === 'custom'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/70'"
              class="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold font-mono tracking-tight transition-all active:scale-95 flex items-center gap-1"
            >
              <span>📅</span>
              <span>Personalizado</span>
            </button>
          </div>

          <!-- Custom Date Range Expandable Drawer -->
          @if (selectedPreset() === 'custom') {
            <div class="mt-3 p-3 rounded-2xl bg-slate-50/90 border border-slate-200/80 animate-in fade-in">
              <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                <div class="sm:col-span-5">
                  <label class="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                    Fecha Inicio
                  </label>
                  <input
                    type="date"
                    [(ngModel)]="customStartDate"
                    class="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#0056FB]"
                  />
                </div>
                <div class="sm:col-span-5">
                  <label class="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                    Fecha Fin
                  </label>
                  <input
                    type="date"
                    [(ngModel)]="customEndDate"
                    class="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#0056FB]"
                  />
                </div>
                <div class="sm:col-span-2">
                  <button
                    type="button"
                    (click)="applyCustomFilter()"
                    class="w-full py-2 px-3 rounded-xl bg-[#0056FB] text-white text-xs font-mono font-semibold uppercase tracking-wider hover:bg-blue-600 active:scale-95 transition-all shadow-xs"
                  >
                    Filtrar
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- KPI Monoliths (2x2 on mobile, 4 columns on desktop) -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <!-- 1. Recaudación Canchas -->
        <div class="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:border-[#0056FB]/30 transition-all flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-1 sm:mb-2">
              <span class="text-[9px] sm:text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                Canchas
              </span>
              <span class="text-xs sm:text-sm">⚽</span>
            </div>
            <div class="text-lg sm:text-2xl font-serif italic text-slate-900 tracking-tight leading-snug">
              {{ formatCents(effectiveRevenueCents()) }}
            </div>
          </div>
          <span class="text-[10px] sm:text-[11px] text-slate-500 font-mono mt-2 block">
            {{ effectiveBookingsCount() }} turnos reservados
          </span>
        </div>

        <!-- 2. Ventas Tienda -->
        <div class="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:border-emerald-500/30 transition-all flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-1 sm:mb-2">
              <span class="text-[9px] sm:text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                Tienda / Café
              </span>
              <span class="text-xs sm:text-sm">🏪</span>
            </div>
            <div class="text-lg sm:text-2xl font-serif italic text-emerald-600 tracking-tight leading-snug">
              {{ formatCents(storeRevenueCents()) }}
            </div>
          </div>
          <span class="text-[10px] sm:text-[11px] text-slate-500 font-mono mt-2 block">
            {{ storeSalesInPeriod().length }} cierres registrados
          </span>
        </div>

        <!-- 3. Consolidado Total (Hero Card) -->
        <div class="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-blue-50/90 to-indigo-50/50 border border-blue-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-1 sm:mb-2">
              <span class="text-[9px] sm:text-[10px] text-[#0056FB] uppercase font-mono tracking-wider font-bold">
                Consolidado
              </span>
              <span class="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-blue-100/70 text-blue-800 font-semibold">
                Total
              </span>
            </div>
            <div class="text-lg sm:text-2xl font-serif italic text-[#0056FB] tracking-tight leading-snug">
              {{ formatCents(consolidatedTotalCents()) }}
            </div>
          </div>
          <span class="text-[10px] sm:text-[11px] text-slate-600 font-mono mt-2 block">
            Canchas + Tienda
          </span>
        </div>

        <!-- 4. Tasa Ocupación -->
        <div class="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:border-[#0056FB]/30 transition-all flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-1 sm:mb-2">
              <span class="text-[9px] sm:text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                Ocupación
              </span>
              <span class="text-xs sm:text-sm">📊</span>
            </div>
            <div class="text-lg sm:text-2xl font-serif italic text-slate-900 tracking-tight leading-snug">
              {{ effectiveOccupancyPct() }}%
            </div>
          </div>
          <span class="text-[10px] sm:text-[11px] text-slate-500 font-mono mt-2 block">
            {{ courts.length }} pistas en producción
          </span>
        </div>
      </div>

      <!-- 🏪 REGISTRO Y SEGUIMIENTO DE TIENDA / CAFETERÍA -->
      <div class="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div class="flex items-center gap-2">
            <span class="text-base sm:text-lg">🏪</span>
            <div>
              <h3 class="font-serif italic text-base sm:text-lg text-slate-900">
                Cierres de Tienda & Cafetería
              </h3>
              <p class="text-[11px] sm:text-xs text-slate-500 font-sans">
                Registra el total vendido al final del día para la trazabilidad financiera
              </p>
            </div>
          </div>

          @if (saveSuccess()) {
            <span class="self-start sm:self-auto px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-mono font-medium animate-in fade-in">
              ✓ Cierre guardado
            </span>
          }
        </div>

        <!-- Quick Form (Mobile optimized) -->
        <form (ngSubmit)="submitStoreSale()" class="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50/80 border border-slate-200/70">
          <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
            <div class="sm:col-span-3">
              <label class="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                Fecha de Venta *
              </label>
              <input
                type="date"
                required
                [(ngModel)]="saleDateInput"
                name="saleDateInput"
                class="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-mono font-medium focus:outline-none focus:border-[#0056FB]"
              />
            </div>

            <div class="sm:col-span-4">
              <label class="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                Total Vendido (COP) *
              </label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">$</span>
                <input
                  type="number"
                  step="1000"
                  min="0"
                  required
                  [(ngModel)]="saleAmountCop"
                  name="saleAmountCop"
                  placeholder="Ej: 150000"
                  class="w-full pl-7 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-mono font-semibold focus:outline-none focus:border-[#0056FB]"
                />
              </div>
            </div>

            <div class="sm:col-span-3">
              <label class="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                Notas / Concepto
              </label>
              <input
                type="text"
                [(ngModel)]="saleNotes"
                name="saleNotes"
                placeholder="Ej: Bebidas y snacks"
                class="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-sans focus:outline-none focus:border-[#0056FB]"
              />
            </div>

            <div class="sm:col-span-2">
              <button
                type="submit"
                [disabled]="isSavingSale() || saleAmountCop === null || saleAmountCop < 0"
                class="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-xs flex items-center justify-center gap-1 active:scale-95"
              >
                <span>{{ isSavingSale() ? '...' : '+ Guardar' }}</span>
              </button>
            </div>
          </div>
        </form>

        <!-- Store Sales List for the Selected Period (Mobile-first card stack, no table overflow) -->
        <div class="space-y-2 pt-1">
          <div class="flex items-center justify-between text-xs font-mono text-slate-500 px-0.5">
            <span>Cierres en este período ({{ storeSalesInPeriod().length }})</span>
            <span>Subtotal: <strong class="text-slate-900">{{ formatCents(storeRevenueCents()) }}</strong></span>
          </div>

          @if (storeSalesInPeriod().length === 0) {
            <div class="py-6 px-4 text-center rounded-2xl bg-slate-50/50 border border-dashed border-slate-200 text-xs text-slate-400 font-sans">
              No hay cierres de tienda registrados para este período.
            </div>
          } @else {
            <div class="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
              @for (sale of storeSalesInPeriod(); track sale.id) {
                <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 hover:bg-slate-50 border border-slate-200/70 transition-colors">
                  <div class="min-w-0 pr-3">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-xs font-mono font-bold text-slate-900">
                        {{ sale.sale_date }}
                      </span>
                      <span class="text-xs font-mono font-bold text-emerald-600">
                        {{ formatCents(sale.amount_cents) }}
                      </span>
                    </div>
                    @if (sale.notes) {
                      <p class="text-[11px] text-slate-500 font-sans truncate mt-0.5">
                        {{ sale.notes }}
                      </p>
                    }
                  </div>

                  <button
                    type="button"
                    (click)="deleteStoreSale(sale.id)"
                    class="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors text-xs"
                    title="Eliminar cierre"
                  >
                    ✕
                  </button>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- Court Performance Breakdown (Clean Mobile-first cards, zero horizontal table overflow) -->
      <div class="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3.5">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 class="font-serif italic text-base sm:text-lg text-slate-900">
              Rendimiento por Cancha
            </h3>
            <p class="text-[11px] sm:text-xs text-slate-500 font-sans">
              Utilización y recaudación por pista en el período seleccionado
            </p>
          </div>
          <span class="text-[11px] font-mono text-slate-400">
            {{ courts.length }} Pistas
          </span>
        </div>

        <div class="space-y-2">
          @for (court of courtPerformanceList(); track court.id) {
            <div class="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white hover:bg-slate-50/70 border border-slate-200/70 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <!-- Court Info -->
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 flex items-center justify-center text-sm shrink-0">
                  {{ court.sport === 'padel' ? '🎾' : '⚽' }}
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h4 class="text-xs sm:text-sm font-semibold text-slate-900 font-sans">
                      {{ court.name }}
                    </h4>
                    <span
                      class="px-1.5 py-0.2 rounded-full text-[9px] font-mono uppercase font-semibold border"
                      [ngClass]="court.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'"
                    >
                      {{ court.is_active ? 'Activa' : 'Pausada' }}
                    </span>
                  </div>
                  <span class="text-[10px] sm:text-[11px] text-slate-400 capitalize font-mono">
                    {{ court.sport }} • {{ court.surface }}
                  </span>
                </div>
              </div>

              <!-- Court Metrics (Progress bar + Revenue) -->
              <div class="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <!-- Occupancy Rate -->
                <div class="text-left sm:text-right">
                  <span class="text-[9px] sm:text-[10px] font-mono uppercase text-slate-400 block mb-0.5">
                    Ocupación
                  </span>
                  <div class="flex items-center gap-1.5">
                    <div class="w-14 sm:w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        class="h-full bg-blue-600 rounded-full transition-all duration-500"
                        [style.width.%]="court.occupancy_percentage"
                      ></div>
                    </div>
                    <span class="text-xs font-mono font-bold text-slate-800">
                      {{ court.occupancy_percentage }}%
                    </span>
                  </div>
                </div>

                <!-- Court Revenue -->
                <div class="text-right min-w-[90px] sm:min-w-[110px]">
                  <span class="text-[9px] sm:text-[10px] font-mono uppercase text-slate-400 block mb-0.5">
                    Recaudación
                  </span>
                  <span class="text-xs sm:text-sm font-mono font-bold text-slate-900 block leading-tight">
                    {{ formatCents(court.revenue_cents) }}
                  </span>
                  <span class="text-[10px] font-mono text-slate-400 block">
                    {{ court.booking_count }} turnos
                  </span>
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class ClubStatsViewComponent implements OnInit {
  private readonly adminService = inject(ClubAdminService);

  @Input() clubId: string | null = null;
  @Input({ required: true }) courts: AdminCourt[] = [];
  @Input({ required: true }) occupancyPct = 0;
  @Input({ required: true }) totalRevenueCents = 0;
  @Input({ required: true }) totalBookings = 0;

  // Filter state (Defaults to 'today')
  readonly selectedPreset = signal<StatsFilterPreset>('today');
  readonly startDate = signal<string>(this.getBogotaToday());
  readonly endDate = signal<string>(this.getBogotaToday());
  readonly isLoading = signal<boolean>(false);

  // Custom filter inputs
  customStartDate = this.getBogotaToday();
  customEndDate = this.getBogotaToday();

  // Reports data
  readonly revenueReport = signal<ClubRevenueReport | null>(null);
  readonly occupancyReport = signal<ClubOccupancyReport | null>(null);

  // Store sales data
  readonly storeSales = signal<DailyStoreSale[]>([]);
  readonly isSavingSale = signal<boolean>(false);
  readonly saveSuccess = signal<boolean>(false);

  saleDateInput = this.getBogotaToday();
  saleAmountCop: number | null = null;
  saleNotes = '';

  ngOnInit(): void {
    if (this.clubId) {
      this.loadStoreSales();
      this.setPreset('today');
    }
  }

  // Preset switching logic
  setPreset(preset: StatsFilterPreset): void {
    this.selectedPreset.set(preset);
    const todayStr = this.getBogotaToday();

    if (preset === 'today') {
      this.startDate.set(todayStr);
      this.endDate.set(todayStr);
      this.loadReports();
    } else if (preset === 'yesterday') {
      const yesterdayStr = this.getYesterdayStr(todayStr);
      this.startDate.set(yesterdayStr);
      this.endDate.set(yesterdayStr);
      this.loadReports();
    } else if (preset === 'week') {
      const { start, end } = this.getThisWeekRange(todayStr);
      this.startDate.set(start);
      this.endDate.set(end);
      this.loadReports();
    } else if (preset === 'month') {
      const { start, end } = this.getThisMonthRange(todayStr);
      this.startDate.set(start);
      this.endDate.set(end);
      this.loadReports();
    } else if (preset === 'custom') {
      this.customStartDate = this.startDate();
      this.customEndDate = this.endDate();
    }
  }

  applyCustomFilter(): void {
    if (!this.customStartDate || !this.customEndDate) return;
    if (this.customEndDate < this.customStartDate) {
      alert('La fecha fin no puede ser menor a la fecha inicio');
      return;
    }
    this.startDate.set(this.customStartDate);
    this.endDate.set(this.customEndDate);
    this.loadReports();
  }

  loadReports(): void {
    if (!this.clubId) return;
    this.isLoading.set(true);

    forkJoin({
      revenue: this.adminService.getRevenueReport(this.clubId, this.startDate(), this.endDate()).pipe(
        catchError((err) => {
          console.warn('Error fetching revenue report:', err);
          return of(null);
        })
      ),
      occupancy: this.adminService.getOccupancyReport(this.clubId, this.startDate(), this.endDate()).pipe(
        catchError((err) => {
          console.warn('Error fetching occupancy report:', err);
          return of(null);
        })
      )
    }).subscribe({
      next: ({ revenue, occupancy }) => {
        this.revenueReport.set(revenue);
        this.occupancyReport.set(occupancy);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  loadStoreSales(): void {
    if (!this.clubId) return;
    this.adminService.getStoreSales(this.clubId).subscribe({
      next: (sales) => this.storeSales.set(sales),
      error: (e) => console.error('Error fetching store sales:', e)
    });
  }

  // Filtered store sales for the active period
  storeSalesInPeriod(): DailyStoreSale[] {
    const s = this.startDate();
    const e = this.endDate();
    return this.storeSales().filter((sale) => sale.sale_date >= s && sale.sale_date <= e);
  }

  storeRevenueCents(): number {
    return this.storeSalesInPeriod().reduce((sum, item) => sum + item.amount_cents, 0);
  }

  // Effective metrics computation
  effectiveRevenueCents(): number {
    const rep = this.revenueReport();
    if (rep) {
      return rep.total_revenue_cents;
    }
    if (this.selectedPreset() === 'today') {
      return this.totalRevenueCents;
    }
    return 0;
  }

  effectiveBookingsCount(): number {
    const rep = this.revenueReport();
    if (rep) {
      return rep.total_bookings;
    }
    if (this.selectedPreset() === 'today') {
      return this.totalBookings;
    }
    return 0;
  }

  consolidatedTotalCents(): number {
    return this.effectiveRevenueCents() + this.storeRevenueCents();
  }

  effectiveOccupancyPct(): number {
    const rep = this.occupancyReport();
    if (rep) {
      return Math.round(rep.overall_occupancy_percentage);
    }
    if (this.selectedPreset() === 'today') {
      return this.occupancyPct;
    }
    return 0;
  }

  courtPerformanceList() {
    const revCourts = this.revenueReport()?.by_court || [];
    const occCourts = this.occupancyReport()?.by_court || [];

    return this.courts.map((court) => {
      const rev = revCourts.find((r) => r.court_id === court.id);
      const occ = occCourts.find((o) => o.court_id === court.id);
      return {
        id: court.id,
        name: court.name,
        sport: court.sport,
        surface: court.surface,
        is_active: court.is_active,
        booking_count: rev ? rev.booking_count : 0,
        revenue_cents: rev ? rev.total_revenue_cents : 0,
        occupancy_percentage: occ ? Math.round(occ.occupancy_percentage) : 0
      };
    });
  }

  periodLabel(): string {
    const p = this.selectedPreset();
    if (p === 'today') return 'Hoy';
    if (p === 'yesterday') return 'Ayer';
    if (p === 'week') return 'Esta Semana';
    if (p === 'month') return 'Este Mes';
    return 'Personalizado';
  }

  submitStoreSale(): void {
    if (!this.clubId || this.saleAmountCop === null || this.saleAmountCop < 0) return;
    this.isSavingSale.set(true);

    const payload = {
      sale_date: this.saleDateInput,
      amount_cents: Math.round(Number(this.saleAmountCop) * 100),
      notes: this.saleNotes.trim() || undefined
    };

    this.adminService.saveStoreSale(this.clubId, payload).subscribe({
      next: () => {
        this.isSavingSale.set(false);
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 3000);
        this.saleAmountCop = null;
        this.saleNotes = '';
        this.loadStoreSales();
      },
      error: (err) => {
        this.isSavingSale.set(false);
        console.error('Error saving store sale:', err);
      }
    });
  }

  deleteStoreSale(saleId: string): void {
    if (!this.clubId) return;
    this.adminService.deleteStoreSale(this.clubId, saleId).subscribe({
      next: () => this.loadStoreSales(),
      error: (err) => console.error('Error deleting store sale:', err)
    });
  }

  formatCents(cents: number): string {
    return (cents / 100).toLocaleString('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    });
  }

  // --- Date Calculation Helpers (Colombia Timezone) ---
  private getBogotaToday(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }

  private getYesterdayStr(todayStr: string): string {
    const [y, m, d] = todayStr.split('-').map(Number);
    const date = new Date(y, m - 1, d - 1);
    return this.formatDateObj(date);
  }

  private getThisWeekRange(todayStr: string): { start: string; end: string } {
    const [y, m, d] = todayStr.split('-').map(Number);
    const cur = new Date(y, m - 1, d);
    const day = cur.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(y, m - 1, d + diffToMonday);
    const sunday = new Date(y, m - 1, d + diffToMonday + 6);
    return {
      start: this.formatDateObj(monday),
      end: this.formatDateObj(sunday)
    };
  }

  private getThisMonthRange(todayStr: string): { start: string; end: string } {
    const [y, m] = todayStr.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    return {
      start: this.formatDateObj(first),
      end: this.formatDateObj(last)
    };
  }

  private formatDateObj(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
