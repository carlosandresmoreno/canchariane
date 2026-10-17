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
import {
  AdminBlock,
  AdminBooking,
  AdminCourt,
  AdminCourtCreate,
  AdminCreateBlock,
  ClubAdminService,
  ClubLayout,
  ClubStaffCreate,
  ClubStaffMember
} from '../../services/club-admin.service';

import { ClubTimelineViewComponent } from '../../components/timeline-view/club-timeline-view.component';
import { ClubCourtsManagerComponent } from '../../components/courts-manager/club-courts-manager.component';
import { ClubLayoutEditorComponent } from '../../components/layout-editor/club-layout-editor.component';
import { ClubStaffManagerComponent } from '../../components/staff-manager/club-staff-manager.component';
import { ClubStatsViewComponent } from '../../components/stats-view/club-stats-view.component';

export type AdminDashboardTab = 'timeline' | 'courts' | 'layout' | 'staff' | 'stats';

@Component({
  selector: 'app-club-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ClubTimelineViewComponent,
    ClubCourtsManagerComponent,
    ClubLayoutEditorComponent,
    ClubStaffManagerComponent,
    ClubStatsViewComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-white text-slate-900 flex flex-col selection:bg-[#0056FB] selection:text-white relative overflow-hidden font-sans">
      <!-- Clean Luminous Ambient Glow -->
      <div class="ambient-lighting"></div>

      <!-- Top Architectural Navbar -->
      <header class="border-b border-slate-200/80 bg-white/90 backdrop-blur-xl sticky top-0 z-30">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center font-serif italic text-sm text-[#0056FB] shadow-xs">
              🏢
            </div>
            <div>
              <div class="flex items-center gap-2.5">
                <h1 class="font-display font-semibold text-slate-900 text-sm sm:text-base tracking-wide">
                  Panel de Operaciones de Club
                </h1>
                <span class="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0056FB] border border-blue-200 text-[10px] font-mono tracking-wider uppercase flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-[#0056FB] animate-pulse"></span>
                  SSE Sincronizado
                </span>
              </div>
              <p class="text-[11px] text-slate-500 font-mono tracking-wider uppercase">
                {{ isOwnerOrAdmin() ? 'Administración Integral & Dueño de Club' : 'Mostrador & Recepción de Pistas' }}
              </p>
            </div>
          </div>

          <!-- Controls & Profile -->
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <span class="hidden md:inline-flex px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#0056FB] text-[10px] font-mono tracking-wider font-medium">
                {{ userRoleBadge() }}
              </span>
              <div class="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-mono font-medium text-slate-700 shadow-xs" [title]="authStore.currentUser()?.email || ''">
                {{ authStore.userInitials() }}
              </div>
              <button
                type="button"
                (click)="logout()"
                class="text-xs uppercase tracking-wider font-mono text-slate-500 hover:text-slate-900 transition-colors hidden sm:inline"
              >
                Salir
              </button>
            </div>
          </div>
        </div>

        <!-- Tab Navigation Bar -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-2 overflow-x-auto py-2 border-t border-slate-100 font-mono text-xs">
          <!-- Timeline Tab (Visible to Staff and Admins) -->
          <button
            type="button"
            (click)="activeTab.set('timeline')"
            [class.bg-[#0056FB]]="activeTab() === 'timeline'"
            [class.text-white]="activeTab() === 'timeline'"
            [class.shadow-xs]="activeTab() === 'timeline'"
            [class.text-slate-600]="activeTab() !== 'timeline'"
            class="px-3.5 py-2 rounded-xl hover:bg-slate-100 transition-all flex items-center gap-2 shrink-0 font-medium"
          >
            <span>📅</span>
            <span>Agenda & Recepción</span>
          </button>

          <!-- Admin-Only Management Tabs -->
          @if (isOwnerOrAdmin()) {
            <button
              type="button"
              (click)="activeTab.set('courts')"
              [class.bg-[#0056FB]]="activeTab() === 'courts'"
              [class.text-white]="activeTab() === 'courts'"
              [class.shadow-xs]="activeTab() === 'courts'"
              [class.text-slate-600]="activeTab() !== 'courts'"
              class="px-3.5 py-2 rounded-xl hover:bg-slate-100 transition-all flex items-center gap-2 shrink-0 font-medium"
            >
              <span>🎾</span>
              <span>Canchas</span>
            </button>

            <button
              type="button"
              (click)="activeTab.set('layout')"
              [class.bg-[#0056FB]]="activeTab() === 'layout'"
              [class.text-white]="activeTab() === 'layout'"
              [class.shadow-xs]="activeTab() === 'layout'"
              [class.text-slate-600]="activeTab() !== 'layout'"
              class="px-3.5 py-2 rounded-xl hover:bg-slate-100 transition-all flex items-center gap-2 shrink-0 font-medium"
            >
              <span>🗺️</span>
              <span>Diseñador de Mapa</span>
            </button>

            <button
              type="button"
              (click)="activeTab.set('staff')"
              [class.bg-[#0056FB]]="activeTab() === 'staff'"
              [class.text-white]="activeTab() === 'staff'"
              [class.shadow-xs]="activeTab() === 'staff'"
              [class.text-slate-600]="activeTab() !== 'staff'"
              class="px-3.5 py-2 rounded-xl hover:bg-slate-100 transition-all flex items-center gap-2 shrink-0 font-medium"
            >
              <span>👥</span>
              <span>Personal & Recepcionistas</span>
            </button>

            <button
              type="button"
              (click)="activeTab.set('stats')"
              [class.bg-[#0056FB]]="activeTab() === 'stats'"
              [class.text-white]="activeTab() === 'stats'"
              [class.shadow-xs]="activeTab() === 'stats'"
              [class.text-slate-600]="activeTab() !== 'stats'"
              class="px-3.5 py-2 rounded-xl hover:bg-slate-100 transition-all flex items-center gap-2 shrink-0 font-medium"
            >
              <span>📊</span>
              <span>Estadísticas</span>
            </button>
          }
        </div>
      </header>

      <!-- Main Content Container -->
      <main class="max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full flex-1 space-y-6 relative z-10">
        <!-- Toast Feedback Message -->
        @if (feedbackMessage()) {
          <div class="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between font-mono animate-in fade-in">
            <span>{{ feedbackMessage() }}</span>
            <button type="button" (click)="feedbackMessage.set(null)" class="text-emerald-600 hover:text-emerald-950 font-bold">✕</button>
          </div>
        }

        <!-- Inline Error Banner -->
        @if (errorMessage()) {
          <div class="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between font-mono animate-in fade-in">
            <div class="flex items-center gap-2">
              <span class="text-rose-500 font-bold">⚠️</span>
              <span>{{ errorMessage() }}</span>
            </div>
            <button type="button" (click)="errorMessage.set(null)" class="text-rose-600 hover:text-rose-950 font-bold">✕</button>
          </div>
        }

        <!-- Active View Switcher -->
        @if (activeTab() === 'timeline') {
          <app-club-timeline-view
            [courts]="courts()"
            [bookings]="bookings()"
            [blocks]="blocks()"
            [currentDate]="currentDate()"
            [formattedDateDisplay]="formattedDateDisplay()"
            (dayChanged)="navigateDay($event)"
            (todayClicked)="goToToday()"
            (openNewBookingModal)="openNewBookingModal()"
            (openNewBlockModal)="openNewBlockModal($event)"
            (slotClicked)="openSlotBooking($event.courtId, $event.hourStr)"
            (selectBooking)="openBookingDetails($event)"
            (selectBlock)="openBlockDetails($event)"
          />
        }

        @if (activeTab() === 'courts' && isOwnerOrAdmin()) {
          <app-club-courts-manager
            [courts]="courts()"
            (saveCourt)="handleSaveCourt($event)"
            (toggleActive)="handleToggleCourt($event)"
          />
        }

        @if (activeTab() === 'layout' && isOwnerOrAdmin()) {
          <app-club-layout-editor
            [courts]="courts()"
            [initialLayout]="layoutData()"
            [isSaving]="isSavingLayout()"
            (saveLayout)="handleSaveLayout($event)"
          />
        }

        @if (activeTab() === 'staff' && isOwnerOrAdmin()) {
          <app-club-staff-manager
            [staffList]="staffList()"
            (saveStaff)="handleCreateStaff($event)"
            (deleteStaff)="handleDeleteStaff($event)"
          />
        }

        @if (activeTab() === 'stats' && isOwnerOrAdmin()) {
          <app-club-stats-view
            [courts]="courts()"
            [occupancyPct]="occupancyPct()"
            [totalRevenueCents]="totalRevenueCents()"
            [totalBookings]="activeBookingsCount()"
          />
        }
      </main>

      <!-- ============================================================= -->
      <!-- MODAL: NUEVA RESERVA MANUAL                                   -->
      <!-- ============================================================= -->
      @if (showCreateBookingModal()) {
        <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-lg p-7 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 font-sans text-slate-900">
            <div class="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span class="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono block">Mostrador & Teléfono</span>
                <h3 class="font-serif italic text-2xl text-slate-900">Nueva Reserva Manual</h3>
              </div>
              <button
                type="button"
                (click)="showCreateBookingModal.set(false)"
                class="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            <form (ngSubmit)="submitManualBooking()" class="space-y-4">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Cancha</label>
                  <select
                    [(ngModel)]="modalCourtId"
                    name="modalCourtId"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  >
                    @for (c of courts(); track c.id) {
                      <option [value]="c.id">{{ c.name }} ({{ c.sport }})</option>
                    }
                  </select>
                </div>

                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Hora Inicio</label>
                  <input
                    type="time"
                    [(ngModel)]="modalTime"
                    name="modalTime"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Nombre del Cliente *</label>
                <input
                  type="text"
                  required
                  [(ngModel)]="modalCustomerName"
                  name="modalCustomerName"
                  placeholder="Ej: Daniel Martínez"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Teléfono *</label>
                  <input
                    type="tel"
                    required
                    [(ngModel)]="modalCustomerPhone"
                    name="modalCustomerPhone"
                    placeholder="+57 300 123 4567"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  />
                </div>

                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Valor Turno (COP)</label>
                  <input
                    type="number"
                    [(ngModel)]="modalPriceCents"
                    name="modalPrice"
                    step="500000"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  />
                </div>
              </div>

              <div class="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  (click)="showCreateBookingModal.set(false)"
                  class="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-mono uppercase tracking-wider hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  [disabled]="isSubmitting() || !modalCustomerName || !modalCustomerPhone"
                  class="flex-1 py-3 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] disabled:opacity-40 text-white font-medium text-xs font-mono uppercase tracking-wider transition-all duration-300 shadow-md"
                >
                  {{ isSubmitting() ? 'Registrando...' : 'Confirmar Reserva' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- ============================================================= -->
      <!-- MODAL: DETALLES DE RESERVA EXISTENTE                          -->
      <!-- ============================================================= -->
      @if (selectedBooking()) {
        <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-md p-7 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 font-sans text-slate-900">
            <div class="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span class="text-[10px] uppercase tracking-[0.2em] text-[#0056FB] font-mono block">Reserva {{ selectedBooking()?.code }}</span>
                <h3 class="font-serif italic text-2xl text-slate-900">{{ selectedBooking()?.customer_name }}</h3>
              </div>
              <button
                type="button"
                (click)="selectedBooking.set(null)"
                class="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            <div class="space-y-3 text-xs">
              <div class="flex justify-between py-1.5 border-b border-slate-100">
                <span class="text-slate-500 font-mono uppercase text-[10px] tracking-wider">Cancha</span>
                <span class="font-medium text-slate-900">{{ selectedBooking()?.court_name }}</span>
              </div>
              <div class="flex justify-between py-1.5 border-b border-slate-100">
                <span class="text-slate-500 font-mono uppercase text-[10px] tracking-wider">Teléfono</span>
                <span class="font-mono text-slate-900">{{ selectedBooking()?.customer_phone }}</span>
              </div>
              <div class="flex justify-between py-1.5 border-b border-slate-100">
                <span class="text-slate-500 font-mono uppercase text-[10px] tracking-wider">Valor</span>
                <span class="font-serif italic text-slate-900 text-base font-semibold">{{ formatCents(selectedBooking()?.price_cents) }}</span>
              </div>
              <div class="flex justify-between py-1.5 border-b border-slate-100">
                <span class="text-slate-500 font-mono uppercase text-[10px] tracking-wider">Estado</span>
                <span class="font-mono text-[#0056FB] uppercase px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-[10px]">
                  {{ selectedBooking()?.status }}
                </span>
              </div>
            </div>

            <!-- Quick Action Buttons -->
            <div class="space-y-2 pt-2">
              <button
                type="button"
                (click)="updateStatus('completed')"
                class="w-full py-3 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] text-white font-mono uppercase tracking-wider text-xs transition-colors shadow-md"
              >
                ✓ Marcar como Completada
              </button>
              <button
                type="button"
                (click)="updateStatus('no_show')"
                class="w-full py-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-mono uppercase tracking-wider text-xs transition-colors shadow-xs"
              >
                ⚠ Marcar No-Show
              </button>
              <button
                type="button"
                (click)="updateStatus('cancelled')"
                class="w-full py-3 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 font-mono uppercase tracking-wider text-xs transition-colors"
              >
                ✕ Cancelar Reserva
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ============================================================= -->
      <!-- MODAL: BLOQUEAR HORARIO (TORNEO, REPARACIÓN, EVENTO)          -->
      <!-- ============================================================= -->
      @if (showCreateBlockModal()) {
        <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-lg p-7 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 font-sans text-slate-900">
            <div class="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span class="text-[10px] uppercase tracking-[0.2em] text-amber-600 font-mono font-semibold block">Disponibilidad & Cierres</span>
                <h3 class="font-serif italic text-2xl text-slate-900">Bloquear Cancha / Horario</h3>
              </div>
              <button
                type="button"
                (click)="showCreateBlockModal.set(false)"
                class="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            <p class="text-xs text-slate-500 font-sans">
              El horario que bloquees no estará disponible para reservas de los clientes ni en la web pública ni en el mostrador.
            </p>

            <form (ngSubmit)="submitBlock()" class="space-y-4">
              <!-- Cancha Afectada -->
              <div>
                <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
                  Cancha a Bloquear *
                </label>
                <select
                  [(ngModel)]="blockModalCourtId"
                  name="blockModalCourtId"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                >
                  <option value="">-- Todas las canchas (Club Completo) --</option>
                  @for (c of courts(); track c.id) {
                    <option [value]="c.id">{{ c.name }} ({{ c.sport }})</option>
                  }
                </select>
              </div>

              <!-- Tipo de Bloqueo -->
              <div>
                <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
                  Motivo / Tipo de Evento *
                </label>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  @for (k of blockKinds; track k.id) {
                    <button
                      type="button"
                      (click)="blockModalKind = k.id"
                      [class.bg-amber-50]="blockModalKind === k.id"
                      [class.border-amber-400]="blockModalKind === k.id"
                      [class.ring-2]="blockModalKind === k.id"
                      [class.ring-amber-400]="blockModalKind === k.id"
                      class="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center gap-2 text-left transition-all"
                    >
                      <span class="text-base">{{ k.icon }}</span>
                      <span class="text-xs font-medium text-slate-800 truncate">{{ k.label }}</span>
                    </button>
                  }
                </div>
              </div>

              <!-- Detalle o Razón -->
              <div>
                <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
                  Descripción o Título del Evento *
                </label>
                <input
                  type="text"
                  required
                  [(ngModel)]="blockModalReason"
                  name="blockModalReason"
                  placeholder="Ej. Torneo Apertura 2026 / Mantenimiento de iluminación / Reparación red"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                />
              </div>

              <!-- Fecha y Rango Horario -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Fecha</label>
                  <input
                    type="date"
                    [(ngModel)]="blockModalDate"
                    name="blockModalDate"
                    class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB]"
                  />
                </div>

                @if (!blockModalWholeDay) {
                  <div>
                    <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Hora Inicio</label>
                    <input
                      type="time"
                      [(ngModel)]="blockModalStartTime"
                      name="blockModalStartTime"
                      class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB]"
                    />
                  </div>

                  <div>
                    <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Hora Fin</label>
                    <input
                      type="time"
                      [(ngModel)]="blockModalEndTime"
                      name="blockModalEndTime"
                      class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB]"
                    />
                  </div>
                }
              </div>

              <!-- Bloquear Todo el Día Toggle -->
              <div class="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="wholeDayCheck"
                  [(ngModel)]="blockModalWholeDay"
                  name="blockModalWholeDay"
                  class="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <label for="wholeDayCheck" class="text-xs font-mono text-slate-700 cursor-pointer">
                  Bloquear la jornada completa (Todo el día)
                </label>
              </div>

              <!-- Action buttons -->
              <div class="flex items-center gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  (click)="showCreateBlockModal.set(false)"
                  class="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-mono uppercase tracking-wider hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  [disabled]="isSubmittingBlock() || !blockModalReason.trim()"
                  class="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-medium text-xs font-mono uppercase tracking-wider transition-all duration-300 shadow-md"
                >
                  {{ isSubmittingBlock() ? 'Bloqueando...' : 'Confirmar Bloqueo' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- ============================================================= -->
      <!-- MODAL: DETALLES Y DESBLOQUEO DE CANCHA / EVENTO               -->
      <!-- ============================================================= -->
      @if (selectedBlock(); as block) {
        <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-md p-7 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 font-sans text-slate-900">
            <div class="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span class="text-[10px] uppercase tracking-[0.2em] text-amber-600 font-mono font-semibold block">
                  {{ getBlockIcon(block.kind) }} {{ getBlockKindLabel(block.kind) }}
                </span>
                <h3 class="font-serif italic text-2xl text-slate-900">
                  {{ block.reason || 'Horario Bloqueado' }}
                </h3>
              </div>
              <button
                type="button"
                (click)="selectedBlock.set(null)"
                class="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            <div class="space-y-3 text-xs">
              <div class="flex justify-between py-1.5 border-b border-slate-100">
                <span class="text-slate-500 font-mono uppercase text-[10px] tracking-wider">Cancha Afectada</span>
                <span class="font-medium text-slate-900">{{ getCourtNameById(block.court_id) }}</span>
              </div>
              <div class="flex justify-between py-1.5 border-b border-slate-100">
                <span class="text-slate-500 font-mono uppercase text-[10px] tracking-wider">Horario Bloqueado</span>
                <span class="font-mono text-slate-900 font-semibold">{{ formatBlockPeriod(block) }}</span>
              </div>
              <div class="flex justify-between py-1.5 border-b border-slate-100">
                <span class="text-slate-500 font-mono uppercase text-[10px] tracking-wider">Tipo</span>
                <span class="font-mono text-amber-700 uppercase px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px]">
                  {{ getBlockKindLabel(block.kind) }}
                </span>
              </div>
              <div class="p-3 rounded-xl bg-amber-50/60 border border-amber-200/60 text-amber-900 text-xs font-sans">
                Este horario está excluido de la disponibilidad pública. Los clientes no pueden ver ni reservar esta cancha durante este intervalo.
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-3 pt-2">
              <button
                type="button"
                (click)="selectedBlock.set(null)"
                class="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-mono uppercase tracking-wider hover:bg-slate-100 transition-colors"
              >
                Cerrar
              </button>
              <button
                type="button"
                (click)="handleDeleteBlock(block.id)"
                class="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-mono uppercase tracking-wider text-xs transition-colors shadow-md"
              >
                Desbloquear y Habilitar
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

  // Active Tab
  readonly activeTab = signal<AdminDashboardTab>('timeline');

  // Selected date signal (format "YYYY-MM-DD")
  readonly currentDate = signal<string>(new Date().toISOString().split('T')[0]);

  // Data signals
  readonly courts = signal<AdminCourt[]>([]);
  readonly bookings = signal<AdminBooking[]>([]);
  readonly blocks = signal<AdminBlock[]>([]);
  readonly staffList = signal<ClubStaffMember[]>([]);
  readonly layoutData = signal<ClubLayout | null>(null);

  readonly selectedBooking = signal<AdminBooking | null>(null);
  readonly selectedBlock = signal<AdminBlock | null>(null);
  readonly showCreateBookingModal = signal<boolean>(false);
  readonly showCreateBlockModal = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly isSubmittingBlock = signal<boolean>(false);
  readonly isSavingLayout = signal<boolean>(false);
  readonly feedbackMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  // Modal form bindings
  modalCourtId = '';
  modalTime = '14:00';
  modalCustomerName = '';
  modalCustomerPhone = '';
  modalPriceCents = 8000000;

  // Block modal form bindings
  blockModalCourtId = '';
  blockModalKind = 'maintenance';
  blockModalReason = '';
  blockModalDate = '';
  blockModalStartTime = '08:00';
  blockModalEndTime = '12:00';
  blockModalWholeDay = false;

  readonly blockKinds = [
    { id: 'maintenance', label: 'Reparación / Mantenimiento', icon: '🛠️' },
    { id: 'tournament', label: 'Campeonato / Torneo', icon: '🏆' },
    { id: 'event', label: 'Evento Privado', icon: '🎪' },
    { id: 'weather', label: 'Mal Tiempo / Lluvia', icon: '🌧️' },
    { id: 'closure', label: 'Cierre Temporal', icon: '⛔' }
  ];

  // Permissions & Role Checks
  readonly isOwnerOrAdmin = computed(() => {
    if (this.authStore.isSuperadmin()) return true;
    const role = this.authStore.currentUser()?.memberships?.[0]?.role;
    return role === 'admin' || role === 'owner';
  });

  // Always displays club operational role inside the club dashboard
  readonly userRoleBadge = computed(() => {
    const user = this.authStore.currentUser();
    if (!user) return 'Personal de Club';
    const role = user.memberships?.[0]?.role;
    if (role === 'staff') return '📋 Recepcionista';
    if (role === 'owner') return '🏆 Dueño del Club';
    return '🏢 Administrador de Club';
  });

  readonly formattedDateDisplay = computed(() => {
    const [year, month, day] = this.currentDate().split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('es-ES', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  });

  readonly activeBookingsCount = computed(() => {
    return this.bookings().filter((b) => b.status === 'confirmed' || b.status === 'completed').length;
  });

  readonly totalRevenueCents = computed(() => {
    return this.bookings()
      .filter((b) => b.status !== 'cancelled')
      .reduce((acc, b) => acc + (b.price_cents || 0), 0);
  });

  readonly occupancyPct = computed(() => {
    const totalSlots = this.courts().length * 16;
    if (totalSlots === 0) return 0;
    const confirmed = this.activeBookingsCount();
    return Math.min(Math.round((confirmed / totalSlots) * 100), 100);
  });

  extractErrorMessage(err: any): string {
    if (!err) return 'Ocurrió un error inesperado';
    if (typeof err === 'string') return err;
    const detail = err.error?.detail ?? err.error?.message ?? err.message;
    if (Array.isArray(detail)) {
      return detail
        .map((d: any) => {
          const loc = Array.isArray(d.loc)
            ? d.loc.filter((l: any) => l !== 'body').join('.')
            : '';
          const msg = d.msg || 'Dato inválido';
          return loc ? `${loc}: ${msg}` : msg;
        })
        .join(' | ');
    }
    if (typeof detail === 'object' && detail !== null) {
      return detail.msg || detail.message || JSON.stringify(detail);
    }
    if (typeof detail === 'string') return detail;
    return 'Ocurrió un error al procesar la solicitud.';
  }

  ngOnInit(): void {
    const clubId = this.getActiveClubId();
    if (clubId) {
      this.loadAllData(clubId);
      this.initSse(clubId);
    }
  }

  ngOnDestroy(): void {
    if (this.sseConnection) {
      this.sseConnection.close();
      this.sseConnection = null;
    }
  }

  getActiveClubId(): string | null {
    const active = this.authStore.activeClubId();
    if (active) return active;
    const user = this.authStore.currentUser();
    if (user?.memberships && user.memberships.length > 0) {
      const clubId = user.memberships[0].club_id;
      this.authStore.setActiveClub(clubId);
      return clubId;
    }
    return null;
  }

  loadAllData(clubId: string): void {
    this.loadCourts(clubId);
    this.loadBookings(clubId);
    this.loadBlocks(clubId);
    if (this.isOwnerOrAdmin()) {
      this.loadLayout(clubId);
      this.loadStaff(clubId);
    }
  }

  loadCourts(clubId: string): void {
    this.adminService.getCourts(clubId).subscribe({
      next: (courts) => {
        this.courts.set(courts);
        if (courts.length > 0 && !this.modalCourtId) {
          this.modalCourtId = courts[0].id;
        }
      },
      error: (e) => console.error('Error fetching courts', e)
    });
  }

  loadBookings(clubId: string): void {
    const date = this.currentDate();
    this.adminService.getBookings(clubId, date, date).subscribe({
      next: (bookings) => this.bookings.set(bookings),
      error: () => console.error('Error loading bookings')
    });
    this.loadBlocks(clubId);
  }

  loadBlocks(clubId: string): void {
    this.adminService.getBlocks(clubId).subscribe({
      next: (blocks) => this.blocks.set(blocks),
      error: () => console.error('Error loading blocks')
    });
  }

  loadLayout(clubId: string): void {
    this.adminService.getLayout(clubId).subscribe({
      next: (layout) => this.layoutData.set(layout),
      error: (e) => console.error('Error fetching layout', e)
    });
  }

  loadStaff(clubId: string): void {
    this.adminService.getStaff(clubId).subscribe({
      next: (staff) => this.staffList.set(staff),
      error: (e) => console.error('Error fetching staff', e)
    });
  }

  initSse(clubId: string): void {
    try {
      this.sseConnection = this.adminService.connectSse(clubId);
      this.sseConnection.onmessage = () => {
        this.loadBookings(clubId);
      };
    } catch (e) {
      console.warn('SSE not supported or failed to connect', e);
    }
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
    this.showCreateBookingModal.set(true);
  }

  openSlotBooking(courtId: string, hourStr: string): void {
    this.modalCourtId = courtId;
    this.modalTime = hourStr;
    this.modalCustomerName = '';
    this.modalCustomerPhone = '';
    this.showCreateBookingModal.set(true);
  }

  openBookingDetails(b: AdminBooking): void {
    this.selectedBooking.set(b);
  }

  openNewBlockModal(options?: { courtId?: string; hourStr?: string }): void {
    this.blockModalCourtId = options?.courtId || '';
    this.blockModalKind = 'maintenance';
    this.blockModalReason = '';
    this.blockModalDate = this.currentDate();
    this.blockModalStartTime = options?.hourStr || '08:00';

    if (options?.hourStr) {
      const [h] = options.hourStr.split(':').map(Number);
      const nextH = Math.min(23, h + 2);
      this.blockModalEndTime = `${nextH.toString().padStart(2, '0')}:00`;
    } else {
      this.blockModalEndTime = '12:00';
    }

    this.blockModalWholeDay = false;
    this.showCreateBlockModal.set(true);
  }

  openBlockDetails(b: AdminBlock): void {
    this.selectedBlock.set(b);
  }

  submitBlock(): void {
    const clubId = this.getActiveClubId();
    if (!clubId) return;

    this.errorMessage.set(null);
    this.isSubmittingBlock.set(true);

    const date = this.blockModalDate || this.currentDate();
    let startIso: string;
    let endIso: string;

    if (this.blockModalWholeDay) {
      startIso = `${date}T00:00:00Z`;
      endIso = `${date}T23:59:59Z`;
    } else {
      startIso = `${date}T${this.blockModalStartTime}:00Z`;
      endIso = `${date}T${this.blockModalEndTime}:00Z`;
    }

    const payload: AdminCreateBlock = {
      court_id: this.blockModalCourtId ? this.blockModalCourtId : null,
      period_start: startIso,
      period_end: endIso,
      kind: this.blockModalKind,
      reason: this.blockModalReason.trim() || undefined
    };

    this.adminService.createBlock(clubId, payload).subscribe({
      next: (created) => {
        this.isSubmittingBlock.set(false);
        this.showCreateBlockModal.set(false);
        const courtName = this.getCourtNameById(created.court_id);
        this.feedbackMessage.set(
          `Horario bloqueado exitosamente para ${courtName} (${this.getBlockKindLabel(created.kind)}). Este horario ya no estará disponible para reservas públicas ni en mostrador.`
        );
        this.loadBookings(clubId);
      },
      error: (err) => {
        this.isSubmittingBlock.set(false);
        this.errorMessage.set(this.extractErrorMessage(err));
      }
    });
  }

  handleDeleteBlock(blockId: string): void {
    const clubId = this.getActiveClubId();
    if (!clubId) return;

    if (!confirm('¿Estás seguro de que deseas desbloquear este horario y habilitar la cancha nuevamente?')) {
      return;
    }

    this.errorMessage.set(null);
    this.adminService.deleteBlock(clubId, blockId).subscribe({
      next: () => {
        this.selectedBlock.set(null);
        this.feedbackMessage.set('Horario desbloqueado con éxito. La cancha vuelve a estar disponible.');
        this.loadBookings(clubId);
      },
      error: (err) => this.errorMessage.set(this.extractErrorMessage(err))
    });
  }

  getCourtNameById(courtId: string | null): string {
    if (!courtId) return 'Todas las canchas (Club Completo)';
    const found = this.courts().find((c) => c.id === courtId);
    return found ? `${found.name} (${found.sport})` : 'Cancha';
  }

  getBlockKindLabel(kind: string): string {
    switch (kind) {
      case 'tournament': return 'Torneo / Campeonato';
      case 'maintenance': return 'Mantenimiento / Reparación';
      case 'event': return 'Evento Privado';
      case 'weather': return 'Mal Tiempo / Lluvia';
      case 'closure': return 'Cierre Temporal';
      default: return 'Bloqueo';
    }
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

  formatBlockPeriod(block: AdminBlock): string {
    const start = new Date(block.period_start);
    const end = new Date(block.period_end);
    const dateStr = start.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    const sh = start.getHours().toString().padStart(2, '0');
    const sm = start.getMinutes().toString().padStart(2, '0');
    const eh = end.getHours().toString().padStart(2, '0');
    const em = end.getMinutes().toString().padStart(2, '0');
    return `${dateStr} • ${sh}:${sm} a ${eh}:${em}`;
  }

  submitManualBooking(): void {
    const clubId = this.getActiveClubId();
    if (!clubId) return;

    this.errorMessage.set(null);
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
        payment_status: 'paid'
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.showCreateBookingModal.set(false);
          this.feedbackMessage.set('Reserva creada exitosamente.');
          this.loadBookings(clubId);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(this.extractErrorMessage(err));
        }
      });
  }

  updateStatus(newStatus: 'cancelled' | 'no_show' | 'completed' | 'confirmed'): void {
    const b = this.selectedBooking();
    const clubId = this.getActiveClubId();
    if (!b || !clubId) return;

    this.errorMessage.set(null);
    this.adminService.updateBookingStatus(clubId, b.id, newStatus).subscribe({
      next: () => {
        this.selectedBooking.set(null);
        this.feedbackMessage.set(`Reserva actualizada a '${newStatus}'.`);
        this.loadBookings(clubId);
      },
      error: (err) => this.errorMessage.set(this.extractErrorMessage(err))
    });
  }

  handleSaveCourt(event: { courtId?: string; data: AdminCourtCreate }): void {
    const clubId = this.getActiveClubId();
    if (!clubId) return;

    this.errorMessage.set(null);
    const cleanData: AdminCourtCreate = {
      name: event.data.name.trim(),
      sport: event.data.sport.trim(),
      surface: event.data.surface,
      player_format: event.data.player_format,
      is_covered: !!event.data.is_covered,
      has_lighting: !!event.data.has_lighting,
      position: Number(event.data.position) || 1
    };

    if (event.courtId) {
      this.adminService.updateCourt(clubId, event.courtId, cleanData).subscribe({
        next: () => {
          this.feedbackMessage.set('Pista actualizada correctamente.');
          this.loadCourts(clubId);
        },
        error: (err) => this.errorMessage.set(this.extractErrorMessage(err))
      });
    } else {
      this.adminService.createCourt(clubId, cleanData).subscribe({
        next: () => {
          this.feedbackMessage.set('Nueva pista creada exitosamente.');
          this.loadCourts(clubId);
        },
        error: (err) => this.errorMessage.set(this.extractErrorMessage(err))
      });
    }
  }

  handleToggleCourt(court: AdminCourt): void {
    const clubId = this.getActiveClubId();
    if (!clubId) return;

    this.errorMessage.set(null);
    this.adminService.updateCourt(clubId, court.id, { is_active: !court.is_active }).subscribe({
      next: () => {
        this.feedbackMessage.set(`Cancha '${court.name}' ${court.is_active ? 'pausada' : 'activada'}.`);
        this.loadCourts(clubId);
      },
      error: (err) => this.errorMessage.set(this.extractErrorMessage(err))
    });
  }

  handleSaveLayout(layout: ClubLayout): void {
    const clubId = this.getActiveClubId();
    if (!clubId) return;

    this.errorMessage.set(null);
    this.isSavingLayout.set(true);

    const cleanPayload: ClubLayout = {
      name: layout.name || 'Planta Principal',
      view_box_w: layout.view_box_w || 1000,
      view_box_h: layout.view_box_h || 800,
      courts: (layout.courts || []).map((c) => ({
        court_id: c.court_id,
        shape: {
          kind: 'rect',
          x: Math.round(Number(c.shape?.x) || 50),
          y: Math.round(Number(c.shape?.y) || 50),
          w: Math.round(Number(c.shape?.w) || 160),
          h: Math.round(Number(c.shape?.h) || 240),
          rotation: Math.round(Number(c.shape?.rotation) || 0)
        }
      })),
      decorations: (layout.decorations || []).map((d) => ({
        label: d.label,
        icon: d.icon,
        shape: {
          kind: 'rect',
          x: Math.round(Number(d.shape?.x) || 50),
          y: Math.round(Number(d.shape?.y) || 50),
          w: Math.round(Number(d.shape?.w) || 200),
          h: Math.round(Number(d.shape?.h) || 60),
          rotation: Math.round(Number(d.shape?.rotation) || 0)
        }
      }))
    };

    this.adminService.updateLayout(clubId, cleanPayload).subscribe({
      next: (saved) => {
        this.isSavingLayout.set(false);
        this.layoutData.set(saved);
        this.feedbackMessage.set('Plano y ubicaciones de canchas guardados exitosamente.');
      },
      error: (err) => {
        this.isSavingLayout.set(false);
        this.errorMessage.set(this.extractErrorMessage(err));
      }
    });
  }

  handleCreateStaff(staffData: ClubStaffCreate): void {
    const clubId = this.getActiveClubId();
    if (!clubId) return;

    this.errorMessage.set(null);
    const cleanData: ClubStaffCreate = {
      full_name: staffData.full_name.trim(),
      email: staffData.email.trim().toLowerCase(),
      role: staffData.role,
      password: staffData.password?.trim() || '',
      phone: staffData.phone?.trim() || undefined
    };

    this.adminService.createStaff(clubId, cleanData).subscribe({
      next: (created) => {
        this.feedbackMessage.set(
          `Recepcionista '${created.user_full_name}' registrado exitosamente para este club.`
        );
        this.loadStaff(clubId);
      },
      error: (err) => this.errorMessage.set(this.extractErrorMessage(err))
    });
  }

  handleDeleteStaff(memberId: string): void {
    const clubId = this.getActiveClubId();
    if (!clubId) return;

    if (!confirm('¿Estás seguro de revocar el acceso de este usuario al club?')) return;
    this.errorMessage.set(null);

    this.adminService.deleteStaff(clubId, memberId).subscribe({
      next: () => {
        this.feedbackMessage.set('Acceso revocado correctamente.');
        this.loadStaff(clubId);
      },
      error: (err) => this.errorMessage.set(this.extractErrorMessage(err))
    });
  }

  formatCents(cents?: number): string {
    if (!cents) return '$ 0';
    return (cents / 100).toLocaleString('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    });
  }

  logout(): void {
    this.authStore.clearSession();
    this.router.navigate(['/auth/login']);
  }
}
