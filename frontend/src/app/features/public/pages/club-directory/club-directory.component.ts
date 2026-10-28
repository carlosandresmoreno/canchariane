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
    <div class="relative min-h-screen bg-slate-50/50 text-slate-900 flex flex-col justify-between selection:bg-[#0056FB] selection:text-white font-sans overflow-x-hidden">
      <!-- Clean Luminous Ambient Background Glow -->
      <div class="ambient-lighting"></div>

      <!-- Top Header Navigation -->
      <header class="relative z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl sticky top-0 shadow-xs">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div class="flex items-center gap-3.5">
            <img src="logo-mark.svg" alt="Canchariane" class="w-10 h-10 rounded-2xl shadow-xs" />
            <div>
              <div class="flex items-center gap-2">
                <span class="font-mono text-[10px] tracking-[0.25em] text-[#0056FB] font-semibold uppercase">Canchariane</span>
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span class="text-[11px] text-slate-500 font-mono">Pereira, COL</span>
              </div>
              <h1 class="font-serif italic text-xl sm:text-2xl text-slate-900 tracking-tight leading-none mt-0.5">
                Reserva de Canchas
              </h1>
            </div>
          </div>

          <div class="flex items-center gap-2 sm:gap-3">
            <a
              routerLink="/lookup"
              class="text-xs font-mono uppercase tracking-wider text-slate-700 hover:text-slate-950 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-xs hidden sm:inline-flex items-center gap-1.5"
            >
              <span>🔍</span>
              <span>Consultar Reserva</span>
            </a>
            <a
              routerLink="/auth/login"
              class="text-xs font-mono uppercase tracking-wider text-[#0056FB] hover:text-[#0048d6] px-4 py-2.5 rounded-xl bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200/80 transition-all shadow-xs flex items-center gap-1.5 font-semibold"
              title="Acceso para administradores y recepcionistas de clubes"
            >
              <span>Acceso Clubes</span>
              <span class="text-[10px]">➔</span>
            </a>
          </div>
        </div>
      </header>

      <!-- Main Directory Experience -->
      <main class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full flex-1">
        <!-- Hero Explanation Section -->
        <div class="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/60 text-[#0056FB] text-xs font-mono uppercase tracking-widest mb-4 shadow-2xs">
            <span class="w-2 h-2 rounded-full bg-[#0056FB] animate-ping"></span>
            <span>📍 Operando en Pereira, Risaralda</span>
          </div>

          <h2 class="text-3xl sm:text-5xl font-serif italic text-slate-950 tracking-tight leading-tight mb-4">
            Alquiler de canchas sintéticas, <br class="hidden sm:inline"/>fútbol y pádel en Pereira.
          </h2>

          <p class="text-sm sm:text-base text-slate-600 font-normal leading-relaxed max-w-2xl mx-auto">
            Explora las canchas disponibles en tiempo real directamente en el mapa, consulta horarios libres y reserva al instante sin intermediarios ni llamadas.
          </p>

          <!-- Expansion Notice Badge -->
          <div class="mt-4 text-[11px] font-mono text-slate-400">
            <span>✨ Cobertura inicial en el Eje Cafetero. Próximamente en Manizales, Armenia y más ciudades.</span>
          </div>
        </div>

        <!-- Controls Bar: Search, Sport Filters & View Mode Toggle -->
        <div class="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs mb-8 space-y-4">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <!-- Search Input -->
            <div class="relative flex-1">
              <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              <input
                type="text"
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event)"
                placeholder="Buscar club por nombre, sector o dirección..."
                class="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0056FB] focus:ring-1 focus:ring-[#0056FB] transition-all"
              />
              @if (searchQuery()) {
                <button
                  type="button"
                  (click)="searchQuery.set('')"
                  class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs"
                >
                  ✕
                </button>
              }
            </div>

            <!-- View Mode Switcher -->
            <div class="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl self-start md:self-auto border border-slate-200/60">
              <button
                type="button"
                (click)="setViewMode('list')"
                [class.bg-white]="viewMode() === 'list'"
                [class.text-slate-950]="viewMode() === 'list'"
                [class.shadow-2xs]="viewMode() === 'list'"
                [class.text-slate-500]="viewMode() !== 'list'"
                class="px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider font-semibold transition-all flex items-center gap-2"
              >
                <span>📋</span>
                <span>Modo Lista</span>
              </button>

              <button
                type="button"
                (click)="setViewMode('map')"
                [class.bg-white]="viewMode() === 'map'"
                [class.text-slate-950]="viewMode() === 'map'"
                [class.shadow-2xs]="viewMode() === 'map'"
                [class.text-slate-500]="viewMode() !== 'map'"
                class="px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider font-semibold transition-all flex items-center gap-2"
              >
                <span>🗺️</span>
                <span>Modo Mapa</span>
              </button>
            </div>
          </div>

          <!-- Sport Filter Badges -->
          <div class="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span class="text-slate-400 font-mono text-[11px] uppercase tracking-wider mr-1 hidden sm:inline">Deporte:</span>
            
            <button
              type="button"
              (click)="selectedSport.set('all')"
              [class.bg-[#0056FB]]="selectedSport() === 'all'"
              [class.text-white]="selectedSport() === 'all'"
              [class.bg-slate-100]="selectedSport() !== 'all'"
              [class.text-slate-700]="selectedSport() !== 'all'"
              class="px-3.5 py-1.5 rounded-full font-mono text-xs uppercase tracking-wider font-medium transition-all shrink-0 hover:bg-slate-200"
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
              class="px-3.5 py-1.5 rounded-full font-mono text-xs uppercase tracking-wider font-medium transition-all shrink-0 hover:bg-slate-200 flex items-center gap-1.5"
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
              class="px-3.5 py-1.5 rounded-full font-mono text-xs uppercase tracking-wider font-medium transition-all shrink-0 hover:bg-slate-200 flex items-center gap-1.5"
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
              class="px-3.5 py-1.5 rounded-full font-mono text-xs uppercase tracking-wider font-medium transition-all shrink-0 hover:bg-slate-200 flex items-center gap-1.5"
            >
              <span>🎾</span>
              <span>Tenis</span>
            </button>
          </div>
        </div>

        <!-- Loading State -->
        @if (isLoading()) {
          <div class="py-20 text-center space-y-3">
            <div class="w-8 h-8 border-2 border-[#0056FB] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p class="text-xs font-mono text-slate-500 uppercase tracking-widest">Cargando clubes en Pereira...</p>
          </div>
        } @else {
          <!-- VIEW MODE: LIST -->
          @if (viewMode() === 'list') {
            @if (filteredClubs().length === 0) {
              <div class="p-12 text-center bg-white rounded-3xl border border-slate-200/80 max-w-lg mx-auto space-y-4">
                <span class="text-3xl">🏟️</span>
                <h3 class="text-base font-serif italic text-slate-900">No encontramos clubes con ese criterio</h3>
                <p class="text-xs text-slate-500">Prueba ajustando el término de búsqueda o selecciona "Todos" los deportes.</p>
                <button
                  type="button"
                  (click)="resetFilters()"
                  class="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-mono uppercase tracking-wider hover:bg-slate-800 transition-all"
                >
                  Restablecer Filtros
                </button>
              </div>
            } @else {
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                @for (club of filteredClubs(); track club.id) {
                  <div class="group bg-white rounded-3xl border border-slate-200/80 hover:border-blue-300 hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden">
                    <div class="p-6">
                      <!-- Club Header Card -->
                      <div class="flex items-start justify-between gap-3 mb-4">
                        <div class="flex items-center gap-3">
                          @if (club.logo_url) {
                            <img [src]="club.logo_url" [alt]="club.name" class="w-12 h-12 rounded-2xl object-cover border border-slate-100 shadow-2xs" />
                          } @else {
                            <div class="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-xl shadow-2xs group-hover:scale-105 transition-transform">
                              🏟️
                            </div>
                          }
                          <div>
                            <span class="text-[10px] font-mono uppercase tracking-widest text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">
                              Abierto
                            </span>
                            <h3 class="text-lg font-serif italic text-slate-950 mt-1 leading-snug group-hover:text-[#0056FB] transition-colors">
                              {{ club.name }}
                            </h3>
                          </div>
                        </div>
                      </div>

                      <!-- Sports Tags -->
                      <div class="flex flex-wrap gap-1.5 mb-4">
                        @for (sport of club.sports || []; track sport) {
                          <span class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-mono capitalize">
                            {{ getSportEmoji(sport) }} {{ sport }}
                          </span>
                        }
                      </div>

                      <!-- Address & Location info -->
                      <div class="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                        <div class="flex items-start gap-2">
                          <span class="text-slate-400 mt-0.5">📍</span>
                          <span class="line-clamp-2">{{ club.address || 'Pereira, Risaralda' }}</span>
                        </div>
                        @if (club.phone) {
                          <div class="flex items-center gap-2 text-slate-500">
                            <span class="text-slate-400">📞</span>
                            <span>{{ club.phone }}</span>
                          </div>
                        }
                      </div>
                    </div>

                    <!-- Card Actions -->
                    <div class="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                      <!-- Cómo Llegar -->
                      <a
                        [href]="getDirectionsUrl(club)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-950 hover:border-slate-300 text-xs font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-2xs"
                        title="Abrir indicaciones en Google Maps / Waze"
                      >
                        <span>🧭</span>
                        <span>Cómo llegar</span>
                        <span class="text-[10px]">↗</span>
                      </a>

                      <!-- Reservar Cancha Button -->
                      <a
                        [routerLink]="['/c', club.slug]"
                        class="px-4 py-2 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] text-white text-xs font-mono uppercase tracking-wider font-semibold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                      >
                        <span>Reservar</span>
                        <span class="text-xs">➔</span>
                      </a>
                    </div>
                  </div>
                }
              </div>
            }
          }

          <!-- VIEW MODE: MAP (AWWWARDS MODERN MAP-FIRST EXPERIENCE) -->
          @if (viewMode() === 'map') {
            <div class="flex flex-col lg:grid lg:grid-cols-12 gap-5 lg:gap-6">
              <!-- Interactive Map Container (Order 1 on mobile, 8 cols on desktop) -->
              <div class="order-1 lg:order-2 lg:col-span-8 bg-white rounded-3xl border border-slate-200/90 p-2 sm:p-2.5 shadow-sm">
                <div class="relative w-full h-[400px] sm:h-[500px] lg:h-[620px] rounded-2xl overflow-hidden bg-slate-100">
                  <div #mapContainer class="w-full h-full z-10"></div>

                  <!-- Overlay Legend on Map -->
                  <div class="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-20 bg-white/95 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-200/80 shadow-md text-xs font-mono text-slate-700 pointer-events-none flex items-center gap-2.5">
                    <div class="flex items-center gap-1.5">
                      <span class="w-2.5 h-2.5 rounded-full bg-[#0056FB] animate-pulse"></span>
                      <span class="text-[11px] font-semibold">Canchas Disponibles</span>
                    </div>
                    <span class="text-slate-300">|</span>
                    <span class="text-[10px] text-slate-500">Pereira</span>
                  </div>

                  <!-- Center on Pereira Button -->
                  <button
                    type="button"
                    (click)="centerOnPereira()"
                    class="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 px-3 py-2 rounded-xl bg-white/95 hover:bg-white text-slate-800 text-xs font-mono tracking-wider shadow-md border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    title="Centrar mapa en Pereira"
                  >
                    <span>📍</span>
                    <span class="hidden sm:inline">Centrar</span>
                    <span>Pereira</span>
                  </button>
                </div>
              </div>

              <!-- Club Cards (Order 2 on mobile: horizontal touch swipe on mobile, vertical sidebar on desktop) -->
              <div class="order-2 lg:order-1 lg:col-span-4">
                <div class="hidden lg:flex items-center justify-between p-3 mb-3 bg-blue-50/80 border border-blue-200/80 rounded-2xl text-xs font-mono text-blue-900">
                  <span>📍 {{ filteredClubs().length }} clubes en Pereira</span>
                  <span class="text-[10px] text-blue-600">Haz clic para enfocar</span>
                </div>

                <!-- Desktop Vertical List -->
                <div class="hidden lg:block space-y-3 max-h-[580px] overflow-y-auto pr-1 scrollbar-thin">
                  @for (club of filteredClubs(); track club.id) {
                    <div
                      (click)="focusClubOnMap(club)"
                      class="p-4 bg-white rounded-2xl border transition-all duration-200 space-y-2 group cursor-pointer"
                      [ngClass]="selectedMapClub()?.id === club.id
                        ? 'border-[#0056FB] bg-blue-50/60 shadow-md ring-2 ring-[#0056FB]/20'
                        : 'border-slate-200 hover:border-blue-300 hover:shadow-xs'"
                    >
                      <div class="flex items-start justify-between gap-2">
                        <h4 class="font-serif italic text-base text-slate-950 group-hover:text-[#0056FB] transition-colors leading-tight">
                          {{ club.name }}
                        </h4>
                        <span class="text-[10px] font-mono text-slate-400 shrink-0">{{ club.city || 'Pereira' }}</span>
                      </div>

                      <p class="text-xs text-slate-500 line-clamp-1">
                        📍 {{ club.address || 'Pereira, Risaralda' }}
                      </p>

                      <div class="flex items-center justify-between pt-2 border-t border-slate-100">
                        <div class="flex gap-1.5 items-center">
                          @for (sport of club.sports || []; track sport) {
                            <span class="text-xs px-1.5 py-0.5 rounded-md bg-slate-100" [title]="sport">
                              {{ getSportEmoji(sport) }}
                            </span>
                          }
                        </div>

                        <div class="flex items-center gap-2">
                          <a
                            [href]="getDirectionsUrl(club)"
                            target="_blank"
                            rel="noopener noreferrer"
                            (click)="$event.stopPropagation()"
                            class="text-[11px] font-mono text-slate-500 hover:text-slate-900 underline"
                          >
                            Cómo llegar ↗
                          </a>
                          <a
                            [routerLink]="['/c', club.slug]"
                            (click)="$event.stopPropagation()"
                            class="px-3 py-1.5 bg-[#0056FB] hover:bg-[#0048d6] text-white rounded-xl text-[11px] font-mono uppercase tracking-wider font-semibold shadow-xs"
                          >
                            Reservar ➔
                          </a>
                        </div>
                      </div>
                    </div>
                  }
                </div>

                <!-- Mobile Horizontal Touch Carousel -->
                <div class="block lg:hidden">
                  <div class="flex items-center justify-between text-xs font-mono text-slate-500 px-1 mb-2">
                    <span>Desliza los {{ filteredClubs().length }} clubes en Pereira:</span>
                    <span class="text-[11px] text-[#0056FB] font-semibold">Toca para enfocar</span>
                  </div>

                  <div class="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none snap-x">
                    @for (club of filteredClubs(); track club.id) {
                      <div
                        (click)="focusClubOnMap(club)"
                        class="min-w-[270px] max-w-[300px] p-4 bg-white rounded-2xl border shrink-0 snap-start transition-all duration-200 flex flex-col justify-between gap-3 shadow-xs"
                        [ngClass]="selectedMapClub()?.id === club.id
                          ? 'border-[#0056FB] bg-blue-50/50 shadow-md ring-2 ring-[#0056FB]/20'
                          : 'border-slate-200'"
                      >
                        <div>
                          <div class="flex items-start justify-between gap-2 mb-1">
                            <h4 class="font-serif italic text-base text-slate-950 font-bold truncate">
                              {{ club.name }}
                            </h4>
                            <span class="text-[10px] font-mono text-slate-400 shrink-0">{{ club.city || 'Pereira' }}</span>
                          </div>
                          <p class="text-xs text-slate-500 truncate">
                            📍 {{ club.address || 'Pereira, Risaralda' }}
                          </p>
                        </div>

                        <div class="flex items-center justify-between pt-2 border-t border-slate-100">
                          <div class="flex gap-1 items-center">
                            @for (sport of club.sports || []; track sport) {
                              <span class="text-xs px-1.5 py-0.5 rounded-md bg-slate-100" [title]="sport">
                                {{ getSportEmoji(sport) }}
                              </span>
                            }
                          </div>

                          <div class="flex items-center gap-2">
                            <a
                              [href]="getDirectionsUrl(club)"
                              target="_blank"
                              rel="noopener noreferrer"
                              (click)="$event.stopPropagation()"
                              class="text-[10px] font-mono text-slate-500 hover:text-slate-900 underline"
                            >
                              Mapa ↗
                            </a>
                            <a
                              [routerLink]="['/c', club.slug]"
                              (click)="$event.stopPropagation()"
                              class="px-3 py-1.5 bg-[#0056FB] text-white rounded-xl text-[10px] font-mono uppercase tracking-wider font-semibold shadow-xs"
                            >
                              Reservar ➔
                            </a>
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </div>
            </div>
          }
        }
      </main>

      <!-- Clean Quiet Luxury Footer -->
      <footer class="relative z-20 border-t border-slate-200/80 bg-white/80 py-8 text-xs font-sans text-slate-500">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <img src="logo-mark.svg" alt="Canchariane" class="w-6 h-6 rounded-lg opacity-80" />
            <span class="font-mono text-slate-400">© 2026 Canchariane • Eje Cafetero, Colombia</span>
          </div>

          <div class="flex items-center gap-6 font-mono text-[11px]">
            <a routerLink="/lookup" class="hover:text-slate-900 transition-colors">Consultar Reserva</a>
            <a routerLink="/auth/login" class="hover:text-slate-900 transition-colors">Administración Clubes</a>
            <span class="text-slate-300">|</span>
            <span class="text-slate-400">Mapas libres cortesía de OpenStreetMap & CARTO</span>
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
  readonly viewMode = signal<ViewMode>('map');
  readonly selectedMapClub = signal<PublicClubSummary | null>(null);

  // Map state
  private map?: L.Map;
  private markersMap = new Map<string, L.Marker>();

  // Pereira center defaults
  private readonly PEREIRA_LAT = 4.8133;
  private readonly PEREIRA_LNG = -75.6961;
  private readonly PEREIRA_ZOOM = 13;

  readonly filteredClubs = computed(() => {
    const list = this.clubs();
    const query = this.searchQuery().toLowerCase().trim();
    const sport = this.selectedSport();

    return list.filter((club) => {
      // Search text match
      const matchSearch =
        !query ||
        club.name.toLowerCase().includes(query) ||
        (club.address && club.address.toLowerCase().includes(query)) ||
        (club.city && club.city.toLowerCase().includes(query));

      // Sport filter match
      const matchSport =
        sport === 'all' ||
        (club.sports && club.sports.some((s) => s.toLowerCase() === sport.toLowerCase()));

      return matchSearch && matchSport;
    });
  });

  ngOnInit(): void {
    this.loadClubs();
  }

  ngAfterViewInit(): void {
    if (this.viewMode() === 'map') {
      setTimeout(() => this.initMap(), 100);
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
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

  resetFilters(): void {
    this.searchQuery.set('');
    this.selectedSport.set('all');
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
      return `https://www.google.com/maps/dir/?api=1&destination=${club.latitude},${club.longitude}`;
    }
    const query = encodeURIComponent(`${club.name}, ${club.address || 'Pereira, Risaralda'}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
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
      zoomControl: true
    });

    // OpenStreetMap 100% Free Tile Layer
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

      const markerIcon = L.divIcon({
        className: 'custom-directory-pin',
        html: `
          <div style="
            width: 38px;
            height: 38px;
            border-radius: 50% 50% 50% 0;
            background: #0056FB;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 20px rgba(0, 86, 251, 0.4);
            border: 2.5px solid white;
            cursor: pointer;
            transition: transform 0.2s ease;
          ">
            <div style="transform: rotate(45deg); color: white; font-size: 16px;">
              ${this.getSportEmoji(club.sports?.[0] || 'club')}
            </div>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -38]
      });

      const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(this.map!);

      const popupHtml = `
        <div style="padding: 12px 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 200px;">
          <div style="font-size: 10px; font-family: monospace; text-transform: uppercase; color: #0056FB; font-weight: 600; margin-bottom: 2px;">
            ${club.city || 'Pereira, Risaralda'}
          </div>
          <strong style="color: #0F172A; font-size: 14px; font-family: Georgia, serif; font-style: italic; display: block; margin-bottom: 4px;">
            ${club.name}
          </strong>
          <p style="color: #64748B; font-size: 11px; margin: 0 0 10px 0; line-height: 1.3;">
            ${club.address || 'Pereira, Colombia'}
          </p>
          <div style="display: flex; gap: 8px; align-items: center; justify-content: space-between; border-top: 1px solid #E2E8F0; padding-top: 8px;">
            <a
              href="${this.getDirectionsUrl(club)}"
              target="_blank"
              rel="noopener noreferrer"
              style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-family: monospace; color: #475569; text-decoration: none; padding: 4px 8px; border: 1px solid #CBD5E1; border-radius: 8px;"
            >
              🧭 Cómo llegar
            </a>
            <a
              href="/c/${club.slug}"
              style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-family: monospace; color: white; background: #0056FB; text-decoration: none; padding: 5px 10px; border-radius: 8px; font-weight: 600;"
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
