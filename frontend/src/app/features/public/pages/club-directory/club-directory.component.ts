import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { PublicBookingService } from '../../services/public-booking.service';
import { PublicClubSummary } from '../../models/public.models';

type ViewMode = 'list' | 'map';

@Component({
  selector: 'app-club-directory',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-white text-slate-900 flex flex-col justify-between selection:bg-[#0056FB] selection:text-white font-sans antialiased">
      
      <!-- TOP NAVIGATION BAR (Nubank Clean / Minimalist) -->
      <header class="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          
          <!-- Logo & Brand -->
          <a routerLink="/" class="flex items-center gap-2.5 active:opacity-80 transition-opacity">
            <img src="logo-mark.svg" alt="Canchariane" class="w-8 h-8 rounded-xl" />
            <div class="flex flex-col">
              <span class="font-bold text-base tracking-tight text-slate-900 leading-none">Canchariane</span>
              <span class="text-[11px] text-slate-400 font-medium">Reservas deportivas</span>
            </div>
          </a>

          <!-- Right Action Pills -->
          <div class="flex items-center gap-2">
            <a
              routerLink="/lookup"
              class="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5"
            >
              <span>🔍</span>
              <span class="hidden sm:inline">Consultar</span>
              <span class="sm:hidden">Buscar</span>
            </a>

            <a
              routerLink="/auth/login"
              class="text-xs font-semibold text-[#0056FB] bg-blue-50/70 hover:bg-blue-100/70 px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <span>Acceso Clubes</span>
              <span class="text-[10px]">➔</span>
            </a>
          </div>
        </div>
      </header>

      <!-- MAIN CONTENT -->
      <main class="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-24 w-full flex-1">
        
        <!-- HEADER TITLE & MUNICIPALITY SELECTOR -->
        <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span class="text-xs font-medium text-slate-500">Disponibilidad en vivo</span>
            </div>
            
            <div class="flex items-baseline gap-2 flex-wrap">
              <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Canchas en
              </h1>
              
              <!-- Subtle City Dropdown Trigger (Nubank selector style) -->
              <div class="relative inline-block">
                <select
                  [ngModel]="selectedCity()"
                  (ngModelChange)="selectCity($event)"
                  aria-label="Seleccionar ciudad o municipio"
                  class="appearance-none bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xl sm:text-2xl tracking-tight pl-3 pr-8 py-1 rounded-xl cursor-pointer border-none focus:outline-none focus:ring-2 focus:ring-[#0056FB] transition-colors"
                >
                  <option value="all">Todo Risaralda</option>
                  <option value="pereira">Pereira</option>
                  <option value="dosquebradas">Dosquebradas</option>
                  <option value="santa_rosa">Santa Rosa de Cabal</option>
                </select>
                <span class="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs">▼</span>
              </div>
            </div>
          </div>

          <!-- Desktop View Switcher (List vs Map) -->
          <div class="hidden md:flex items-center bg-slate-100 p-1 rounded-2xl">
            <button
              type="button"
              (click)="setViewMode('list')"
              [class.bg-white]="viewMode() === 'list'"
              [class.text-slate-900]="viewMode() === 'list'"
              [class.shadow-xs]="viewMode() === 'list'"
              [class.text-slate-500]="viewMode() !== 'list'"
              class="px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <span>📋</span>
              <span>Lista</span>
            </button>
            <button
              type="button"
              (click)="setViewMode('map')"
              [class.bg-white]="viewMode() === 'map'"
              [class.text-slate-900]="viewMode() === 'map'"
              [class.shadow-xs]="viewMode() === 'map'"
              [class.text-slate-500]="viewMode() !== 'map'"
              class="px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <span>🗺️</span>
              <span>Mapa</span>
            </button>
          </div>
        </div>

        <!-- SEARCH INPUT & QUICK SPORT FILTER PILLS (Thumb-friendly Nubank Feed) -->
        <div class="space-y-3 mb-6">
          
          <!-- Compact Search Bar -->
          <div class="relative">
            <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input
              type="text"
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              placeholder="Buscar por club, sector o dirección..."
              class="w-full pl-10 pr-9 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-sm text-slate-900 placeholder:text-slate-400 rounded-2xl border border-slate-200/80 focus:border-[#0056FB] focus:outline-none focus:ring-1 focus:ring-[#0056FB] transition-all"
            />
            @if (searchQuery()) {
              <button
                type="button"
                (click)="searchQuery.set('')"
                class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs p-1"
              >
                ✕
              </button>
            }
          </div>

          <!-- Sport Pills (Horizontal swipe on mobile) -->
          <div class="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
            <button
              type="button"
              (click)="selectedSport.set('all')"
              [class.bg-[#0056FB]]="selectedSport() === 'all'"
              [class.text-white]="selectedSport() === 'all'"
              [class.bg-slate-100]="selectedSport() !== 'all'"
              [class.text-slate-700]="selectedSport() !== 'all'"
              class="px-4 py-2 rounded-xl text-xs font-semibold shrink-0 transition-colors"
            >
              Todos ({{ clubs().length }})
            </button>

            <button
              type="button"
              (click)="selectedSport.set('padel')"
              [class.bg-[#0056FB]]="selectedSport() === 'padel'"
              [class.text-white]="selectedSport() === 'padel'"
              [class.bg-slate-100]="selectedSport() !== 'padel'"
              [class.text-slate-700]="selectedSport() !== 'padel'"
              class="px-4 py-2 rounded-xl text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5"
            >
              <span>🎾</span>
              <span>Pádel</span>
            </button>

            <button
              type="button"
              (click)="selectedSport.set('futbol')"
              [class.bg-[#0056FB]]="selectedSport() === 'futbol'"
              [class.text-white]="selectedSport() === 'futbol'"
              [class.bg-slate-100]="selectedSport() !== 'futbol'"
              [class.text-slate-700]="selectedSport() !== 'futbol'"
              class="px-4 py-2 rounded-xl text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5"
            >
              <span>⚽</span>
              <span>Fútbol</span>
            </button>

            <button
              type="button"
              (click)="selectedSport.set('tennis')"
              [class.bg-[#0056FB]]="selectedSport() === 'tennis'"
              [class.text-white]="selectedSport() === 'tennis'"
              [class.bg-slate-100]="selectedSport() !== 'tennis'"
              [class.text-slate-700]="selectedSport() !== 'tennis'"
              class="px-4 py-2 rounded-xl text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5"
            >
              <span>🎾</span>
              <span>Tenis</span>
            </button>
          </div>
        </div>

        <!-- LOADING STATE -->
        @if (isLoading()) {
          <div class="py-24 text-center space-y-3">
            <div class="w-8 h-8 border-2 border-[#0056FB] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p class="text-xs font-medium text-slate-400">Buscando canchas disponibles...</p>
          </div>
        } @else {

          <!-- EMPTY STATE -->
          @if (filteredClubs().length === 0) {
            <div class="py-16 px-4 text-center max-w-sm mx-auto space-y-3">
              <span class="text-3xl">🏟️</span>
              <h3 class="text-base font-bold text-slate-900">No encontramos canchas con esos filtros</h3>
              <p class="text-xs text-slate-500">Prueba cambiando la búsqueda o seleccionando "Todos" los deportes.</p>
              <button
                type="button"
                (click)="resetFilters()"
                class="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Restablecer filtros
              </button>
            </div>
          } @else {

            <!-- VIEW MODE: LIST -->
            @if (viewMode() === 'list') {
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                @for (club of filteredClubs(); track club.id) {
                  <div class="bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 p-4 transition-all duration-200 flex flex-col justify-between shadow-xs">
                    <div>
                      <!-- Card Header -->
                      <div class="flex items-start gap-3 mb-3">
                        @if (club.logo_url) {
                          <img [src]="club.logo_url" [alt]="club.name" class="w-12 h-12 rounded-xl object-cover border border-slate-100 shrink-0" />
                        } @else {
                          <div class="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">
                            🏟️
                          </div>
                        }

                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5">
                            <span class="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                              Abierto
                            </span>
                            <span class="text-[11px] text-slate-400 truncate">• {{ club.city || 'Pereira' }}</span>
                          </div>
                          <h2 class="text-base font-bold text-slate-900 truncate mt-0.5">
                            {{ club.name }}
                          </h2>
                        </div>
                      </div>

                      <!-- Sport Tags -->
                      <div class="flex flex-wrap gap-1 mb-3">
                        @for (sport of club.sports || []; track sport) {
                          <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium capitalize">
                            {{ getSportEmoji(sport) }} {{ sport }}
                          </span>
                        }
                      </div>

                      <!-- Address -->
                      <p class="text-xs text-slate-500 line-clamp-1 mb-4 flex items-center gap-1">
                        <span>📍</span>
                        <span>{{ club.address || 'Pereira, Risaralda' }}</span>
                      </p>
                    </div>

                    <!-- Bottom Actions (Thumb-friendly) -->
                    <div class="pt-3 border-t border-slate-100 flex items-center gap-2">
                      <a
                        [href]="getDirectionsUrl(club)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                        title="Cómo llegar"
                      >
                        <span>🧭</span>
                        <span class="hidden sm:inline">Mapa</span>
                      </a>

                      <a
                        [routerLink]="['/c', club.slug]"
                        class="flex-1 py-2.5 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] active:scale-[0.98] text-white text-xs font-bold text-center transition-all shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <span>Reservar Cancha</span>
                        <span class="text-xs">➔</span>
                      </a>
                    </div>
                  </div>
                }
              </div>
            }

            <!-- VIEW MODE: MAP -->
            @if (viewMode() === 'map') {
              <div class="flex flex-col lg:grid lg:grid-cols-12 gap-4">
                
                <!-- Interactive Leaflet Map Container -->
                <div class="lg:col-span-8 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200/80 relative shadow-xs">
                  <div class="w-full h-[360px] sm:h-[460px] lg:h-[580px]">
                    <div #mapContainer class="w-full h-full z-10"></div>
                  </div>

                  <!-- Center on Pereira Button -->
                  <button
                    type="button"
                    (click)="centerOnPereira()"
                    class="absolute top-3 right-3 z-20 px-3 py-1.5 rounded-xl bg-white/95 text-slate-700 text-xs font-semibold shadow-xs border border-slate-200 transition-colors flex items-center gap-1 active:scale-95"
                  >
                    <span>📍</span>
                    <span>Centrar</span>
                  </button>
                </div>

                <!-- Clubs Sidebar (Desktop) / Horizontal Swipe (Mobile) -->
                <div class="lg:col-span-4">
                  
                  <!-- Desktop Vertical Sidebar -->
                  <div class="hidden lg:block space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                    <div class="text-xs font-medium text-slate-500 px-1 mb-1">
                      {{ filteredClubs().length }} canchas disponibles
                    </div>

                    @for (club of filteredClubs(); track club.id) {
                      <div
                        (click)="focusClubOnMap(club)"
                        class="p-3.5 bg-white rounded-2xl border transition-all duration-150 cursor-pointer"
                        [ngClass]="selectedMapClub()?.id === club.id
                          ? 'border-[#0056FB] bg-blue-50/40 ring-1 ring-[#0056FB]'
                          : 'border-slate-200/80 hover:border-slate-300'"
                      >
                        <div class="flex items-start justify-between gap-2 mb-1">
                          <h4 class="text-sm font-bold text-slate-900 leading-snug">
                            {{ club.name }}
                          </h4>
                          <span class="text-[10px] text-slate-400 font-medium shrink-0">{{ club.city || 'Pereira' }}</span>
                        </div>

                        <p class="text-xs text-slate-500 line-clamp-1 mb-3">
                          📍 {{ club.address || 'Pereira, Risaralda' }}
                        </p>

                        <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                          <div class="flex gap-1 items-center">
                            @for (sport of club.sports || []; track sport) {
                              <span class="text-xs bg-slate-100 px-1.5 py-0.5 rounded-md">
                                {{ getSportEmoji(sport) }}
                              </span>
                            }
                          </div>

                          <a
                            [routerLink]="['/c', club.slug]"
                            (click)="$event.stopPropagation()"
                            class="px-3 py-1.5 bg-[#0056FB] hover:bg-[#0048d6] text-white rounded-xl text-xs font-bold transition-colors"
                          >
                            Reservar ➔
                          </a>
                        </div>
                      </div>
                    }
                  </div>

                  <!-- Mobile Horizontal Snap Carousel -->
                  <div class="block lg:hidden mt-2">
                    <div class="text-xs font-medium text-slate-500 mb-2 px-1">
                      Toca un club para ubicarlo en el mapa:
                    </div>

                    <div class="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none snap-x">
                      @for (club of filteredClubs(); track club.id) {
                        <div
                          (click)="focusClubOnMap(club)"
                          class="min-w-[260px] max-w-[280px] p-3.5 bg-white rounded-2xl border shrink-0 snap-start transition-all"
                          [ngClass]="selectedMapClub()?.id === club.id
                            ? 'border-[#0056FB] bg-blue-50/40 ring-1 ring-[#0056FB]'
                            : 'border-slate-200/80'"
                        >
                          <div class="flex items-start justify-between gap-2 mb-1">
                            <h4 class="text-sm font-bold text-slate-900 truncate">
                              {{ club.name }}
                            </h4>
                            <span class="text-[10px] text-slate-400 shrink-0">{{ club.city || 'Pereira' }}</span>
                          </div>

                          <p class="text-xs text-slate-500 truncate mb-3">
                            📍 {{ club.address || 'Pereira, Risaralda' }}
                          </p>

                          <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                            <div class="flex gap-1 items-center">
                              @for (sport of club.sports || []; track sport) {
                                <span class="text-xs bg-slate-100 px-1.5 py-0.5 rounded-md">
                                  {{ getSportEmoji(sport) }}
                                </span>
                              }
                            </div>

                            <a
                              [routerLink]="['/c', club.slug]"
                              (click)="$event.stopPropagation()"
                              class="px-3 py-1.5 bg-[#0056FB] text-white rounded-xl text-xs font-bold"
                            >
                              Reservar ➔
                            </a>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                </div>
              </div>
            }
          }
        }

        <!-- FAQ SECTION (Clean Accordion) -->
        <section class="mt-14 pt-10 border-t border-slate-100 max-w-2xl mx-auto">
          <div class="text-center mb-6">
            <h3 class="text-lg font-bold text-slate-900">
              Preguntas frecuentes
            </h3>
            <p class="text-xs text-slate-500 mt-1">
              Todo lo que necesitas saber para reservar en Pereira y Risaralda.
            </p>
          </div>

          <div class="space-y-2">
            @for (faq of faqs; track faq.id) {
              <div class="bg-slate-50/70 rounded-xl border border-slate-100 overflow-hidden">
                <button
                  type="button"
                  (click)="toggleFaq(faq.id)"
                  class="w-full px-4 py-3 text-left flex items-center justify-between gap-3 hover:bg-slate-100/60 transition-colors"
                >
                  <span class="text-xs sm:text-sm font-semibold text-slate-900">{{ faq.question }}</span>
                  <span class="text-slate-400 text-xs shrink-0 transition-transform duration-200" [class.rotate-180]="expandedFaq() === faq.id">
                    ▼
                  </span>
                </button>
                @if (expandedFaq() === faq.id) {
                  <div class="px-4 pb-3 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-2.5">
                    {{ faq.answer }}
                  </div>
                }
              </div>
            }
          </div>
        </section>
      </main>

      <!-- MOBILE BOTTOM FLOATING SWITCHER (Airbnb / Nubank Style - thumb reach) -->
      <div class="md:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-30">
        <div class="bg-slate-900 text-white p-1 rounded-full shadow-lg flex items-center gap-1 border border-slate-800">
          <button
            type="button"
            (click)="setViewMode('list')"
            [class.bg-[#0056FB]]="viewMode() === 'list'"
            [class.text-white]="viewMode() === 'list'"
            [class.text-slate-300]="viewMode() !== 'list'"
            class="px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <span>📋</span>
            <span>Lista</span>
          </button>
          <button
            type="button"
            (click)="setViewMode('map')"
            [class.bg-[#0056FB]]="viewMode() === 'map'"
            [class.text-white]="viewMode() === 'map'"
            [class.text-slate-300]="viewMode() !== 'map'"
            class="px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <span>🗺️</span>
            <span>Mapa</span>
          </button>
        </div>
      </div>

      <!-- FOOTER -->
      <footer class="border-t border-slate-100 bg-white py-6 text-xs text-slate-500">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div class="flex items-center gap-2">
            <img src="logo-mark.svg" alt="Canchariane" class="w-5 h-5 opacity-70" />
            <span class="text-slate-400">© 2026 Canchariane • Pereira, Colombia</span>
          </div>

          <div class="flex items-center gap-5 text-[11px] text-slate-500">
            <a routerLink="/lookup" class="hover:text-slate-900 transition-colors">Consultar Reserva</a>
            <a routerLink="/auth/login" class="hover:text-slate-900 transition-colors">Acceso Clubes</a>
          </div>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class ClubDirectoryComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly bookingService = inject(PublicBookingService);

  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLDivElement>;

  readonly clubs = signal<PublicClubSummary[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly searchQuery = signal<string>('');
  readonly selectedSport = signal<string>('all');
  readonly viewMode = signal<ViewMode>('list');
  readonly selectedMapClub = signal<PublicClubSummary | null>(null);
  readonly selectedCity = signal<string>('all');
  readonly expandedFaq = signal<number | null>(null);

  // Map state
  private map?: L.Map;
  private markersMap = new Map<string, L.Marker>();

  // Pereira center defaults
  private readonly PEREIRA_LAT = 4.8133;
  private readonly PEREIRA_LNG = -75.6961;
  private readonly PEREIRA_ZOOM = 13;

  readonly faqs = [
    {
      id: 1,
      question: '¿Cómo alquilar una cancha de fútbol o pádel en Pereira?',
      answer: 'En Canchariane puedes consultar la disponibilidad en tiempo real en Pereira, Dosquebradas y Santa Rosa de Cabal. Seleccionas el club, la cancha y la hora libre, y reservas al instante sin necesidad de llamadas telefónicas.'
    },
    {
      id: 2,
      question: '¿Cuánto cuesta alquilar una cancha sintética en Pereira?',
      answer: 'Los precios oscilan habitualmente entre $50.000 y $120.000 COP por hora dependiendo del tipo de cancha (fútbol 5, fútbol 7 o pádel), si cuenta con cubierta techada y el horario (diurno o nocturno con iluminación).'
    },
    {
      id: 3,
      question: '¿Hay canchas sintéticas techadas disponibles?',
      answer: 'Sí, en Canchariane puedes encontrar clubes con canchas techadas e iluminación profesional para jugar protegidos de la lluvia tanto en Pereira como en Dosquebradas.'
    },
    {
      id: 4,
      question: '¿Qué medios de pago reciben los clubes en Canchariane?',
      answer: 'Cada club ofrece opciones de pago cómodas, incluyendo transferencias por Nequi, Daviplata, Bancolombia o pago directo en la recepción del club.'
    },
    {
      id: 5,
      question: '¿Cómo puedo inscribir mi club de fútbol o pádel a Canchariane?',
      answer: 'Los clubes y administradores deportivos de Risaralda pueden unirse a Canchariane para automatizar sus reservas y recibir pagos. Contáctanos a través del enlace de Acceso Clubes en el menú superior.'
    }
  ];

  readonly filteredClubs = computed(() => {
    const list = this.clubs();
    const query = this.searchQuery().toLowerCase().trim();
    const sport = this.selectedSport();
    const city = this.selectedCity();

    return list.filter((club) => {
      // Search text match
      const nameMatch = club.name?.toLowerCase().includes(query) ?? false;
      const addrMatch = club.address?.toLowerCase().includes(query) ?? false;
      const cityTextMatch = club.city?.toLowerCase().includes(query) ?? false;
      const matchesSearch = !query || nameMatch || addrMatch || cityTextMatch;

      // Sport match
      let matchesSport = true;
      if (sport !== 'all') {
        matchesSport = (club.sports || []).some((s) =>
          s.toLowerCase().includes(sport)
        );
      }

      // City filter match
      let matchesCity = true;
      if (city !== 'all') {
        const clubCity = (club.city || '').toLowerCase();
        if (city === 'pereira') {
          matchesCity = clubCity.includes('pereira');
        } else if (city === 'dosquebradas') {
          matchesCity = clubCity.includes('dosquebradas');
        } else if (city === 'santa_rosa') {
          matchesCity = clubCity.includes('santa rosa');
        }
      }

      return matchesSearch && matchesSport && matchesCity;
    });
  });

  ngOnInit(): void {
    this.loadClubs();
  }

  ngAfterViewInit(): void {
    if (this.viewMode() === 'map') {
      setTimeout(() => this.initMap(), 150);
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
  }

  loadClubs(): void {
    this.isLoading.set(true);
    this.bookingService.listClubs().subscribe({
      next: (clubs) => {
        this.clubs.set(clubs);
        this.isLoading.set(false);
        if (this.viewMode() === 'map') {
          setTimeout(() => {
            if (!this.map) {
              this.initMap();
            } else {
              this.refreshMapMarkers();
            }
          }, 150);
        }
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
    if (mode === 'map') {
      setTimeout(() => {
        if (!this.map) {
          this.initMap();
        } else {
          this.map.invalidateSize();
          this.refreshMapMarkers();
        }
      }, 100);
    }
  }

  selectCity(city: string): void {
    this.selectedCity.set(city);
    if (this.map) {
      if (city === 'pereira') {
        this.map.flyTo([this.PEREIRA_LAT, this.PEREIRA_LNG], 13);
      } else if (city === 'dosquebradas') {
        this.map.flyTo([4.8360, -75.6790], 13);
      } else if (city === 'santa_rosa') {
        this.map.flyTo([4.8689, -75.6214], 13);
      } else {
        this.map.flyTo([this.PEREIRA_LAT, this.PEREIRA_LNG], 12);
      }
    }
    setTimeout(() => this.refreshMapMarkers(), 100);
  }

  toggleFaq(id: number): void {
    this.expandedFaq.set(this.expandedFaq() === id ? null : id);
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.selectedSport.set('all');
    this.selectedCity.set('all');
  }

  getSportEmoji(sport: string): string {
    const s = sport.toLowerCase();
    if (s.includes('padel') || s.includes('pádel')) return '🎾';
    if (s.includes('futbol') || s.includes('fútbol')) return '⚽';
    if (s.includes('tenis') || s.includes('tennis')) return '🎾';
    return '🏆';
  }

  getDirectionsUrl(club: PublicClubSummary): string {
    if (club.latitude != null && club.longitude != null) {
      return `https://www.google.com/maps/dir/?destination=${club.latitude},${club.longitude}`;
    }
    const query = encodeURIComponent(`${club.name}, ${club.address || 'Pereira, Risaralda'}`);
    return `https://www.google.com/maps/search/?query=${query}`;
  }

  centerOnPereira(): void {
    if (!this.map) return;
    this.map.flyTo([this.PEREIRA_LAT, this.PEREIRA_LNG], this.PEREIRA_ZOOM, {
      duration: 1.2
    });
  }

  focusClubOnMap(club: PublicClubSummary): void {
    this.selectedMapClub.set(club);
    if (!this.map) return;

    const lat = club.latitude ?? this.PEREIRA_LAT;
    const lng = club.longitude ?? this.PEREIRA_LNG;

    this.map.flyTo([lat, lng], 16, { duration: 1 });

    const marker = this.markersMap.get(club.id);
    if (marker) {
      marker.openPopup();
    }
  }

  private initMap(): void {
    if (!this.mapContainer?.nativeElement || this.map) return;

    this.map = L.map(this.mapContainer.nativeElement, {
      center: [this.PEREIRA_LAT, this.PEREIRA_LNG],
      zoom: this.PEREIRA_ZOOM,
      zoomControl: false // Cleaner interface
    });

    // Add minimal zoom control top-left
    L.control.zoom({ position: 'topleft' }).addTo(this.map);

    // OpenStreetMap 100% Free Tile Layer (No API Key required)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(this.map);

    this.refreshMapMarkers();

    setTimeout(() => {
      this.map?.invalidateSize();
    }, 200);
  }

  private refreshMapMarkers(): void {
    if (!this.map) return;

    // Clear old markers
    this.markersMap.forEach((m) => m.remove());
    this.markersMap.clear();

    const clubsList = this.filteredClubs();

    clubsList.forEach((club) => {
      const lat = club.latitude ?? this.PEREIRA_LAT;
      const lng = club.longitude ?? this.PEREIRA_LNG;

      // Clean circular pin with Canchariane blue and white border (Nubank minimalist pin style)
      const markerIcon = L.divIcon({
        className: 'canchariane-clean-pin',
        html: `
          <div style="
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background: #0056FB;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0, 86, 251, 0.35);
            border: 2px solid #ffffff;
            cursor: pointer;
            transition: transform 0.15s ease;
          ">
            <span style="font-size: 15px; line-height: 1;">
              ${this.getSportEmoji(club.sports?.[0] || 'club')}
            </span>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18]
      });

      const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(this.map!);

      const popupHtml = `
        <div style="padding: 10px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 190px;">
          <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: #0056FB; margin-bottom: 2px;">
            ${club.city || 'Pereira, Risaralda'}
          </div>
          <strong style="color: #0F172A; font-size: 13px; font-weight: 700; display: block; margin-bottom: 2px;">
            ${club.name}
          </strong>
          <p style="color: #64748B; font-size: 11px; margin: 0 0 10px 0; line-height: 1.3;">
            ${club.address || 'Pereira, Colombia'}
          </p>
          <div style="display: flex; gap: 6px; align-items: center; justify-content: space-between; border-top: 1px solid #F1F5F9; padding-top: 8px;">
            <a
              href="${this.getDirectionsUrl(club)}"
              target="_blank"
              rel="noopener noreferrer"
              style="font-size: 11px; color: #64748B; text-decoration: none; padding: 4px 8px; border: 1px solid #E2E8F0; border-radius: 8px; font-weight: 600;"
            >
              🧭 Mapa
            </a>
            <a
              href="/c/${club.slug}"
              style="font-size: 11px; color: white; background: #0056FB; text-decoration: none; padding: 5px 10px; border-radius: 8px; font-weight: 700;"
            >
              Reservar ➔
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on('click', () => {
        this.selectedMapClub.set(club);
      });

      this.markersMap.set(club.id, marker);
    });
  }
}
