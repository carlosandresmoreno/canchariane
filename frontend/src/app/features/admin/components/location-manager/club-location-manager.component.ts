import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  signal,
  inject,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { ClubAdminService, ClubBookingSettings } from '../../services/club-admin.service';

@Component({
  selector: 'app-club-location-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Section Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono uppercase tracking-widest text-slate-400">Sede & Georreferenciación</span>
            <span class="w-1.5 h-1.5 rounded-full bg-[#0056FB]"></span>
            <span class="text-xs text-[#0056FB] font-mono font-medium">Pereira, Risaralda</span>
          </div>
          <h2 class="text-xl sm:text-2xl font-serif italic text-slate-900 mt-1">Ubicación del Club en el Mapa</h2>
          <p class="text-xs text-slate-500 font-sans mt-0.5">
            Configura el punto exacto de tu sede. Los clientes podrán encontrarte en el mapa interactivo y generar la ruta de cómo llegar por GPS.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button
            type="button"
            (click)="detectCurrentLocation()"
            [disabled]="isDetecting()"
            class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:text-slate-950 hover:bg-slate-50 text-xs font-mono uppercase tracking-wider transition-all flex items-center gap-2 shadow-xs"
            title="Usar la ubicación actual del dispositivo"
          >
            @if (isDetecting()) {
              <span class="w-3.5 h-3.5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></span>
              <span>Detectando...</span>
            } @else {
              <span>📡</span>
              <span>Mi GPS Actual</span>
            }
          </button>

          <button
            type="button"
            (click)="saveLocation()"
            [disabled]="isSaving()"
            class="px-5 py-2.5 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] disabled:opacity-50 text-white font-mono text-xs font-semibold tracking-wider uppercase transition-all shadow-md active:scale-95 flex items-center gap-2"
          >
            @if (isSaving()) {
              <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Guardando...</span>
            } @else {
              <span>💾</span>
              <span>Guardar Ubicación</span>
            }
          </button>
        </div>
      </div>

      <!-- Feedback Toast -->
      @if (successMessage()) {
        <div class="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono flex items-center justify-between animate-in fade-in duration-300">
          <div class="flex items-center gap-2">
            <span>✓</span>
            <span>{{ successMessage() }}</span>
          </div>
          <button type="button" (click)="successMessage.set('')" class="text-emerald-600 hover:text-emerald-950">✕</button>
        </div>
      }

      @if (errorMessage()) {
        <div class="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono flex items-center justify-between animate-in fade-in duration-300">
          <div class="flex items-center gap-2">
            <span>⚠</span>
            <span>{{ errorMessage() }}</span>
          </div>
          <button type="button" (click)="errorMessage.set('')" class="text-rose-600 hover:text-rose-950">✕</button>
        </div>
      }

      <!-- Main Layout: Form & Interactive Map -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Configuration Form Panel (4 cols) -->
        <div class="lg:col-span-4 space-y-5 p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
          <div>
            <h3 class="text-sm font-semibold text-slate-900 tracking-wide">Datos de Dirección y Contacto</h3>
            <p class="text-[11px] text-slate-500 mt-0.5">Información que verán los deportistas en el directorio público.</p>
          </div>

          <div class="space-y-4 text-xs font-sans">
            <div>
              <label for="addressInput" class="block text-[11px] font-mono uppercase tracking-wider text-slate-600 mb-1.5">
                Dirección Física
              </label>
              <input
                id="addressInput"
                type="text"
                [(ngModel)]="address"
                placeholder="Ej: Av. 30 de Agosto # 87-25, Sector Villa Olímpica"
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#0056FB] focus:outline-none focus:ring-1 focus:ring-[#0056FB]/20 transition-all font-sans text-xs"
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="cityInput" class="block text-[11px] font-mono uppercase tracking-wider text-slate-600 mb-1.5">
                  Ciudad
                </label>
                <input
                  id="cityInput"
                  type="text"
                  [(ngModel)]="city"
                  placeholder="Pereira"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#0056FB] focus:outline-none transition-all text-xs"
                />
              </div>

              <div>
                <label for="phoneInput" class="block text-[11px] font-mono uppercase tracking-wider text-slate-600 mb-1.5">
                  Teléfono / WhatsApp
                </label>
                <input
                  id="phoneInput"
                  type="text"
                  [(ngModel)]="phone"
                  placeholder="+57 310 987 6543"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#0056FB] focus:outline-none transition-all font-mono text-xs"
                />
              </div>
            </div>

            <div class="pt-3 border-t border-slate-100">
              <span class="block text-[11px] font-mono uppercase tracking-wider text-slate-600 mb-1.5">
                Coordenadas Geográficas
              </span>
              <p class="text-[11px] text-slate-400 mb-3">
                Arrastra el marcador en el mapa o haz clic en tu posición exacta para fijar las coordenadas.
              </p>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="latInput" class="block text-[10px] font-mono text-slate-500 mb-1">Latitud</label>
                  <input
                    id="latInput"
                    type="number"
                    step="0.000001"
                    [(ngModel)]="latitude"
                    (change)="onCoordinateChange()"
                    class="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs focus:bg-white focus:border-[#0056FB] focus:outline-none"
                  />
                </div>
                <div>
                  <label for="lngInput" class="block text-[10px] font-mono text-slate-500 mb-1">Longitud</label>
                  <input
                    id="lngInput"
                    type="number"
                    step="0.000001"
                    [(ngModel)]="longitude"
                    (change)="onCoordinateChange()"
                    class="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs focus:bg-white focus:border-[#0056FB] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <!-- Google Maps Navigation Live Test -->
            <div class="pt-3 border-t border-slate-100">
              <a
                [href]="getDirectionsUrl()"
                target="_blank"
                rel="noopener noreferrer"
                class="w-full py-2.5 px-3 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200 text-[#0056FB] font-mono text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
              >
                <span>🗺️</span>
                <span>Probar "Cómo llegar" (Google Maps) ↗</span>
              </a>
              <span class="block text-[10px] text-slate-400 font-mono text-center mt-1.5">
                Verifica cómo verán tus clientes la ruta en su GPS.
              </span>
            </div>
          </div>
        </div>

        <!-- Interactive Map (8 cols) -->
        <div class="lg:col-span-8 p-4 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col">
          <div class="flex items-center justify-between pb-3 px-2 border-b border-slate-100 mb-3">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-slate-900">Mapa de Ubicación</span>
              <span class="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                OpenStreetMap / Leaflet (Gratuito)
              </span>
            </div>
            <div class="text-[11px] font-mono text-slate-500">
              📍 Haz clic en el mapa para posicionar el pin
            </div>
          </div>

          <!-- Map Canvas Container -->
          <div
            #mapContainer
            class="w-full h-[460px] rounded-2xl overflow-hidden border border-slate-200 relative z-10"
          ></div>
        </div>
      </div>
    </div>
  `
})
export class ClubLocationManagerComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) clubId!: string;
  @Input() initialAddress?: string | null;
  @Input() initialPhone?: string | null;

  private readonly adminService = inject(ClubAdminService);

  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;

  // Form Fields
  address = '';
  city = 'Pereira';
  phone = '';
  latitude = 4.8085;
  longitude = -75.7142;

  // State Signals
  readonly isSaving = signal<boolean>(false);
  readonly isDetecting = signal<boolean>(false);
  readonly successMessage = signal<string>('');
  readonly errorMessage = signal<string>('');

  private map?: L.Map;
  private marker?: L.Marker;

  ngOnInit(): void {
    if (this.initialAddress) this.address = this.initialAddress;
    if (this.initialPhone) this.phone = this.initialPhone;
    this.loadCurrentSettings();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initMap();
    }, 150);
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private loadCurrentSettings(): void {
    if (!this.clubId) return;
    this.adminService.getSettings(this.clubId).subscribe({
      next: (settings: ClubBookingSettings) => {
        if (settings.latitude != null) this.latitude = Number(settings.latitude);
        if (settings.longitude != null) this.longitude = Number(settings.longitude);
        if (settings.city) this.city = settings.city;
        if (settings.address) this.address = settings.address;
        if (settings.phone) this.phone = settings.phone;

        if (this.map && this.marker) {
          const latLng = L.latLng(this.latitude, this.longitude);
          this.marker.setLatLng(latLng);
          this.map.panTo(latLng);
        }
      },
      error: () => {
        // Fallback to Pereira defaults
      }
    });
  }

  private initMap(): void {
    if (!this.mapContainer?.nativeElement) return;

    const initialLat = this.latitude || 4.8085;
    const initialLng = this.longitude || -75.7142;

    this.map = L.map(this.mapContainer.nativeElement, {
      center: [initialLat, initialLng],
      zoom: 14,
      zoomControl: true
    });

    // Clean OpenStreetMap Tile Layer (CartoDB Positron / OSM style)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19
    }).addTo(this.map);

    // Modern Custom Marker Pin
    const markerIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div style="
          width: 36px;
          height: 36px;
          border-radius: 50% 50% 50% 0;
          background: #0056FB;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 25px rgba(0, 86, 251, 0.45);
          border: 2.5px solid white;
          cursor: grab;
        ">
          <div style="transform: rotate(45deg); color: white; font-size: 15px;">🎾</div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36]
    });

    this.marker = L.marker([initialLat, initialLng], {
      draggable: true,
      icon: markerIcon
    }).addTo(this.map);

    this.marker.bindPopup(`
      <div style="padding: 10px 14px; font-family: sans-serif;">
        <strong style="color: #0F172A; font-size: 13px;">Ubicación de tu Sede</strong>
        <p style="color: #64748B; font-size: 11px; margin: 4px 0 0 0;">Arrastra este pin o haz clic en el mapa para ajustar.</p>
      </div>
    `);

    // Event: Dragging marker
    this.marker.on('dragend', () => {
      if (this.marker) {
        const latLng = this.marker.getLatLng();
        this.latitude = Number(latLng.lat.toFixed(6));
        this.longitude = Number(latLng.lng.toFixed(6));
      }
    });

    // Event: Clicking on map places marker
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.latitude = Number(e.latlng.lat.toFixed(6));
      this.longitude = Number(e.latlng.lng.toFixed(6));
      if (this.marker) {
        this.marker.setLatLng(e.latlng);
      }
    });

    // Ensure proper size rendering
    setTimeout(() => {
      this.map?.invalidateSize();
    }, 200);
  }

  onCoordinateChange(): void {
    if (this.map && this.marker && this.latitude && this.longitude) {
      const latLng = L.latLng(this.latitude, this.longitude);
      this.marker.setLatLng(latLng);
      this.map.panTo(latLng);
    }
  }

  detectCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.errorMessage.set('Tu navegador no soporta geolocalización GPS.');
      return;
    }

    this.isDetecting.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.isDetecting.set(false);
        this.latitude = Number(pos.coords.latitude.toFixed(6));
        this.longitude = Number(pos.coords.longitude.toFixed(6));
        this.onCoordinateChange();
        this.successMessage.set('Ubicación GPS detectada correctamente.');
      },
      (err) => {
        this.isDetecting.set(false);
        this.errorMessage.set(`No se pudo obtener la ubicación GPS: ${err.message}`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  getDirectionsUrl(): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${this.latitude},${this.longitude}`;
  }

  saveLocation(): void {
    if (!this.clubId) return;
    this.isSaving.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    this.adminService
      .updateSettings(this.clubId, {
        latitude: this.latitude,
        longitude: this.longitude,
        city: this.city || 'Pereira',
        address: this.address,
        phone: this.phone
      })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.successMessage.set('¡Ubicación y datos de sede guardados con éxito!');
        },
        error: (err) => {
          this.isSaving.set(false);
          this.errorMessage.set(err.error?.detail || 'Error al guardar la ubicación.');
        }
      });
  }
}
