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
  ClubAnnouncement,
  CourtGroupPublicDTO,
  CreateHoldResponse,
  PublicBookingResponse,
  PublicClub,
  PublicClubLayout,
  PublicSlot
} from '../../models/public.models';
import { COUNTRY_DIAL_CODES, DEFAULT_DIAL_CODE } from '../../../../core/constants/country-codes';

interface DayOption {
  dateStr: string; // "2026-10-20"
  label: string;   // "Hoy", "Mañana", "Mié"
  fullLabel: string;
  isOpen: boolean;
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
        <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div class="flex items-center gap-3 sm:gap-4">
            @if (club()?.logo_url) {
              <img [src]="club()?.logo_url" [alt]="club()?.name" class="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl object-cover shadow-xs border border-slate-200" />
            } @else {
              <img src="logo-mark.svg" alt="Canchariane" class="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl shadow-xs" />
            }
            <div>
              <div class="flex items-center gap-2">
                <span class="font-mono text-[9px] sm:text-[10px] tracking-[0.25em] text-slate-500 uppercase">Club</span>
                <span class="w-1.5 h-1.5 rounded-full bg-[#0056FB]"></span>
                <span class="text-[11px] sm:text-xs text-slate-500">{{ club()?.timezone || 'America/Bogota' }}</span>
              </div>
              <h1 class="font-serif italic text-lg sm:text-2xl text-slate-900 tracking-tight leading-none mt-0.5">
                {{ club()?.name || 'Club Deportivo' }}
              </h1>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <a
              routerLink="/lookup"
              class="text-xs font-mono uppercase tracking-wider text-slate-600 hover:text-slate-950 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-400 transition-all shadow-xs inline-flex items-center gap-1.5"
            >
              <span class="text-xs">🔍</span>
              <span class="hidden sm:inline">Consultar Reserva</span>
              <span class="sm:hidden">Buscar</span>
            </a>
          </div>
        </div>
      </header>

      <!-- Main Step Container -->
      <main class="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-8 w-full flex-1">
        <!-- ============================================================= -->
        <!-- POPUP MODAL: PUBLICIDAD / CAMPEONATO CONFIGURABLE DEL CLUB   -->
        <!-- ============================================================= -->
        @if (showAnnouncementModal() && club()?.announcement?.is_active) {
          @let ann = club()!.announcement!;
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
            <div class="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 text-left animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              <!-- Close Button -->
              <button
                type="button"
                (click)="dismissAnnouncement()"
                class="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white flex items-center justify-center transition-all shadow-md cursor-pointer text-xs"
                title="Cerrar y continuar"
              >
                ✕
              </button>

              <!-- Optional Poster Image -->
              @if (ann.image_url) {
                <div class="relative w-full h-48 sm:h-56 bg-slate-100 overflow-hidden shrink-0">
                  <img
                    [src]="ann.image_url"
                    [alt]="ann.title"
                    class="w-full h-full object-cover"
                  />
                  <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                  <span class="absolute bottom-3 left-4 px-3 py-1 rounded-full bg-purple-600 text-white text-[10px] font-mono uppercase tracking-wider font-bold shadow-md">
                    {{ ann.tag || 'Campeonato' }}
                  </span>
                </div>
              }

              <div class="p-5 sm:p-6 space-y-4 overflow-y-auto">
                @if (!ann.image_url) {
                  <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-[10px] font-mono uppercase tracking-wider font-bold">
                    <span>🏆</span>
                    <span>{{ ann.tag || 'Campeonato' }}</span>
                  </div>
                }

                <div>
                  <h3 class="font-serif italic text-2xl sm:text-3xl text-slate-950 leading-tight">
                    {{ ann.title }}
                  </h3>
                  <p class="text-xs sm:text-sm text-slate-600 font-sans leading-relaxed mt-2 whitespace-pre-line">
                    {{ ann.description }}
                  </p>
                </div>

                <div class="pt-2 flex flex-col sm:flex-row gap-2.5">
                  @if (ann.action_type === 'whatsapp' && ann.action_phone) {
                    <a
                      [href]="getAnnouncementWhatsAppUrl(ann)"
                      target="_blank"
                      rel="noopener noreferrer"
                      (click)="dismissAnnouncement()"
                      class="flex-1 py-3 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                    >
                      <span>💬</span>
                      <span>{{ ann.action_label || 'Hablar con Encargado' }}</span>
                      <span class="text-xs">↗</span>
                    </a>
                  } @else if (ann.action_type === 'link' && ann.action_url) {
                    <a
                      [href]="ann.action_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      (click)="dismissAnnouncement()"
                      class="flex-1 py-3 px-4 rounded-2xl bg-[#0056FB] hover:bg-[#0048d6] text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                    >
                      <span>🌐</span>
                      <span>{{ ann.action_label || 'Más Información' }}</span>
                      <span class="text-xs">↗</span>
                    </a>
                  }

                  <button
                    type="button"
                    (click)="dismissAnnouncement()"
                    class="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Continuar a Reservas
                  </button>
                </div>
              </div>
            </div>
          </div>
        }

        <!-- Top Announcement Re-open Pill Banner -->
        @if (club()?.announcement?.is_active) {
          <button
            type="button"
            (click)="showAnnouncementModal.set(true)"
            class="w-full mb-4 p-3 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 text-purple-950 text-xs flex items-center justify-between gap-2 shadow-2xs hover:border-purple-300 transition-all cursor-pointer group"
          >
            <div class="flex items-center gap-2.5 truncate">
              <span class="px-2 py-0.5 rounded-full bg-purple-600 text-white font-mono text-[10px] font-bold uppercase tracking-wider shrink-0">
                {{ club()!.announcement!.tag || 'Campeonato' }}
              </span>
              <span class="font-semibold truncate text-slate-900">{{ club()!.announcement!.title }}</span>
            </div>
            <span class="text-[11px] font-mono text-purple-700 font-bold shrink-0 group-hover:underline">
              Ver información ↗
            </span>
          </button>
        }

        <!-- ============================================================= -->
        <!-- PASO 1: SELECCIÓN DE FECHA, HORA Y CANCHA                     -->
        <!-- ============================================================= -->
        @if (currentStep() === 1) {
          <div class="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
            <!-- Date Carousel Selector -->
            <div>
              <div class="flex items-center justify-between mb-2 sm:mb-3">
                <span class="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-medium">1. Fecha de Juego</span>
                <span class="text-xs text-slate-500 font-mono">{{ selectedDate() }}</span>
              </div>

              <div class="flex gap-2 sm:gap-2.5 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none snap-x">
                @for (day of availableDays(); track day.dateStr) {
                  <button
                    type="button"
                    (click)="day.isOpen && selectDate(day.dateStr)"
                    [disabled]="!day.isOpen"
                    class="min-w-[82px] sm:min-w-[100px] px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-2xl border text-left shrink-0 transition-all duration-300 snap-start"
                    [ngClass]="selectedDate() === day.dateStr 
                      ? 'bg-[#0056FB] border-[#0056FB] text-white shadow-md' 
                      : day.isOpen
                        ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/70 shadow-xs'
                        : 'bg-slate-50 border-slate-200/80 text-slate-400 opacity-60 cursor-not-allowed'"
                  >
                    <div class="flex items-center gap-1.5">
                      <span class="text-[10px] font-mono uppercase tracking-wider opacity-80">{{ day.label }}</span>
                      @if (!day.isOpen) {
                        <span class="text-[9px] font-mono uppercase tracking-wider px-1 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 font-semibold">
                          Cerrado
                        </span>
                      }
                    </div>
                    <div class="text-sm sm:text-base font-semibold mt-0.5 tracking-tight">{{ day.fullLabel }}</div>
                  </button>
                }
              </div>
            </div>

            <!-- Category / Modality Selector (Only when club is in auto mode and has multiple categories) -->
            @if (isAutoMode() && courtGroups().length > 1) {
              <div>
                <div class="flex items-center justify-between mb-3">
                  <span class="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-medium">2. Modalidad / Deporte</span>
                  <span class="text-xs text-slate-500 font-mono">{{ activeGroup()?.name }}</span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  @for (group of courtGroups(); track group.id) {
                    <button
                      type="button"
                      (click)="selectGroup(group.id)"
                      class="p-4 rounded-2xl border text-left transition-all duration-300"
                      [ngClass]="activeGroup()?.id === group.id 
                        ? 'bg-[#0056FB] border-[#0056FB] text-white shadow-md' 
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/70 shadow-xs'"
                    >
                      <div class="flex items-center justify-between">
                        <span class="text-[10px] font-mono uppercase tracking-wider opacity-80">{{ group.sport }}</span>
                        <span 
                          class="text-[10px] font-mono px-2 py-0.5 rounded-full" 
                          [ngClass]="activeGroup()?.id === group.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'"
                        >
                          {{ group.court_count }} canchas
                        </span>
                      </div>
                      <div class="text-sm font-semibold tracking-tight mt-1">{{ group.name }}</div>
                      <div class="text-xs opacity-90 mt-0.5 font-mono">Desde {{ formatCents(group.price_per_hour_cents) }}/h</div>
                    </button>
                  }
                </div>
              </div>
            }

            <!-- Duration Selector -->
            @if (durationOptions().length > 1) {
              <div>
                <div class="flex items-center justify-between mb-3">
                  <span class="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-medium">
                    {{ isAutoMode() && courtGroups().length > 1 ? '3.' : '2.' }} Duración del Turno
                  </span>
                  <span class="text-xs text-slate-500 font-mono">{{ selectedDuration() }} minutos</span>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  @for (opt of durationOptions(); track opt.minutes) {
                    <button
                      type="button"
                      (click)="selectDuration(opt.minutes)"
                      class="p-3.5 rounded-2xl border text-left transition-all duration-300"
                      [ngClass]="selectedDuration() === opt.minutes 
                        ? 'bg-[#0056FB] border-[#0056FB] text-white shadow-md' 
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/70 shadow-xs'"
                    >
                      <div class="text-sm font-semibold tracking-tight">{{ opt.label }}</div>
                      <div class="text-[10px] font-mono uppercase tracking-wider opacity-80 mt-0.5">{{ opt.sub }}</div>
                    </button>
                  }
                </div>
              </div>
            } @else if (durationOptions().length === 1) {
              <div class="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex items-center justify-between text-xs text-slate-700">
                <div class="flex items-center gap-2.5">
                  <span class="text-base">⏱️</span>
                  <div>
                    <span class="font-semibold text-slate-900 block">Duración establecida por el club</span>
                    <span class="text-[11px] text-slate-500 font-mono">{{ durationOptions()[0].label }} • {{ durationOptions()[0].sub }}</span>
                  </div>
                </div>
                <span class="font-mono text-[10px] uppercase tracking-wider bg-white px-2.5 py-1 rounded-full border border-blue-200 text-[#0056FB] font-semibold">
                  Turno Fijo
                </span>
              </div>
            }

            <!-- Hour Selector with Day Part Filter and Big Responsive Cards Grid -->
            <div>
              <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div class="flex items-center gap-3">
                  <span class="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-medium">
                    {{ isAutoMode() && courtGroups().length > 1 ? '4.' : '3.' }} Franja Horaria
                  </span>
                  <span class="font-mono text-xs text-slate-400">
                    {{ distinctHours().length }} turnos disponibles
                  </span>
                </div>

                @if (!isCurrentDayClosed()) {
                  <!-- Interval Selector (En punto vs Cada 30m) -->
                  <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs shadow-inner">
                    <span class="text-[10px] uppercase font-mono tracking-wider text-slate-400 px-1.5">Inicio:</span>
                    <button
                      type="button"
                      (click)="setStepMode('exact')"
                      class="px-2.5 py-1 rounded-lg text-xs transition-all"
                      [ngClass]="stepMode() === 'exact' ? 'bg-white text-slate-900 font-medium shadow-xs' : 'text-slate-500 hover:text-slate-900'"
                      title="Turnos comenzando en punto (ej. 08:00, 09:00, 10:00)"
                    >
                      En punto
                    </button>
                    <button
                      type="button"
                      (click)="setStepMode('half')"
                      class="px-2.5 py-1 rounded-lg text-xs transition-all"
                      [ngClass]="stepMode() === 'half' ? 'bg-white text-slate-900 font-medium shadow-xs' : 'text-slate-500 hover:text-slate-900'"
                      title="Turnos comenzando cada 30 min (ej. 08:00, 08:30, 09:00)"
                    >
                      Cada 30m
                    </button>
                  </div>
                }
              </div>

              <!-- Day-Part Filters (Mañana / Tarde / Noche) -->
              @if (!isCurrentDayClosed() && distinctHours().length > 0) {
                <div class="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none text-xs">
                  <button
                    type="button"
                    (click)="selectedDayPart.set('all')"
                    [ngClass]="selectedDayPart() === 'all' ? 'bg-[#0056FB] text-white font-semibold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
                    class="px-3 py-1.5 rounded-xl font-mono transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>⏱️</span>
                    <span>Todos ({{ distinctHours().length }})</span>
                  </button>

                  <button
                    type="button"
                    (click)="selectedDayPart.set('morning')"
                    [ngClass]="selectedDayPart() === 'morning' ? 'bg-[#0056FB] text-white font-semibold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
                    class="px-3 py-1.5 rounded-xl font-mono transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>🌅</span>
                    <span>Mañana</span>
                  </button>

                  <button
                    type="button"
                    (click)="selectedDayPart.set('afternoon')"
                    [ngClass]="selectedDayPart() === 'afternoon' ? 'bg-[#0056FB] text-white font-semibold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
                    class="px-3 py-1.5 rounded-xl font-mono transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>☀️</span>
                    <span>Tarde</span>
                  </button>

                  <button
                    type="button"
                    (click)="selectedDayPart.set('night')"
                    [ngClass]="selectedDayPart() === 'night' ? 'bg-[#0056FB] text-white font-semibold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
                    class="px-3 py-1.5 rounded-xl font-mono transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>🌙</span>
                    <span>Noche</span>
                  </button>
                </div>
              }

              @if (isCurrentDayClosed()) {
                <div class="p-8 rounded-3xl bg-amber-50/70 border border-amber-200 text-center text-amber-800 text-sm shadow-xs flex flex-col items-center justify-center gap-2">
                  <span class="text-3xl">🚪</span>
                  <span class="font-semibold text-base text-amber-900">Instalaciones cerradas este día</span>
                  <p class="text-xs text-amber-700 font-light max-w-md">
                    El club no tiene servicio ni disponibilidad de canchas programada para esta fecha. Selecciona otro día abierto en el selector superior.
                  </p>
                </div>
              } @else if (distinctHours().length === 0 && !isLoadingSlots()) {
                <div class="p-8 rounded-3xl bg-slate-50 border border-slate-200 text-center text-slate-500 font-light text-sm shadow-xs">
                  No hay horarios programados para esta fecha y duración. Selecciona otro día o ajusta la duración.
                </div>
              } @else if (filteredHours().length === 0 && !isLoadingSlots()) {
                <div class="p-8 rounded-3xl bg-slate-50 border border-slate-200 text-center text-slate-500 font-mono text-xs">
                  No hay turnos disponibles en esta franja. Prueba seleccionando "Todos".
                </div>
              } @else {
                <!-- Prominent, Vistoso & Legible Hour Grid -->
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
                  @for (hour of filteredHours(); track hour) {
                    @let count = getAvailableCountForHour(hour);
                    @let isSelected = selectedHour() === hour;
                    @let isFull = isAutoMode() ? count === 0 : false;
                    @let priceCents = getPriceForHour(hour);
                    <button
                      type="button"
                      (click)="!isFull && selectHour(hour)"
                      [disabled]="isFull"
                      class="p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between gap-2.5 group relative"
                      [ngClass]="isSelected 
                        ? 'bg-[#0056FB] text-white border-[#0056FB] shadow-lg ring-4 ring-[#0056FB]/20 scale-[1.02]' 
                        : isFull
                          ? 'bg-slate-50 border-slate-200/70 text-slate-400 opacity-60 cursor-not-allowed'
                          : 'bg-white border-slate-200 hover:border-[#0056FB]/60 hover:bg-blue-50/40 text-slate-800 shadow-2xs cursor-pointer'"
                    >
                      <div class="flex items-center justify-between gap-1 w-full">
                        <span class="text-base sm:text-lg font-bold font-sans tracking-tight" [class.text-white]="isSelected">
                          {{ formatTimeAmPm(hour) }}
                        </span>
                        @if (isSelected) {
                          <span class="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white font-mono font-bold">
                            ✓
                          </span>
                        }
                      </div>

                      <div class="flex items-center justify-between gap-1 pt-1.5 border-t text-[11px] font-mono"
                        [ngClass]="isSelected ? 'border-white/20 text-white/90' : 'border-slate-100 text-slate-500'">
                        @if (isAutoMode()) {
                          @if (isFull) {
                            <span class="text-rose-500 font-semibold">Agotado</span>
                          } @else if (count === 1) {
                            <span class="text-amber-500 font-bold" [class.text-amber-200]="isSelected">¡1 cupo!</span>
                          } @else {
                            <span>{{ count }} libres</span>
                          }
                        } @else {
                          <span>Disponible</span>
                        }

                        @if (priceCents) {
                          <span class="font-bold font-sans text-xs" [class.text-white]="isSelected" [class.text-slate-900]="!isSelected && !isFull">
                            {{ formatCurrencyCop(priceCents) }}
                          </span>
                        }
                      </div>
                    </button>
                  }
                </div>
              }
            </div>

            <!-- Court Selector / Auto-Assignment Summary -->
            @if (!isCurrentDayClosed()) {
              @if (isAutoMode()) {
                <div>
                  <div class="flex items-center justify-between mb-3">
                    <span class="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-medium">
                      {{ courtGroups().length > 1 ? '5.' : '4.' }} Asignación de Cancha
                    </span>
                    <span class="text-xs text-emerald-600 font-mono font-medium flex items-center gap-1.5">
                      <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Cupo disponible
                    </span>
                  </div>

                  <div class="p-6 rounded-3xl bg-blue-50/50 border border-blue-200/80 shadow-xs">
                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-2xl bg-white border border-blue-200 flex items-center justify-center text-2xl shadow-xs text-[#0056FB]">
                          ⚡
                        </div>
                        <div>
                          <div class="flex items-center gap-2">
                            <span class="text-[10px] font-mono uppercase tracking-widest text-blue-600 font-semibold">Turno Auto-Asignado</span>
                            <span class="text-slate-300">•</span>
                            <span class="text-xs text-slate-500">{{ activeGroup()?.court_count }} canchas en el complejo</span>
                          </div>
                          <h3 class="font-semibold text-slate-900 text-lg mt-0.5">
                            {{ activeGroup()?.name }}
                          </h3>
                          <p class="text-xs text-slate-500 mt-1">
                            Tu pista se asignará automáticamente entre las canchas disponibles al confirmar la reserva.
                          </p>
                        </div>
                      </div>

                      <div class="text-right shrink-0">
                        <span class="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">Tarifa del Turno</span>
                        <span class="font-mono text-sm font-bold text-[#0056FB] bg-white px-3.5 py-1.5 rounded-full border border-blue-200 shadow-xs inline-block">
                          {{ formatCents(selectedSlot()?.price_cents || activeGroup()?.price_per_hour_cents) }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              } @else {
                <!-- Manual Mode: View Switcher & Court Selector -->
                <div>
                  <div class="flex items-center justify-between mb-4">
                    <span class="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-medium">4. Selección de Cancha</span>
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
                                <div class="text-right">
                                  <span class="font-mono text-xs font-semibold text-[#0056FB] bg-[#EFF6FF] px-2.5 py-1 rounded-full border border-[#0056FB]/30 block">
                                    {{ formatCents(slot.price_cents) }}
                                  </span>
                                  @if (slot.hourly_rate_cents) {
                                    <span class="text-[10px] font-mono text-slate-400 mt-1 block">
                                      {{ formatCents(slot.hourly_rate_cents) }}/h
                                    </span>
                                  }
                                </div>
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
              }
            }

            <!-- Sticky Bottom Selection Action Drawer -->
            @if (selectedCourtId() && selectedSlot()) {
              <div class="sticky bottom-4 z-30 p-4 sm:p-5 rounded-3xl bg-white/95 backdrop-blur-2xl border border-slate-200 shadow-[0_15px_40px_rgba(0,0,0,0.08)] flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-bottom-4 duration-300">
                <div class="flex items-center gap-4 text-left w-full sm:w-auto">
                  <div class="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center font-serif italic text-xl text-[#0056FB] shadow-xs">
                    ✓
                  </div>
                  <div>
                    <div class="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                      {{ isAutoMode() ? 'Modalidad Seleccionada' : 'Selección Actual' }}
                    </div>
                    <div class="font-semibold text-slate-900 text-base leading-tight">
                      {{ isAutoMode() ? activeGroup()?.name : selectedSlot()?.court_name }}
                    </div>
                    <div class="text-xs text-slate-500 font-mono mt-0.5">
                      {{ selectedDate() }} • {{ selectedSlot()?.local_start_time }} - {{ selectedSlot()?.local_end_time }} ({{ selectedDuration() }} min)
                    </div>
                  </div>
                </div>

                <div class="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
                  <div class="text-left sm:text-right">
                    <div class="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                      Tarifa ({{ formatDurationText(selectedDuration()) }})
                    </div>
                    <div class="font-serif italic text-2xl text-slate-900 leading-none">
                      {{ formatCents(selectedSlot()?.price_cents) }}
                    </div>
                    @if (selectedSlot()?.hourly_rate_cents) {
                      <div class="text-[10px] font-mono text-slate-400 mt-0.5">
                        Base: {{ formatCents(selectedSlot()?.hourly_rate_cents) }} / hora
                      </div>
                    }
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
                <span class="text-[10px] font-mono uppercase tracking-widest text-slate-400 block">
                  {{ isAutoMode() ? 'Cancha Asignada' : 'Cancha Bloqueada' }}
                </span>
                <span class="font-semibold text-slate-900 text-sm">
                  {{ hold()?.court_name || selectedSlot()?.court_name }} ({{ selectedDuration() }} min)
                </span>
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
                  Teléfono Móvil *
                </label>
                <div class="flex items-center rounded-2xl bg-slate-50/70 border border-slate-200 focus-within:bg-white focus-within:border-[#0056FB] focus-within:ring-1 focus-within:ring-[#0056FB]/30 transition-colors overflow-hidden">
                  <div class="relative flex items-center bg-slate-100/90 border-r border-slate-200 text-slate-700 text-xs font-mono px-3 py-3 shrink-0">
                    <select
                      [(ngModel)]="customerDialCode"
                      name="customerDialCode"
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
                    id="phone"
                    type="tel"
                    required
                    [(ngModel)]="customerPhone"
                    name="customerPhone"
                    placeholder="Ej: 300 123 4567"
                    class="w-full px-4 py-3 bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none text-sm transition-colors font-mono"
                  />
                </div>
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

              <!-- Price Breakdown Card -->
              <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div class="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Tarifa base (1 hora):</span>
                  <span>{{ formatCents(selectedSlot()?.hourly_rate_cents) }}</span>
                </div>
                <div class="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Tiempo reservado:</span>
                  <span>{{ formatDurationText(selectedDuration()) }}</span>
                </div>
                <div class="border-t border-slate-200/80 pt-2 flex items-center justify-between">
                  <div>
                    <span class="text-xs font-semibold text-slate-700 block">Total a Pagar en Sitio</span>
                    <span class="text-[10px] text-slate-400 font-mono">Sin cargos ocultos</span>
                  </div>
                  <span class="font-serif italic text-2xl text-slate-900">{{ formatCents(hold()?.price_cents) }}</span>
                </div>
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
                  <span class="text-slate-400 uppercase font-mono text-[10px] block">Duración</span>
                  <span class="font-semibold text-slate-900 text-sm">{{ formatDurationText(selectedDuration()) }}</span>
                </div>
                <div>
                  <span class="text-slate-400 uppercase font-mono text-[10px] block">Liquidación</span>
                  <span class="font-mono text-[11px] text-[#0056FB] uppercase bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#0056FB]/30 inline-block">{{ confirmedBooking()?.payment_status }}</span>
                </div>
                @if (selectedSlot()?.hourly_rate_cents) {
                  <div>
                    <span class="text-slate-400 uppercase font-mono text-[10px] block">Tarifa por Hora</span>
                    <span class="font-mono text-xs font-medium text-slate-600">{{ formatCents(selectedSlot()?.hourly_rate_cents) }}/h</span>
                  </div>
                }
                <div [class]="selectedSlot()?.hourly_rate_cents ? '' : 'col-span-2'">
                  <span class="text-slate-400 uppercase font-mono text-[10px] block">Importe Total</span>
                  <span class="font-serif italic text-2xl text-slate-900">{{ formatCents(confirmedBooking()?.price_cents) }}</span>
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
  readonly selectedGroupId = signal<string | null>(null);
  readonly activeView = signal<'map' | 'list'>('map');

  // Category & Auto-assignment Signals
  readonly isAutoMode = computed(() => this.club()?.court_selection_mode === 'by_category');
  readonly courtGroups = computed<CourtGroupPublicDTO[]>(() => this.club()?.court_groups || []);
  readonly activeGroup = computed<CourtGroupPublicDTO | null>(() => {
    const groups = this.courtGroups();
    const sel = this.selectedGroupId();
    if (!groups.length) return null;
    return groups.find((g) => g.id === sel) || groups[0];
  });

  // Duration & Interval Signals
  readonly selectedDuration = signal<number>(60);
  readonly stepMode = signal<'exact' | 'half'>('exact');

  readonly allDurationOptions = [
    { minutes: 30, label: '30 min', sub: 'Media hora' },
    { minutes: 60, label: '60 min', sub: '1 hora (Estándar)' },
    { minutes: 90, label: '90 min', sub: '1.5 horas' },
    { minutes: 120, label: '120 min', sub: '2 horas' },
    { minutes: 180, label: '180 min', sub: '3 horas' }
  ];

  readonly durationOptions = computed(() => {
    const c = this.club();
    const allowed = c?.allowed_durations && c.allowed_durations.length > 0
      ? c.allowed_durations
      : [60];
    return this.allDurationOptions.filter((opt) => allowed.includes(opt.minutes));
  });

  // Flow Signals
  readonly currentStep = signal<1 | 2 | 3>(1);
  readonly isHolding = signal<boolean>(false);
  readonly isConfirming = signal<boolean>(false);
  readonly isLoadingSlots = signal<boolean>(false);
  readonly hold = signal<CreateHoldResponse | null>(null);
  readonly confirmedBooking = signal<PublicBookingResponse | null>(null);

  // Form Fields
  readonly countryCodes = COUNTRY_DIAL_CODES;
  customerName = '';
  customerDialCode = DEFAULT_DIAL_CODE;
  customerPhone = '';
  customerEmail = '';

  readonly availableDays = computed<DayOption[]>(() => {
    const days: DayOption[] = [];
    const now = new Date();
    const clubData = this.club();
    const bHours = clubData?.business_hours;

    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dd = day;
      const mm = month;

      let label = `${dd}/${mm}`;
      if (i === 0) label = 'Hoy';
      else if (i === 1) label = 'Mañana';
      else {
        const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        label = weekdays[d.getDay()];
      }

      // Map JS getDay() (0=Sun..6=Sat) to Backend weekday (0=Mon..6=Sun)
      const pythonWeekday = (d.getDay() + 6) % 7;
      // If business_hours are loaded, check if this weekday is present
      const isOpen = !bHours || bHours.length === 0 || bHours.some((h) => h.weekday === pythonWeekday);

      days.push({
        dateStr,
        label,
        fullLabel: `${dd}/${mm}`,
        isOpen
      });
    }
    return days;
  });

  readonly isCurrentDayClosed = computed<boolean>(() => {
    const curDate = this.selectedDate();
    const dayOpt = this.availableDays().find((d) => d.dateStr === curDate);
    return dayOpt ? !dayOpt.isOpen : false;
  });

  // Announcement & Day Part Signals
  readonly showAnnouncementModal = signal<boolean>(false);
  readonly selectedDayPart = signal<'all' | 'morning' | 'afternoon' | 'night'>('all');

  readonly distinctHours = computed<string[]>(() => {
    const slots = this.allDaySlots();
    const isAuto = this.isAutoMode();
    const grp = this.activeGroup();
    const filteredSlots = (isAuto && grp)
      ? slots.filter((s) => grp.court_ids.includes(s.court_id))
      : slots;
    const set = new Set<string>();
    for (const s of filteredSlots) {
      if (s.local_start_time) {
        set.add(s.local_start_time);
      }
    }
    return Array.from(set).sort();
  });

  readonly filteredHours = computed<string[]>(() => {
    const hours = this.distinctHours();
    const part = this.selectedDayPart();
    if (part === 'all') return hours;
    return hours.filter((h) => {
      const num = parseInt(h.split(':')[0], 10);
      if (part === 'morning') return num < 12;
      if (part === 'afternoon') return num >= 12 && num < 18;
      if (part === 'night') return num >= 18;
      return true;
    });
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
  }

  loadClubAndLayout(): void {
    const clubSlug = this.slug();
    this.publicService.getClub(clubSlug).subscribe({
      next: (c) => {
        this.club.set(c);

        // Check Announcement
        if (c.announcement && c.announcement.is_active) {
          const dismissed = sessionStorage.getItem(`canchariane_announcement_${c.slug}`);
          if (!dismissed) {
            this.showAnnouncementModal.set(true);
          }
        }

        if (c.court_groups && c.court_groups.length > 0) {
          this.selectedGroupId.set(c.court_groups[0].id);
        }
        if (c.allowed_durations && c.allowed_durations.length > 0) {
          const defaultDur = c.default_duration || c.allowed_durations[0];
          this.selectedDuration.set(defaultDur);
        }
        if (c.slot_step_minutes) {
          this.stepMode.set(c.slot_step_minutes === 30 ? 'half' : 'exact');
        }

        // Auto-select first open day if today is closed
        const days = this.availableDays();
        const curDate = this.selectedDate();
        const curDayOpt = days.find((d) => d.dateStr === curDate);
        if (!curDayOpt || !curDayOpt.isOpen) {
          const firstOpen = days.find((d) => d.isOpen);
          if (firstOpen) {
            this.selectedDate.set(firstOpen.dateStr);
          }
        }

        this.loadAvailability();
      },
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

    if (this.isCurrentDayClosed()) {
      this.allDaySlots.set([]);
      this.selectedHour.set('');
      this.isLoadingSlots.set(false);
      return;
    }

    const duration = this.selectedDuration();
    const step = this.stepMode() === 'half' ? 30 : duration;

    this.isLoadingSlots.set(true);
    this.publicService
      .getAvailability(clubSlug, dateStr, { duration, step })
      .subscribe({
        next: (slots) => {
          this.allDaySlots.set(slots);
          this.isLoadingSlots.set(false);
          const hours = this.distinctHours();
          if (hours.length > 0) {
            const cur = this.selectedHour();
            const target = (cur && hours.includes(cur)) ? cur : hours[0];
            this.selectHour(target);
          } else {
            this.selectedHour.set('');
            this.selectedCourtId.set(null);
          }
        },
        error: () => {
          this.isLoadingSlots.set(false);
          this.allDaySlots.set([]);
          this.selectedHour.set('');
          this.selectedCourtId.set(null);
        }
      });
  }

  selectDuration(minutes: number): void {
    this.selectedDuration.set(minutes);
    this.selectedCourtId.set(null);
    this.loadAvailability();
  }

  setStepMode(mode: 'exact' | 'half'): void {
    this.stepMode.set(mode);
    this.selectedCourtId.set(null);
    this.loadAvailability();
  }

  selectDate(d: string): void {
    const dayOpt = this.availableDays().find((opt) => opt.dateStr === d);
    if (dayOpt && !dayOpt.isOpen) return;
    this.selectedDate.set(d);
    this.selectedCourtId.set(null);
    this.selectedHour.set('');
    this.loadAvailability();
  }

  selectHour(h: string): void {
    this.selectedHour.set(h);
    if (this.isAutoMode()) {
      const grp = this.activeGroup();
      if (grp) {
        const freeSlot = this.allDaySlots().find(
          (s) => s.local_start_time === h && grp.court_ids.includes(s.court_id) && s.is_available
        );
        if (freeSlot) {
          this.selectedCourtId.set(freeSlot.court_id);
        } else {
          this.selectedCourtId.set(null);
        }
      }
    } else {
      this.selectedCourtId.set(null);
    }
  }

  selectGroup(groupId: string): void {
    this.selectedGroupId.set(groupId);
    this.selectedCourtId.set(null);
    const hours = this.distinctHours();
    if (hours.length > 0) {
      const cur = this.selectedHour();
      const target = (cur && hours.includes(cur)) ? cur : hours[0];
      this.selectHour(target);
    }
  }

  getAvailableCountForHour(hour: string): number {
    const grp = this.activeGroup();
    if (!grp) return 0;
    return this.allDaySlots().filter(
      (s) => s.local_start_time === hour && grp.court_ids.includes(s.court_id) && s.is_available
    ).length;
  }

  onCourtSelect(courtId: string): void {
    this.selectedCourtId.set(courtId);
  }

  formatTimeAmPm(timeStr?: string): string {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    let h = parseInt(parts[0], 10);
    if (isNaN(h)) return timeStr;
    const m = parts[1] || '00';
    const period = h >= 12 ? 'pm' : 'am';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${period}`;
  }

  getSlotForCourt(courtId: string): PublicSlot | undefined {
    return this.slotsForSelectedHour().find((s) => s.court_id === courtId);
  }

  getPriceForHour(hour: string): number | null {
    const grp = this.activeGroup();
    const slots = this.allDaySlots().filter((s) => s.local_start_time === hour);
    if (!slots.length) return null;
    if (grp) {
      const grpSlot = slots.find((s) => grp.court_ids.includes(s.court_id));
      if (grpSlot) return grpSlot.price_cents;
    }
    return slots[0].price_cents;
  }

  formatCurrencyCop(cents: number | null): string {
    if (cents == null) return '';
    return (cents / 100).toLocaleString('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    });
  }

  dismissAnnouncement(): void {
    const c = this.club();
    if (c) {
      sessionStorage.setItem(`canchariane_announcement_${c.slug}`, 'true');
    }
    this.showAnnouncementModal.set(false);
  }

  getAnnouncementWhatsAppUrl(ann: ClubAnnouncement): string {
    if (!ann.action_phone) return '#';
    const clean = ann.action_phone.replace(/\D/g, '');
    const phone = clean.length === 10 ? `57${clean}` : clean;
    const msg = encodeURIComponent(`Hola! Vengo de Canchariane y deseo información sobre: ${ann.title}`);
    return `https://wa.me/${phone}?text=${msg}`;
  }

  proceedToHold(): void {
    const slot = this.selectedSlot();
    const clubSlug = this.slug();
    if (!slot || !clubSlug) return;

    this.isHolding.set(true);
    const payload: any = {
      start_time: slot.start_time,
      duration_minutes: slot.duration_minutes
    };

    if (this.isAutoMode()) {
      payload.group_id = this.activeGroup()?.id;
    } else {
      payload.court_id = slot.court_id;
    }

    this.publicService
      .createHold(clubSlug, payload)
      .subscribe({
        next: (holdRes) => {
          this.hold.set(holdRes);
          if (holdRes.court_id) {
            this.selectedCourtId.set(holdRes.court_id);
          }
          this.isHolding.set(false);
          this.currentStep.set(2);
        },
        error: (err) => {
          this.isHolding.set(false);
          const detail = err.error?.detail;
          const msg = typeof detail === 'string'
            ? detail
            : (Array.isArray(detail) ? detail.map((d: any) => d.msg).join(' | ') : 'El turno ya no está disponible. Selecciona otro.');
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

    const rawPhone = this.customerPhone.trim();
    const formattedPhone = rawPhone.startsWith('+') ? rawPhone : `${this.customerDialCode} ${rawPhone}`.trim();

    this.publicService
      .confirmBooking(clubSlug, idempotencyKey, {
        hold_id: currentHold.hold_id,
        customer_name: this.customerName.trim(),
        customer_phone: formattedPhone,
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

  formatDurationText(minutes?: number): string {
    if (!minutes) return '1 hora';
    if (minutes === 30) return '30 min (media hora)';
    if (minutes === 60) return '1 hora';
    if (minutes === 90) return '1 hora y media (90 min)';
    if (minutes === 120) return '2 horas';
    if (minutes === 180) return '3 horas';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hrs} horas`;
    return `${hrs} h ${mins} min`;
  }

  getWhatsAppShareUrl(): string {
    const b = this.confirmedBooking();
    if (!b) return '#';
    const courtPart = this.isAutoMode() ? '' : `\nCancha: ${b.court_name}`;
    const text = encodeURIComponent(
      `¡Hola! Confirmé mi reserva deportiva en ${b.club_name}.${courtPart}\nCódigo: ${b.code}\nFecha: ${b.start_time}`
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
