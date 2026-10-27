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
  BusinessHourItem,
  BusinessHoursAdminResponse,
  ClubAdminService,
  ClubDashboardInfo,
  ClubLayout,
  ClubStaffCreate,
  ClubStaffMember
} from '../../services/club-admin.service';

import { ClubTimelineViewComponent } from '../../components/timeline-view/club-timeline-view.component';
import { ClubCourtsManagerComponent } from '../../components/courts-manager/club-courts-manager.component';
import { ClubLayoutEditorComponent } from '../../components/layout-editor/club-layout-editor.component';
import { ClubBusinessHoursManagerComponent } from '../../components/business-hours-manager/club-business-hours-manager.component';
import { ClubStaffManagerComponent } from '../../components/staff-manager/club-staff-manager.component';
import { ClubStatsViewComponent } from '../../components/stats-view/club-stats-view.component';
import { ClubLocationManagerComponent } from '../../components/location-manager/club-location-manager.component';
import { COUNTRY_DIAL_CODES, DEFAULT_DIAL_CODE } from '../../../../core/constants/country-codes';

export type AdminDashboardTab = 'timeline' | 'courts' | 'layout' | 'hours' | 'staff' | 'stats' | 'location';

@Component({
  selector: 'app-club-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ClubTimelineViewComponent,
    ClubCourtsManagerComponent,
    ClubLayoutEditorComponent,
    ClubBusinessHoursManagerComponent,
    ClubStaffManagerComponent,
    ClubStatsViewComponent,
    ClubLocationManagerComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-white text-slate-900 flex flex-col selection:bg-[#0056FB] selection:text-white relative overflow-hidden font-sans">
      <!-- Clean Luminous Ambient Glow -->
      <div class="ambient-lighting"></div>

      <!-- Top Architectural Navbar -->
      <header class="border-b border-slate-200/80 bg-white/90 backdrop-blur-xl sticky top-0 z-30">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div class="flex items-center gap-3 sm:gap-4">
            <img src="logo-mark.svg" alt="Canchariane" class="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl shadow-xs shrink-0" />
            <div>
              <div class="flex items-center gap-2">
                <h1 class="font-display font-semibold text-slate-900 text-xs sm:text-base tracking-wide truncate max-w-[150px] sm:max-w-none">
                  Panel de Operaciones
                </h1>
                <span class="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-blue-50 text-[#0056FB] border border-blue-200 text-[10px] font-mono tracking-wider uppercase items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-[#0056FB] animate-pulse"></span>
                  En Vivo
                </span>
              </div>
              <p class="text-[10px] sm:text-[11px] text-slate-500 font-mono tracking-wider uppercase truncate max-w-[180px] sm:max-w-none">
                {{ isOwnerOrAdmin() ? 'Administrador' : 'Recepcionista' }}
              </p>
            </div>
          </div>

          <!-- Controls & Profile -->
          <div class="flex items-center gap-2 sm:gap-3">
            <!-- Share Public Portal Button -->
            <button
              type="button"
              (click)="openShareModal()"
              class="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-[#0056FB] font-mono text-xs font-semibold tracking-wider flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
              title="Compartir link del portal de reservas de este club"
            >
              <span class="text-sm">🔗</span>
              <span class="hidden sm:inline">Compartir Portal</span>
            </button>

            <div class="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-200">
              <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-mono font-medium text-slate-700 shadow-xs" [title]="authStore.currentUser()?.email || ''">
                {{ authStore.userInitials() }}
              </div>
              <button
                type="button"
                (click)="logout()"
                class="text-xs uppercase tracking-wider font-mono text-slate-500 hover:text-slate-950 transition-colors px-1 py-1"
                title="Cerrar sesión"
              >
                <span class="hidden sm:inline">Salir</span>
                <span class="sm:hidden text-sm">🚪</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Tab Navigation Bar with smooth horizontal touch scrolling -->
        <div class="max-w-7xl mx-auto px-3 sm:px-6 flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1.5 sm:py-2 border-t border-slate-100 font-mono text-xs scrollbar-none snap-x">
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
              (click)="activeTab.set('hours')"
              [class.bg-[#0056FB]]="activeTab() === 'hours'"
              [class.text-white]="activeTab() === 'hours'"
              [class.shadow-xs]="activeTab() === 'hours'"
              [class.text-slate-600]="activeTab() !== 'hours'"
              class="px-3.5 py-2 rounded-xl hover:bg-slate-100 transition-all flex items-center gap-2 shrink-0 font-medium"
            >
              <span>⏰</span>
              <span>Horarios & Duraciones</span>
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

            <button
              type="button"
              (click)="activeTab.set('location')"
              [class.bg-[#0056FB]]="activeTab() === 'location'"
              [class.text-white]="activeTab() === 'location'"
              [class.shadow-xs]="activeTab() === 'location'"
              [class.text-slate-600]="activeTab() !== 'location'"
              class="px-3.5 py-2 rounded-xl hover:bg-slate-100 transition-all flex items-center gap-2 shrink-0 font-medium"
            >
              <span>📍</span>
              <span>Ubicación & Sede</span>
            </button>
          }
        </div>
      </header>

      <!-- Main Content Container -->
      <main class="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 w-full flex-1 space-y-4 sm:space-y-6 relative z-10 pb-24 sm:pb-8">
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
            [businessHours]="businessHours()"
            (dayChanged)="navigateDay($event)"
            (dateSelected)="setDate($event)"
            (todayClicked)="goToToday()"
            (openNewBookingModal)="openNewBookingModal()"
            (openNewBlockModal)="openNewBlockModal($event)"
            (openShareModal)="openShareModal()"
            (slotClicked)="openSlotBooking($event.courtId, $event.hourStr, $event.dateStr)"
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

        @if (activeTab() === 'hours' && isOwnerOrAdmin()) {
          <div class="space-y-6">
            <!-- Rental Durations & Booking Step Policy Card -->
            <div class="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-6">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <div class="flex items-center gap-2">
                    <h2 class="font-serif italic text-xl text-slate-900">Duraciones de Alquiler & Lapsos</h2>
                    <span class="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0056FB] border border-blue-200 text-[10px] font-mono tracking-wider uppercase font-medium">
                      Políticas de Reserva
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 mt-1">
                    Controla qué opciones de duración ofrece tu club a los clientes en el portal público (ej. solo por horas, o permitir 30m, 90m, etc.).
                  </p>
                </div>

                <button
                  type="button"
                  [disabled]="isSavingSettings()"
                  (click)="handleSaveSettings()"
                  class="px-5 py-2.5 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] disabled:opacity-50 text-white font-mono text-xs font-semibold tracking-wider flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 shrink-0"
                >
                  @if (isSavingSettings()) {
                    <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Guardando...</span>
                  } @else {
                    <span>💾 Guardar Políticas</span>
                  }
                </button>
              </div>

              <!-- Durations Allowed Selector -->
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <label class="text-[11px] font-mono uppercase tracking-wider text-slate-600 font-semibold block">
                    1. Duraciones Habilitadas para Alquiler
                  </label>
                  <span class="text-xs text-slate-400 font-mono">
                    {{ settingsAllowedDurations().length }} de {{ allDurationChoices.length }} activas
                  </span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  @for (choice of allDurationChoices; track choice.minutes) {
                    @let isEnabled = settingsAllowedDurations().includes(choice.minutes);
                    <button
                      type="button"
                      (click)="toggleDuration(choice.minutes)"
                      class="p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between"
                      [ngClass]="isEnabled
                        ? 'bg-blue-50/70 border-[#0056FB] text-slate-900 shadow-xs ring-1 ring-[#0056FB]/20'
                        : 'bg-slate-50/50 border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50'"
                    >
                      <div class="flex items-center justify-between w-full mb-1">
                        <span class="text-sm font-semibold tracking-tight">{{ choice.label }}</span>
                        <span class="text-xs font-mono font-bold" [class.text-[#0056FB]]="isEnabled" [class.text-slate-300]="!isEnabled">
                          {{ isEnabled ? '✓ Habilitada' : '— Desactivada' }}
                        </span>
                      </div>
                      <span class="text-[10px] font-mono uppercase tracking-wider opacity-70">{{ choice.sub }}</span>
                    </button>
                  }
                </div>
              </div>

              <!-- Default Duration & Step Settings -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-3 border-t border-slate-100">
                <div>
                  <label class="text-[11px] font-mono uppercase tracking-wider text-slate-600 font-semibold block mb-1.5">
                    2. Duración Predeterminada al Reservar
                  </label>
                  <select
                    [ngModel]="settingsDefaultDuration()"
                    (ngModelChange)="settingsDefaultDuration.set(+$event)"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  >
                    @for (d of settingsAllowedDurations(); track d) {
                      <option [value]="d">{{ d }} minutos ({{ d === 60 ? '1 hora' : d === 90 ? '1.5 h' : d === 120 ? '2 h' : d === 30 ? '0.5 h' : (d/60) + ' h' }})</option>
                    }
                  </select>
                  <p class="text-[11px] text-slate-400 mt-1">La opción preseleccionada cuando un cliente ingresa al portal.</p>
                </div>

                <div>
                  <label class="text-[11px] font-mono uppercase tracking-wider text-slate-600 font-semibold block mb-1.5">
                    3. Lapsos de Inicio Predeterminados
                  </label>
                  <select
                    [ngModel]="settingsSlotStep()"
                    (ngModelChange)="settingsSlotStep.set($event)"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  >
                    <option [ngValue]="null">En punto según duración (Recomendado: 06:00, 07:00, 08:00...)</option>
                    <option [ngValue]="30">Cada 30 minutos (06:00, 06:30, 07:00, 07:30...)</option>
                    <option [ngValue]="60">Forzar cada hora en punto (60m)</option>
                  </select>
                  <p class="text-[11px] text-slate-400 mt-1">Controla cómo se generan los intervalos de horario en la parrilla.</p>
                </div>
              </div>

              <!-- Court Selection Mode (Manual vs Automatic) -->
              <div class="pt-4 border-t border-slate-100">
                <label class="text-[11px] font-mono uppercase tracking-wider text-slate-600 font-semibold block mb-2">
                  4. Modo de Selección de Cancha para el Cliente
                </label>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    (click)="settingsCourtSelectionMode.set('manual')"
                    class="p-4 rounded-2xl border text-left transition-all"
                    [ngClass]="settingsCourtSelectionMode() === 'manual'
                      ? 'bg-blue-50/50 border-[#0056FB] text-slate-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'"
                  >
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-sm font-semibold">🗺️ Selección en Plano / Lista</span>
                      <span class="text-xs font-mono font-bold" [class.text-[#0056FB]]="settingsCourtSelectionMode() === 'manual'">
                        {{ settingsCourtSelectionMode() === 'manual' ? '✓ Activo' : '' }}
                      </span>
                    </div>
                    <p class="text-xs text-slate-500 font-light">
                      El cliente elige la cancha física exacta en el plano interactivo. Ideal para clubes con canchas variadas o techadas.
                    </p>
                  </button>

                  <button
                    type="button"
                    (click)="settingsCourtSelectionMode.set('by_category')"
                    class="p-4 rounded-2xl border text-left transition-all"
                    [ngClass]="settingsCourtSelectionMode() === 'by_category'
                      ? 'bg-blue-50/50 border-[#0056FB] text-slate-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'"
                  >
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-sm font-semibold">⚡ Por Modalidad y Cupos (Auto-asignada)</span>
                      <span class="text-xs font-mono font-bold" [class.text-[#0056FB]]="settingsCourtSelectionMode() === 'by_category'">
                        {{ settingsCourtSelectionMode() === 'by_category' ? '✓ Activo' : '' }}
                      </span>
                    </div>
                    <p class="text-xs text-slate-500 font-light">
                      El cliente elige solo la modalidad y horario. El sistema auto-asigna una cancha libre. Ideal para clubes con canchas homogéneas (ej. Fútbol 5).
                    </p>
                  </button>
                </div>
              </div>
            </div>

            <!-- Business Hours Component -->
            <app-club-business-hours-manager
              [hours]="businessHours()"
              [isSaving]="isSavingHours()"
              (save)="handleSaveHours($event)"
            />
          </div>
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
            [clubId]="clubId()"
            [courts]="courts()"
            [occupancyPct]="occupancyPct()"
            [totalRevenueCents]="totalRevenueCents()"
            [totalBookings]="activeBookingsCount()"
          />
        }

        @if (activeTab() === 'location' && isOwnerOrAdmin()) {
          <app-club-location-manager
            [clubId]="clubId()"
            [initialAddress]="clubInfo()?.address"
            [initialPhone]="clubInfo()?.phone"
          />
        }
      </main>

      <!-- ============================================================= -->
      <!-- MODAL: NUEVA RESERVA MANUAL                                   -->
      <!-- ============================================================= -->
      @if (showCreateBookingModal()) {
        <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div class="w-full max-w-lg p-5 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-5 sm:space-y-6 animate-in fade-in zoom-in-95 font-sans text-slate-900 max-h-[92vh] overflow-y-auto my-auto">
            <div class="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100">
              <div>
                <span class="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono block">Mostrador & Teléfono</span>
                <h3 class="font-serif italic text-xl sm:text-2xl text-slate-900">Nueva Reserva Manual</h3>
              </div>
              <button
                type="button"
                (click)="showCreateBookingModal.set(false)"
                class="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            @if (errorMessage()) {
              <div class="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between font-mono animate-in fade-in">
                <div class="flex items-center gap-2">
                  <span class="text-rose-500 font-bold text-sm">⚠️</span>
                  <span class="leading-relaxed">{{ errorMessage() }}</span>
                </div>
                <button type="button" (click)="errorMessage.set(null)" class="text-rose-600 hover:text-rose-950 font-bold ml-2 shrink-0">✕</button>
              </div>
            }

            <form (ngSubmit)="submitManualBooking()" class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Fecha *</label>
                  <input
                    type="date"
                    required
                    [(ngModel)]="modalDate"
                    name="modalDate"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  />
                </div>

                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Cancha</label>
                  <select
                    [(ngModel)]="modalCourtId"
                    (ngModelChange)="onDurationChange()"
                    name="modalCourtId"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  >
                    @for (c of courts(); track c.id) {
                      <option [value]="c.id">{{ c.name }} ({{ c.sport }})</option>
                    }
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Hora Inicio</label>
                  <input
                    type="time"
                    [(ngModel)]="modalTime"
                    name="modalTime"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  />
                </div>

                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Duración</label>
                  <select
                    [(ngModel)]="modalDurationMinutes"
                    (ngModelChange)="onDurationChange()"
                    name="modalDurationMinutes"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  >
                    <option [ngValue]="30">30 min (0.5 h)</option>
                    <option [ngValue]="60">60 min (1 hora)</option>
                    <option [ngValue]="90">90 min (1.5 h)</option>
                    <option [ngValue]="120">120 min (2 horas)</option>
                    <option [ngValue]="180">180 min (3 horas)</option>
                  </select>
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

              <div>
                <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Teléfono *</label>
                <div class="flex items-center rounded-xl bg-slate-50 border border-slate-200 focus-within:bg-white focus-within:border-[#0056FB] transition-colors overflow-hidden">
                  <div class="relative flex items-center bg-slate-100/80 border-r border-slate-200 text-slate-700 text-xs font-mono px-2 py-2.5 shrink-0">
                    <select
                      [(ngModel)]="modalCustomerDialCode"
                      name="modalCustomerDialCode"
                      class="bg-transparent text-slate-800 text-xs font-mono font-medium focus:outline-none cursor-pointer pr-1"
                    >
                      @for (c of countryCodes; track c.code) {
                        <option [value]="c.dial_code">
                          {{ c.flag }} {{ c.dial_code }}
                        </option>
                      }
                    </select>
                  </div>
                  <input
                    type="tel"
                    required
                    [(ngModel)]="modalCustomerPhone"
                    name="modalCustomerPhone"
                    placeholder="300 123 4567"
                    class="w-full px-3 py-2.5 bg-transparent text-slate-900 text-sm font-mono placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
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
        <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div class="w-full max-w-md p-5 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-5 sm:space-y-6 animate-in fade-in zoom-in-95 font-sans text-slate-900 max-h-[92vh] overflow-y-auto my-auto">
            <div class="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100">
              <div>
                <span class="text-[10px] uppercase tracking-[0.2em] text-[#0056FB] font-mono block">Reserva {{ selectedBooking()?.code }}</span>
                <h3 class="font-serif italic text-xl sm:text-2xl text-slate-900">{{ selectedBooking()?.customer_name }}</h3>
              </div>
              <button
                type="button"
                (click)="closeBookingDetails()"
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
                <span class="text-slate-500 font-mono uppercase text-[10px] tracking-wider">Horario</span>
                <span class="font-medium text-[#0056FB]">{{ formatBookingTime(selectedBooking()) }}</span>
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

            <!-- WhatsApp Actions: Chatear & Confirmar Asistencia -->
            @if (selectedBooking()?.customer_phone) {
              <div class="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-2">
                <div class="flex items-center gap-1.5 text-emerald-800 text-[10px] font-mono uppercase tracking-wider font-semibold">
                  <span class="text-sm">💬</span>
                  <span>WhatsApp con el Cliente</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    (click)="openWhatsAppChat(selectedBooking())"
                    class="py-2.5 px-3 rounded-xl bg-white hover:bg-emerald-100/70 border border-emerald-200 text-emerald-800 font-mono uppercase tracking-wider text-xs font-semibold transition-all shadow-2xs flex items-center justify-center gap-1.5 active:scale-95"
                    title="Abrir conversación con el cliente"
                  >
                    <span>💬</span>
                    <span>Chatear</span>
                  </button>
                  <button
                    type="button"
                    (click)="openWhatsAppConfirmBooking(selectedBooking())"
                    class="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-mono uppercase tracking-wider text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95"
                    title="Enviar mensaje para confirmar si el cliente viene a jugar"
                  >
                    <span>🎾</span>
                    <span>Confirmar Asistencia</span>
                  </button>
                </div>
              </div>
            }

            <!-- Quick Action Buttons -->
            @if (!confirmingCancelBooking() && !confirmingDeleteBooking()) {
              <div class="space-y-2 pt-2">
                @if (selectedBooking()?.status !== 'cancelled') {
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
                    (click)="confirmingCancelBooking.set(true)"
                    class="w-full py-3 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 font-mono uppercase tracking-wider text-xs transition-colors"
                  >
                    ✕ Cancelar Reserva
                  </button>
                } @else {
                  <div class="p-3.5 rounded-2xl bg-slate-100 text-slate-500 font-mono text-xs text-center border border-slate-200">
                    Esta reserva se encuentra cancelada.
                    @if (selectedBooking()?.cancellation_reason) {
                      <span class="block text-[11px] text-slate-400 mt-1 italic">
                        Motivo: {{ selectedBooking()?.cancellation_reason }}
                      </span>
                    }
                  </div>
                }

                <!-- Botón Eliminar Permanente (Por Error de Registro) -->
                <button
                  type="button"
                  (click)="confirmingDeleteBooking.set(true)"
                  class="w-full py-2.5 rounded-xl border border-dashed border-red-300 hover:border-red-500 hover:bg-red-50 text-red-700 font-mono uppercase tracking-wider text-xs transition-colors flex items-center justify-center gap-1.5"
                  title="Elimina definitivamente la reserva si se ingresó por error"
                >
                  <span>🗑️</span>
                  <span>Eliminar Definitivamente (Error)</span>
                </button>
              </div>
            } @else if (confirmingCancelBooking()) {
              <!-- Confirmation Box Before Cancelling -->
              <div class="p-5 rounded-2xl bg-rose-50/80 border border-rose-200 space-y-3 animate-in fade-in">
                <div class="flex items-center gap-2 text-rose-800 font-semibold text-xs font-mono uppercase tracking-wider">
                  <span>⚠️</span>
                  <span>Confirmación de Cancelación</span>
                </div>
                <p class="text-xs text-rose-950 font-sans leading-relaxed">
                  ¿Estás seguro de cancelar la reserva de <strong>{{ selectedBooking()?.customer_name }}</strong>? La cancha <strong>{{ selectedBooking()?.court_name }}</strong> quedará liberada inmediatamente.
                </p>
                <div class="space-y-1">
                  <label class="text-[10px] font-mono uppercase text-slate-500 block">Motivo de cancelación (opcional):</label>
                  <input
                    type="text"
                    [(ngModel)]="adminCancelReason"
                    placeholder="Ej: Solicitado por el cliente en llamada"
                    class="w-full px-3 py-2 rounded-xl border border-rose-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-sans"
                  />
                </div>
                <div class="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    [disabled]="isUpdatingBookingStatus()"
                    (click)="confirmCancelBooking()"
                    class="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-mono uppercase tracking-wider text-xs font-semibold transition-colors shadow-xs flex items-center justify-center gap-2"
                  >
                    @if (isUpdatingBookingStatus()) {
                      <span class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Cancelando...</span>
                    } @else {
                      <span>Confirmar Cancelación</span>
                    }
                  </button>
                  <button
                    type="button"
                    (click)="confirmingCancelBooking.set(false)"
                    class="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-mono transition-colors"
                  >
                    Volver
                  </button>
                </div>
              </div>
            } @else if (confirmingDeleteBooking()) {
              <!-- Confirmation Box Before Permanent Deleting -->
              <div class="p-5 rounded-2xl bg-red-50 border border-red-200 space-y-3 animate-in fade-in">
                <div class="flex items-center gap-2 text-red-800 font-semibold text-xs font-mono uppercase tracking-wider">
                  <span>🗑️</span>
                  <span>Eliminar Turno por Error</span>
                </div>
                <p class="text-xs text-red-950 font-sans leading-relaxed">
                  ¿Deseas eliminar permanentemente la reserva <strong>#{{ selectedBooking()?.code }}</strong> de <strong>{{ selectedBooking()?.customer_name }}</strong>? Esta acción borrará el registro de la agenda y liberará el horario de inmediato.
                </p>
                <div class="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    [disabled]="isDeletingBooking()"
                    (click)="confirmDeleteBooking()"
                    class="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-mono uppercase tracking-wider text-xs font-semibold transition-colors shadow-xs flex items-center justify-center gap-2"
                  >
                    @if (isDeletingBooking()) {
                      <span class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Eliminando...</span>
                    } @else {
                      <span>Sí, Eliminar Definitivamente</span>
                    }
                  </button>
                  <button
                    type="button"
                    (click)="confirmingDeleteBooking.set(false)"
                    class="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-mono transition-colors"
                  >
                    Volver
                  </button>
                </div>
              </div>
            }
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

            @if (errorMessage()) {
              <div class="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between font-mono animate-in fade-in">
                <div class="flex items-center gap-2">
                  <span class="text-rose-500 font-bold text-sm">⚠️</span>
                  <span class="leading-relaxed">{{ errorMessage() }}</span>
                </div>
                <button type="button" (click)="errorMessage.set(null)" class="text-rose-600 hover:text-rose-950 font-bold ml-2 shrink-0">✕</button>
              </div>
            }

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

      <!-- ============================================================= -->
      <!-- MODAL: COMPARTIR PORTAL PÚBLICO DE RESERVAS DEL CLUB           -->
      <!-- ============================================================= -->
      @if (showShareModal()) {
        <div class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-xl p-7 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 font-sans text-slate-900">
            <!-- Header -->
            <div class="flex items-center justify-between pb-4 border-b border-slate-100">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-xl text-[#0056FB] shadow-xs">
                  🔗
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] uppercase tracking-[0.2em] text-[#0056FB] font-mono font-semibold">Portal Oficial para Clientes</span>
                    @if (isPublished()) {
                      <span class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-medium flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Público Activo
                      </span>
                    } @else {
                      <span class="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-mono font-medium">
                        Modo Borrador
                      </span>
                    }
                  </div>
                  <h3 class="font-serif italic text-2xl text-slate-900 leading-tight">
                    {{ clubName() }}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                (click)="closeShareModal()"
                class="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            <!-- Description -->
            <p class="text-xs text-slate-600 font-sans leading-relaxed">
              Comparte este enlace con tus jugadores en WhatsApp, historias de Instagram o página web. Al abrirlo, verán directamente el portal público de tu club con el mapa interactivo y horarios disponibles en tiempo real.
            </p>

            <!-- URL Display and 1-Click Copy Box -->
            <div class="space-y-2">
              <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500">
                Enlace Directo de Reserva
              </label>
              <div class="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-50 border border-slate-200 focus-within:border-[#0056FB] focus-within:bg-white transition-all">
                <span class="pl-3 text-slate-400 font-mono text-xs">🌐</span>
                <input
                  type="text"
                  readonly
                  [value]="publicPortalUrl()"
                  (click)="$any($event.target).select()"
                  class="flex-1 bg-transparent border-none text-xs font-mono text-slate-800 select-all focus:outline-none"
                />
                <button
                  type="button"
                  (click)="copyPublicLink()"
                  class="px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-1.5 shadow-xs"
                  [ngClass]="hasCopiedLink() ? 'bg-emerald-600 text-white' : 'bg-[#0056FB] hover:bg-[#0048d6] text-white active:scale-95'"
                >
                  <span>{{ hasCopiedLink() ? '✓ Copiado' : '📋 Copiar' }}</span>
                </button>
              </div>
            </div>

            <!-- Quick Action Cards (WhatsApp & Direct Open) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <!-- Share on WhatsApp -->
              <button
                type="button"
                (click)="shareViaWhatsapp()"
                class="p-4 rounded-2xl bg-emerald-50/80 hover:bg-emerald-100/90 border border-emerald-200 text-left transition-all group flex items-start gap-3 active:scale-95"
              >
                <div class="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-lg shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  💬
                </div>
                <div class="space-y-0.5 min-w-0">
                  <span class="font-sans font-semibold text-slate-900 text-xs block truncate">Compartir por WhatsApp</span>
                  <span class="text-[11px] text-emerald-800 block leading-tight">Abre WhatsApp con mensaje y link listos para enviar</span>
                </div>
              </button>

              <!-- Open Public Portal in New Tab -->
              <button
                type="button"
                (click)="openPublicPortal()"
                class="p-4 rounded-2xl bg-blue-50/80 hover:bg-blue-100/90 border border-blue-200 text-left transition-all group flex items-start gap-3 active:scale-95"
              >
                <div class="w-10 h-10 rounded-xl bg-[#0056FB] text-white flex items-center justify-center text-lg shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  ↗
                </div>
                <div class="space-y-0.5 min-w-0">
                  <span class="font-sans font-semibold text-slate-900 text-xs block truncate">Ver Portal Público</span>
                  <span class="text-[11px] text-blue-800 block leading-tight">Probar y visualizar la página tal como la ven tus clientes</span>
                </div>
              </button>
            </div>

            <!-- Full Message Template Ready to Paste -->
            <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                  Plantilla de Mensaje para Clientes
                </span>
                <button
                  type="button"
                  (click)="copyFullMessage()"
                  class="text-[11px] font-mono text-[#0056FB] hover:underline font-semibold flex items-center gap-1"
                >
                  <span>{{ hasCopiedMessage() ? '✓ Texto Copiado' : 'Copiar Texto Completo' }}</span>
                </button>
              </div>
              <p class="text-xs text-slate-700 font-mono bg-white p-3 rounded-xl border border-slate-200/80 select-all leading-relaxed">
                ¡Hola! 👋 Ya puedes reservar tu cancha en {{ clubName() }} online y en tiempo real. Ingresa aquí para ver las canchas libres y elegir tu horario: {{ publicPortalUrl() }}
              </p>
            </div>

            <!-- Footer Tip & Close -->
            <div class="flex items-center justify-between pt-2">
              <span class="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                <span>💡</span> Los clientes no necesitan instalar ninguna app.
              </span>
              <button
                type="button"
                (click)="closeShareModal()"
                class="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-mono text-xs uppercase tracking-wider transition-colors"
              >
                Cerrar
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

  // Selected date signal (format "YYYY-MM-DD" in Colombia/Club timezone)
  readonly currentDate = signal<string>(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date())
  );

  // Data signals
  readonly courts = signal<AdminCourt[]>([]);
  readonly bookings = signal<AdminBooking[]>([]);
  readonly blocks = signal<AdminBlock[]>([]);
  readonly staffList = signal<ClubStaffMember[]>([]);
  readonly layoutData = signal<ClubLayout | null>(null);
  readonly businessHours = signal<BusinessHoursAdminResponse[]>([]);
  readonly isSavingHours = signal<boolean>(false);

  // Rental Durations & Booking Settings
  readonly isSavingSettings = signal<boolean>(false);
  readonly settingsAllowedDurations = signal<number[]>([60]);
  readonly settingsDefaultDuration = signal<number>(60);
  readonly settingsSlotStep = signal<number | null>(null);
  readonly settingsCourtSelectionMode = signal<'manual' | 'by_category'>('manual');

  readonly allDurationChoices = [
    { minutes: 30, label: '30 min', sub: 'Media hora' },
    { minutes: 60, label: '60 min', sub: '1 hora (Estándar)' },
    { minutes: 90, label: '90 min', sub: '1.5 horas (Pádel / Tenis)' },
    { minutes: 120, label: '120 min', sub: '2 horas (Partidos largos)' },
    { minutes: 180, label: '180 min', sub: '3 horas (Torneos / Eventos)' }
  ];

  readonly selectedBooking = signal<AdminBooking | null>(null);
  readonly selectedBlock = signal<AdminBlock | null>(null);
  readonly confirmingCancelBooking = signal<boolean>(false);
  readonly confirmingDeleteBooking = signal<boolean>(false);
  readonly isUpdatingBookingStatus = signal<boolean>(false);
  readonly isDeletingBooking = signal<boolean>(false);
  adminCancelReason = '';
  readonly showCreateBookingModal = signal<boolean>(false);
  readonly showCreateBlockModal = signal<boolean>(false);
  readonly showShareModal = signal<boolean>(false);
  readonly hasCopiedLink = signal<boolean>(false);
  readonly hasCopiedMessage = signal<boolean>(false);
  readonly clubInfo = signal<ClubDashboardInfo | null>(null);
  readonly isSubmitting = signal<boolean>(false);
  readonly isSubmittingBlock = signal<boolean>(false);
  readonly isSavingLayout = signal<boolean>(false);
  readonly feedbackMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly countryCodes = COUNTRY_DIAL_CODES;

  // Modal form bindings
  modalCourtId = '';
  modalDate = '';
  modalTime = '14:00';
  modalDurationMinutes = 60;
  modalCustomerName = '';
  modalCustomerDialCode = DEFAULT_DIAL_CODE;
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

  readonly clubId = computed(() => this.clubInfo()?.club_id || '');
  readonly clubSlug = computed(() => this.clubInfo()?.slug || 'club-alpha');
  readonly clubName = computed(() => this.clubInfo()?.club_name || 'Club Deportivo');
  readonly isPublished = computed(() => this.clubInfo()?.is_published ?? true);
  readonly publicPortalUrl = computed(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/c/${this.clubSlug()}`;
    }
    return `https://canchariane.com/c/${this.clubSlug()}`;
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
    const active = this.authStore.activeClubId() || this.clubInfo()?.club_id;
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
    this.loadClubInfo(clubId);
    this.loadCourts(clubId);
    this.loadBookings(clubId);
    this.loadBlocks(clubId);
    this.loadBusinessHours(clubId);
    if (this.isOwnerOrAdmin()) {
      this.loadLayout(clubId);
      this.loadStaff(clubId);
      this.loadClubSettings(clubId);
    }
  }

  loadClubInfo(clubId: string): void {
    this.adminService.getClubInfo(clubId).subscribe({
      next: (info) => this.clubInfo.set(info),
      error: (e) => console.error('Error fetching club info', e)
    });
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

  getWeekRange(dateStr: string): { start: string; end: string } {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const dayOfWeek = d.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(year, month - 1, day + diffToMonday);
    const sunday = new Date(year, month - 1, day + diffToMonday + 6);

    const fmt = (dt: Date) => {
      const y = dt.getFullYear();
      const m = (dt.getMonth() + 1).toString().padStart(2, '0');
      const da = dt.getDate().toString().padStart(2, '0');
      return `${y}-${m}-${da}`;
    };
    return { start: fmt(monday), end: fmt(sunday) };
  }

  loadBookings(clubId: string): void {
    const { start, end } = this.getWeekRange(this.currentDate());
    this.adminService.getBookings(clubId, start, end).subscribe({
      next: (bookings) => this.bookings.set(bookings),
      error: (e) => {
        console.error('Error loading bookings', e);
        this.bookings.set([]);
      }
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
    const curr = new Date(this.currentDate() + 'T12:00:00-05:00');
    curr.setDate(curr.getDate() + offset);
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(curr);
    this.setDate(dateStr);
  }

  setDate(dateStr: string): void {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
    this.currentDate.set(dateStr);
    const clubId = this.getActiveClubId();
    if (clubId) this.loadBookings(clubId);
  }

  goToToday(): void {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    this.setDate(today);
  }

  openNewBookingModal(): void {
    this.errorMessage.set(null);
    this.modalDate = this.currentDate();
    this.modalTime = '14:00';
    this.modalDurationMinutes = 60;
    this.modalCustomerName = '';
    this.modalCustomerDialCode = DEFAULT_DIAL_CODE;
    this.modalCustomerPhone = '';
    this.onDurationChange();
    this.showCreateBookingModal.set(true);
  }

  openSlotBooking(courtId: string, hourStr: string, dateStr?: string): void {
    this.errorMessage.set(null);
    this.modalCourtId = courtId;
    this.modalDate = dateStr || this.currentDate();
    this.modalTime = hourStr;
    this.modalDurationMinutes = 60;
    this.modalCustomerName = '';
    this.modalCustomerDialCode = DEFAULT_DIAL_CODE;
    this.modalCustomerPhone = '';
    this.onDurationChange();
    this.showCreateBookingModal.set(true);
  }

  onDurationChange(): void {
    const court = this.courts().find(c => c.id === this.modalCourtId);
    let baseHourly = court?.price_per_hour_cents || 6000000;
    if (court?.pricing_rules && court.pricing_rules.length > 0 && this.modalTime) {
      const match = court.pricing_rules.find(r => this.modalTime >= r.start_time && this.modalTime < r.end_time);
      if (match) {
        baseHourly = match.price_cents;
      }
    }
    this.modalPriceCents = Math.round((baseHourly * (Number(this.modalDurationMinutes) || 60)) / 60);
  }

  openBookingDetails(b: AdminBooking): void {
    this.confirmingCancelBooking.set(false);
    this.confirmingDeleteBooking.set(false);
    this.adminCancelReason = '';
    this.selectedBooking.set(b);
  }

  closeBookingDetails(): void {
    this.confirmingCancelBooking.set(false);
    this.confirmingDeleteBooking.set(false);
    this.adminCancelReason = '';
    this.selectedBooking.set(null);
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
      startIso = `${date}T00:00:00-05:00`;
      endIso = `${date}T23:59:59-05:00`;
    } else {
      startIso = this.toClubIso(date, this.blockModalStartTime);
      endIso = this.toClubIso(date, this.blockModalEndTime);
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

  toClubIso(date: string, time: string): string {
    const timeNorm = time.length === 5 ? `${time}:00` : time;
    return `${date}T${timeNorm}-05:00`;
  }

  formatBlockPeriod(block: AdminBlock): string {
    const start = new Date(block.period_start);
    const end = new Date(block.period_end);
    const dateStr = start.toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
    const sh = start.toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const eh = end.toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return `${dateStr} • ${sh} a ${eh}`;
  }

  formatBookingTime(booking: AdminBooking | null | undefined): string {
    if (!booking) return '';
    const start = new Date(booking.period_start);
    const end = new Date(booking.period_end);
    const dateStr = start.toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
    const sh = start.toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const eh = end.toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return `${dateStr} • ${sh} a ${eh}`;
  }

  submitManualBooking(): void {
    const clubId = this.getActiveClubId();
    if (!clubId) return;

    this.errorMessage.set(null);
    this.isSubmitting.set(true);
    const bookingDate = this.modalDate || this.currentDate();
    const periodStart = this.toClubIso(bookingDate, this.modalTime);

    const rawPhone = this.modalCustomerPhone.trim();
    const formattedPhone = rawPhone.startsWith('+') ? rawPhone : `${this.modalCustomerDialCode} ${rawPhone}`.trim();

    this.adminService
      .createBooking(clubId, {
        court_id: this.modalCourtId,
        period_start: periodStart,
        duration_minutes: Number(this.modalDurationMinutes) || 60,
        customer_name: this.modalCustomerName.trim(),
        customer_phone: formattedPhone,
        price_cents: Number(this.modalPriceCents) || 8000000,
        payment_status: 'paid'
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.showCreateBookingModal.set(false);
          this.feedbackMessage.set('Reserva creada exitosamente.');
          if (this.currentDate() !== bookingDate) {
            this.currentDate.set(bookingDate);
          }
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

  confirmCancelBooking(): void {
    const b = this.selectedBooking();
    const clubId = this.getActiveClubId();
    if (!b || !clubId) return;

    this.isUpdatingBookingStatus.set(true);
    this.errorMessage.set(null);

    const reason = this.adminCancelReason.trim() || 'Cancelada por el personal del club';
    this.adminService.updateBookingStatus(clubId, b.id, 'cancelled', reason).subscribe({
      next: () => {
        this.isUpdatingBookingStatus.set(false);
        this.confirmingCancelBooking.set(false);
        this.adminCancelReason = '';
        this.selectedBooking.set(null);
        this.feedbackMessage.set(`Reserva de ${b.customer_name} cancelada exitosamente.`);
        this.loadBookings(clubId);
      },
      error: (err) => {
        this.isUpdatingBookingStatus.set(false);
        this.errorMessage.set(this.extractErrorMessage(err));
      }
    });
  }

  confirmDeleteBooking(): void {
    const b = this.selectedBooking();
    const clubId = this.getActiveClubId();
    if (!b || !clubId) return;

    this.isDeletingBooking.set(true);
    this.errorMessage.set(null);

    this.adminService.deleteBooking(clubId, b.id).subscribe({
      next: () => {
        this.isDeletingBooking.set(false);
        this.confirmingDeleteBooking.set(false);
        this.selectedBooking.set(null);
        this.feedbackMessage.set(`Reserva #${b.code} (${b.customer_name}) eliminada definitivamente.`);
        this.loadBookings(clubId);
      },
      error: (err) => {
        this.isDeletingBooking.set(false);
        this.errorMessage.set(this.extractErrorMessage(err));
      }
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
      position: Number(event.data.position) || 1,
      price_per_hour_cents: event.data.price_per_hour_cents,
      pricing_rules: event.data.pricing_rules
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

  loadBusinessHours(clubId: string): void {
    this.adminService.getBusinessHours(clubId).subscribe({
      next: (hours) => this.businessHours.set(hours),
      error: (e) => console.error('Error fetching business hours', e)
    });
  }

  loadClubSettings(clubId: string): void {
    this.adminService.getSettings(clubId).subscribe({
      next: (s) => {
        this.settingsAllowedDurations.set(s.allowed_durations || [60]);
        this.settingsDefaultDuration.set(s.default_duration || 60);
        this.settingsSlotStep.set(s.slot_step_minutes ?? null);
        this.settingsCourtSelectionMode.set(s.court_selection_mode || 'manual');
      },
      error: (e) => console.error('Error fetching club settings', e)
    });
  }

  toggleDuration(minutes: number): void {
    const current = [...this.settingsAllowedDurations()];
    const index = current.indexOf(minutes);
    if (index >= 0) {
      if (current.length === 1) {
        alert('Debe haber al menos una duración habilitada para reservas.');
        return;
      }
      current.splice(index, 1);
    } else {
      current.push(minutes);
      current.sort((a, b) => a - b);
    }
    this.settingsAllowedDurations.set(current);
    if (!current.includes(this.settingsDefaultDuration())) {
      this.settingsDefaultDuration.set(current[0]);
    }
  }

  handleSaveSettings(): void {
    const clubId = this.getActiveClubId();
    if (!clubId) return;

    this.errorMessage.set(null);
    this.isSavingSettings.set(true);

    this.adminService
      .updateSettings(clubId, {
        allowed_durations: this.settingsAllowedDurations(),
        default_duration: this.settingsDefaultDuration(),
        slot_step_minutes: this.settingsSlotStep(),
        court_selection_mode: this.settingsCourtSelectionMode()
      })
      .subscribe({
        next: (updated) => {
          this.isSavingSettings.set(false);
          this.settingsAllowedDurations.set(updated.allowed_durations);
          this.settingsDefaultDuration.set(updated.default_duration);
          this.settingsSlotStep.set(updated.slot_step_minutes ?? null);
          this.settingsCourtSelectionMode.set(updated.court_selection_mode || 'manual');
          this.feedbackMessage.set('Políticas de duración y reservas guardadas exitosamente.');
        },
        error: (err) => {
          this.isSavingSettings.set(false);
          this.errorMessage.set(this.extractErrorMessage(err));
        }
      });
  }

  handleSaveHours(hours: BusinessHourItem[]): void {
    const clubId = this.getActiveClubId();
    if (!clubId) return;

    this.errorMessage.set(null);
    this.isSavingHours.set(true);

    this.adminService.updateBusinessHours(clubId, hours).subscribe({
      next: (updated) => {
        this.isSavingHours.set(false);
        this.businessHours.set(updated);
        this.feedbackMessage.set('Horarios de atención guardados y sincronizados correctamente.');
      },
      error: (err) => {
        this.isSavingHours.set(false);
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

  openShareModal(): void {
    this.hasCopiedLink.set(false);
    this.hasCopiedMessage.set(false);
    this.showShareModal.set(true);
  }

  closeShareModal(): void {
    this.showShareModal.set(false);
  }

  copyPublicLink(): void {
    const url = this.publicPortalUrl();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        this.hasCopiedLink.set(true);
        setTimeout(() => this.hasCopiedLink.set(false), 2500);
      });
    }
  }

  copyFullMessage(): void {
    const msg = `¡Hola! 👋 Ya puedes reservar tu cancha en ${this.clubName()} online y en tiempo real. Ingresa aquí para ver las canchas libres y elegir tu horario: ${this.publicPortalUrl()}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(msg).then(() => {
        this.hasCopiedMessage.set(true);
        setTimeout(() => this.hasCopiedMessage.set(false), 2500);
      });
    }
  }

  shareViaWhatsapp(): void {
    const msg = `¡Hola! 👋 Reserva tu cancha en ${this.clubName()} online aquí: ${this.publicPortalUrl()}`;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }

  cleanPhoneForWhatsApp(phone?: string | null): string {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 10) return `57${clean}`;
    return clean;
  }

  openWhatsAppChat(b?: AdminBooking | null): void {
    if (!b || !b.customer_phone) return;
    const phone = this.cleanPhoneForWhatsApp(b.customer_phone);
    const isAuto = this.settingsCourtSelectionMode() === 'by_category';
    const courtPart = isAuto ? 'tu reserva deportiva' : `tu turno en ${b.court_name}`;
    const msg = `¡Hola ${b.customer_name}! 👋 Te escribimos de ${this.clubName()} respecto a ${courtPart}.`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }

  openWhatsAppConfirmBooking(b?: AdminBooking | null): void {
    if (!b || !b.customer_phone) return;
    const phone = this.cleanPhoneForWhatsApp(b.customer_phone);
    const timeDisplay = this.formatBookingTime(b);
    const isAuto = this.settingsCourtSelectionMode() === 'by_category';
    const courtLine = isAuto ? '' : `📍 Cancha: ${b.court_name}\n`;
    const msg = `¡Hola ${b.customer_name}! 👋 Te saludamos de ${this.clubName()}.\n\nQueremos confirmar los detalles de tu reserva:\n${courtLine}📅 Fecha y Horario: ${timeDisplay}\n🎫 Código de reserva: ${b.code}\n\n¿Nos confirmas tu asistencia? ¡Te esperamos en la pista! 🎾⚽`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }

  openPublicPortal(): void {
    if (typeof window !== 'undefined') {
      window.open(this.publicPortalUrl(), '_blank');
    }
  }

  logout(): void {
    this.authStore.clearSession();
    this.router.navigate(['/auth/login']);
  }
}
