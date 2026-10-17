import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminCourt, ClubLayout, CourtLayoutItem, DecorationItem } from '../../services/club-admin.service';

interface DecoPreset {
  label: string;
  icon: string;
  w: number;
  h: number;
}

@Component({
  selector: 'app-club-layout-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Section Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="font-serif italic text-xl text-slate-900">Diseñador del Plano & Mapa</h2>
            <span class="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0056FB] border border-blue-200 text-[10px] font-mono tracking-wider uppercase font-medium">
              Blueprint Interactivo
            </span>
          </div>
          <p class="text-xs text-slate-500 font-sans mt-0.5">
            Configura y mueve tanto las pistas deportivas como las áreas de infraestructura (recepción, cafetería, parqueadero, etc.)
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            (click)="openNewDecoModal()"
            class="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-mono uppercase tracking-wider transition-colors shadow-xs flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Nueva Área</span>
          </button>
          <button
            type="button"
            (click)="autoDistributeCourts()"
            class="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-mono uppercase tracking-wider transition-colors shadow-xs"
          >
            Auto-Alinear Pistas
          </button>
          <button
            type="button"
            (click)="onSave()"
            [disabled]="isSaving"
            class="px-4 py-2.5 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] disabled:opacity-40 text-white font-medium text-xs tracking-wider uppercase font-mono transition-all duration-300 shadow-md flex items-center justify-center gap-2 active:scale-95"
          >
            <span>{{ isSaving ? 'Guardando...' : 'Guardar Plano' }}</span>
          </button>
        </div>
      </div>

      <!-- Main Layout Workspace -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- SVG Canvas (Interactive Blueprint View) -->
        <div class="lg:col-span-2 p-5 rounded-3xl bg-slate-50 border border-slate-200/90 shadow-xs flex flex-col items-center justify-center relative min-h-[520px] overflow-hidden">
          <div class="absolute top-4 left-4 z-10 flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-200 text-[11px] font-mono text-slate-600 shadow-xs">
            <span class="w-2 h-2 rounded-full bg-[#0056FB] animate-pulse"></span>
            <span>Vista de Pájaro (1000 x 800) • Haz clic en una pista o área para seleccionarla</span>
          </div>

          <!-- Active Selection Pill -->
          @if (selectedCourt(); as c) {
            <div class="absolute top-4 right-4 z-10 flex items-center gap-2 bg-blue-50/95 backdrop-blur-md px-3 py-1 rounded-full border border-blue-200 text-[11px] font-mono text-[#0056FB] shadow-xs">
              <span>🎾 Editando: <strong>{{ c.name }}</strong></span>
            </div>
          }
          @if (!selectedCourt() && selectedDeco()) {
            <div class="absolute top-4 right-4 z-10 flex items-center gap-2 bg-emerald-50/95 backdrop-blur-md px-3 py-1 rounded-full border border-emerald-200 text-[11px] font-mono text-emerald-700 shadow-xs">
              <span>{{ selectedDeco()?.icon || '🏢' }} Editando: <strong>{{ selectedDeco()?.label }}</strong></span>
            </div>
          }

          <!-- SVG Visual Representation -->
          <svg
            viewBox="0 0 1000 800"
            class="w-full h-auto max-h-[580px] bg-white rounded-2xl shadow-inner border border-slate-200 select-none"
          >
            <!-- Blueprint Grid Lines -->
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#F1F5F9" stroke-width="1"/>
              </pattern>
            </defs>
            <rect width="1000" height="800" fill="url(#grid)" />

            <!-- Decorations / Infrastructure Areas (Clickable & Movable) -->
            @for (deco of layoutData.decorations; track $index) {
              @let isDecoSelected = activeTab() === 'decorations' && selectedDecoIndex() === $index;
              <g
                (click)="selectDeco($index)"
                class="cursor-pointer transition-all duration-200 group"
                [attr.transform]="'rotate(' + (deco.shape.rotation || 0) + ' ' + (deco.shape.x + deco.shape.w/2) + ' ' + (deco.shape.y + deco.shape.h/2) + ')'"
              >
                <!-- Area Background Box -->
                <rect
                  [attr.x]="deco.shape.x"
                  [attr.y]="deco.shape.y"
                  [attr.width]="deco.shape.w"
                  [attr.height]="deco.shape.h"
                  rx="14"
                  [attr.fill]="isDecoSelected ? '#ECFDF5' : '#F8FAFC'"
                  [attr.stroke]="isDecoSelected ? '#10B981' : '#94A3B8'"
                  [attr.stroke-width]="isDecoSelected ? '2.5' : '1.5'"
                  [attr.stroke-dasharray]="isDecoSelected ? 'none' : '4 2'"
                  class="transition-all"
                />

                <!-- Selection Corner Handles for Infrastructure Areas -->
                @if (isDecoSelected) {
                  <rect [attr.x]="deco.shape.x - 4" [attr.y]="deco.shape.y - 4" width="8" height="8" fill="#10B981" rx="2" />
                  <rect [attr.x]="deco.shape.x + deco.shape.w - 4" [attr.y]="deco.shape.y - 4" width="8" height="8" fill="#10B981" rx="2" />
                  <rect [attr.x]="deco.shape.x - 4" [attr.y]="deco.shape.y + deco.shape.h - 4" width="8" height="8" fill="#10B981" rx="2" />
                  <rect [attr.x]="deco.shape.x + deco.shape.w - 4" [attr.y]="deco.shape.y + deco.shape.h - 4" width="8" height="8" fill="#10B981" rx="2" />
                }

                <!-- Icon and Label -->
                <text
                  [attr.x]="deco.shape.x + deco.shape.w / 2"
                  [attr.y]="deco.shape.y + deco.shape.h / 2 - (deco.icon ? 6 : 0)"
                  text-anchor="middle"
                  dominant-baseline="central"
                  [attr.fill]="isDecoSelected ? '#065F46' : '#475569'"
                  font-family="sans-serif"
                  font-size="13"
                  font-weight="600"
                >
                  {{ (deco.icon ? deco.icon + ' ' : '') + deco.label }}
                </text>

                <!-- Subtle Coordinates on Area -->
                <text
                  [attr.x]="deco.shape.x + deco.shape.w / 2"
                  [attr.y]="deco.shape.y + deco.shape.h / 2 + 14"
                  text-anchor="middle"
                  dominant-baseline="central"
                  [attr.fill]="isDecoSelected ? '#059669' : '#94A3B8'"
                  font-family="monospace"
                  font-size="9"
                  letter-spacing="0.05em"
                >
                  {{ deco.shape.w }}x{{ deco.shape.h }} ({{ deco.shape.x }}, {{ deco.shape.y }})
                </text>
              </g>
            }

            <!-- Courts placed on the map (Clickable & Movable) -->
            @for (item of layoutData.courts; track item.court_id) {
              @let court = getCourtById(item.court_id);
              @let isSelected = activeTab() === 'courts' && selectedCourtId() === item.court_id;
              <g
                (click)="selectCourt(item.court_id)"
                class="cursor-pointer transition-all duration-200"
                [attr.transform]="'rotate(' + (item.shape.rotation || 0) + ' ' + (item.shape.x + item.shape.w/2) + ' ' + (item.shape.y + item.shape.h/2) + ')'"
              >
                <!-- Court Body -->
                <rect
                  [attr.x]="item.shape.x"
                  [attr.y]="item.shape.y"
                  [attr.width]="item.shape.w"
                  [attr.height]="item.shape.h"
                  rx="16"
                  [attr.fill]="isSelected ? '#EFF6FF' : '#FFFFFF'"
                  [attr.stroke]="isSelected ? '#0056FB' : '#94A3B8'"
                  [attr.stroke-width]="isSelected ? '3' : '1.5'"
                  class="transition-all"
                />

                <!-- Net Divider Line -->
                <line
                  [attr.x1]="item.shape.x"
                  [attr.y1]="item.shape.y + item.shape.h / 2"
                  [attr.x2]="item.shape.x + item.shape.w"
                  [attr.y2]="item.shape.y + item.shape.h / 2"
                  stroke="#CBD5E1"
                  stroke-width="1.5"
                  stroke-dasharray="4 2"
                />

                <!-- Court Service Box -->
                <rect
                  [attr.x]="item.shape.x + item.shape.w * 0.15"
                  [attr.y]="item.shape.y + item.shape.h * 0.2"
                  [attr.width]="item.shape.w * 0.7"
                  [attr.height]="item.shape.h * 0.6"
                  rx="6"
                  fill="none"
                  stroke="#E2E8F0"
                  stroke-width="1"
                />

                <!-- Selection Handles for Courts -->
                @if (isSelected) {
                  <rect [attr.x]="item.shape.x - 4" [attr.y]="item.shape.y - 4" width="8" height="8" fill="#0056FB" rx="2" />
                  <rect [attr.x]="item.shape.x + item.shape.w - 4" [attr.y]="item.shape.y - 4" width="8" height="8" fill="#0056FB" rx="2" />
                  <rect [attr.x]="item.shape.x - 4" [attr.y]="item.shape.y + item.shape.h - 4" width="8" height="8" fill="#0056FB" rx="2" />
                  <rect [attr.x]="item.shape.x + item.shape.w - 4" [attr.y]="item.shape.y + item.shape.h - 4" width="8" height="8" fill="#0056FB" rx="2" />
                }

                <!-- Court Label -->
                <text
                  [attr.x]="item.shape.x + item.shape.w / 2"
                  [attr.y]="item.shape.y + item.shape.h / 2 - 10"
                  text-anchor="middle"
                  [attr.fill]="isSelected ? '#0056FB' : '#0F172A'"
                  font-family="sans-serif"
                  font-size="14"
                  font-weight="700"
                >
                  {{ court?.name || 'Pista' }}
                </text>

                <text
                  [attr.x]="item.shape.x + item.shape.w / 2"
                  [attr.y]="item.shape.y + item.shape.h / 2 + 18"
                  text-anchor="middle"
                  fill="#94A3B8"
                  font-family="monospace"
                  font-size="10"
                  text-transform="uppercase"
                >
                  {{ court?.sport || 'Pádel' }}
                </text>
              </g>
            }
          </svg>
        </div>

        <!-- Sidebar Inspector (Dual Tabs: Canchas & Infraestructura) -->
        <div class="space-y-5">
          <!-- Inspector Selector Mode Tabs -->
          <div class="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              type="button"
              (click)="activeTab.set('courts')"
              [class.bg-white]="activeTab() === 'courts'"
              [class.text-[#0056FB]]="activeTab() === 'courts'"
              [class.shadow-xs]="activeTab() === 'courts'"
              [class.font-semibold]="activeTab() === 'courts'"
              [class.text-slate-600]="activeTab() !== 'courts'"
              class="py-2.5 px-3 rounded-xl text-xs font-mono tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-1.5"
            >
              <span>🎾 Canchas</span>
              <span class="px-1.5 py-0.2 rounded-full bg-slate-200/60 text-[10px]">
                {{ layoutData.courts.length }}
              </span>
            </button>

            <button
              type="button"
              (click)="activeTab.set('decorations')"
              [class.bg-white]="activeTab() === 'decorations'"
              [class.text-emerald-700]="activeTab() === 'decorations'"
              [class.shadow-xs]="activeTab() === 'decorations'"
              [class.font-semibold]="activeTab() === 'decorations'"
              [class.text-slate-600]="activeTab() !== 'decorations'"
              class="py-2.5 px-3 rounded-xl text-xs font-mono tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-1.5"
            >
              <span>🏢 Infraestructura</span>
              <span class="px-1.5 py-0.2 rounded-full bg-slate-200/60 text-[10px]">
                {{ layoutData.decorations.length }}
              </span>
            </button>
          </div>

          <!-- TAB 1: COURTS INSPECTOR -->
          @if (activeTab() === 'courts') {
            <div class="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-5">
              <div class="border-b border-slate-100 pb-4">
                <span class="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">Inspector de Cancha</span>
                <h3 class="font-serif italic text-lg text-slate-900">
                  {{ selectedCourt() ? selectedCourt()?.name : 'Selecciona una Cancha' }}
                </h3>
                <p class="text-xs text-slate-500 font-sans mt-0.5">
                  {{ selectedCourt() ? 'Ajusta posición (X, Y), dimensiones (W, H) y rotación' : 'Haz clic en una cancha del mapa o elígela abajo' }}
                </p>
              </div>

              <!-- Court Selector Dropdown -->
              <div>
                <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
                  Cancha Seleccionada
                </label>
                <select
                  [ngModel]="selectedCourtId()"
                  (ngModelChange)="selectCourt($event)"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                >
                  @for (c of courts; track c.id) {
                    <option [value]="c.id">{{ c.name }} ({{ c.sport }})</option>
                  }
                </select>
              </div>

              @if (activeItem(); as item) {
                <!-- Numeric Sliders & Inputs -->
                <div class="space-y-4 pt-2">
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <div class="flex items-center justify-between mb-1">
                        <label class="text-[11px] font-mono uppercase tracking-wider text-slate-500">Posición X</label>
                        <span class="text-[11px] font-mono text-slate-700 font-semibold">{{ item.shape.x }}px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="850"
                        [(ngModel)]="item.shape.x"
                        class="w-full accent-[#0056FB]"
                      />
                    </div>

                    <div>
                      <div class="flex items-center justify-between mb-1">
                        <label class="text-[11px] font-mono uppercase tracking-wider text-slate-500">Posición Y</label>
                        <span class="text-[11px] font-mono text-slate-700 font-semibold">{{ item.shape.y }}px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="650"
                        [(ngModel)]="item.shape.y"
                        class="w-full accent-[#0056FB]"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <div class="flex items-center justify-between mb-1">
                        <label class="text-[11px] font-mono uppercase tracking-wider text-slate-500">Ancho (W)</label>
                        <span class="text-[11px] font-mono text-slate-700 font-semibold">{{ item.shape.w }}px</span>
                      </div>
                      <input
                        type="range"
                        min="80"
                        max="350"
                        [(ngModel)]="item.shape.w"
                        class="w-full accent-[#0056FB]"
                      />
                    </div>

                    <div>
                      <div class="flex items-center justify-between mb-1">
                        <label class="text-[11px] font-mono uppercase tracking-wider text-slate-500">Alto (H)</label>
                        <span class="text-[11px] font-mono text-slate-700 font-semibold">{{ item.shape.h }}px</span>
                      </div>
                      <input
                        type="range"
                        min="80"
                        max="400"
                        [(ngModel)]="item.shape.h"
                        class="w-full accent-[#0056FB]"
                      />
                    </div>
                  </div>

                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-[11px] font-mono uppercase tracking-wider text-slate-500">Rotación</label>
                      <span class="text-[11px] font-mono text-slate-700 font-semibold">{{ item.shape.rotation || 0 }}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="180"
                      step="45"
                      [(ngModel)]="item.shape.rotation"
                      class="w-full accent-[#0056FB]"
                    />
                  </div>

                  <!-- Quick Nudge Buttons for Courts -->
                  <div class="pt-2 border-t border-slate-100">
                    <span class="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-2">Ajuste Fino (+/- 10px)</span>
                    <div class="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        (click)="nudgeCourt(item, -10, 0)"
                        class="w-9 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-mono text-xs flex items-center justify-center transition-colors"
                        title="Mover Izquierda"
                      >
                        ◀
                      </button>
                      <div class="flex flex-col gap-1">
                        <button
                          type="button"
                          (click)="nudgeCourt(item, 0, -10)"
                          class="w-9 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-mono text-xs flex items-center justify-center transition-colors"
                          title="Mover Arriba"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          (click)="nudgeCourt(item, 0, 10)"
                          class="w-9 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-mono text-xs flex items-center justify-center transition-colors"
                          title="Mover Abajo"
                        >
                          ▼
                        </button>
                      </div>
                      <button
                        type="button"
                        (click)="nudgeCourt(item, 10, 0)"
                        class="w-9 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-mono text-xs flex items-center justify-center transition-colors"
                        title="Mover Derecha"
                      >
                        ▶
                      </button>
                    </div>
                  </div>
                </div>
              } @else {
                <div class="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-400 font-mono">
                  Ninguna cancha seleccionada
                </div>
              }
            </div>
          }

          <!-- TAB 2: INFRASTRUCTURE AREAS INSPECTOR & CRUD -->
          @if (activeTab() === 'decorations') {
            <div class="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-5">
              <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span class="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">Inspector de Infraestructura</span>
                  <h3 class="font-serif italic text-lg text-slate-900">
                    {{ selectedDeco() ? selectedDeco()?.label : 'Áreas de Servicio' }}
                  </h3>
                  <p class="text-xs text-slate-500 font-sans mt-0.5">
                    {{ selectedDeco() ? 'Modifica dimensiones, coordenadas o elimina esta área' : 'Selecciona un área del mapa o añade una nueva' }}
                  </p>
                </div>
                <button
                  type="button"
                  (click)="openNewDecoModal()"
                  class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono uppercase tracking-wider transition-colors shadow-xs flex items-center gap-1"
                >
                  <span>+</span>
                  <span>Añadir</span>
                </button>
              </div>

              @if (selectedDeco(); as deco) {
                <!-- Active Area Editor Form -->
                <div class="space-y-4 pt-1">
                  <!-- Name & Icon -->
                  <div>
                    <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                      Nombre del Área
                    </label>
                    <input
                      type="text"
                      [(ngModel)]="deco.label"
                      placeholder="Ej. Cafetería y Terraza"
                      class="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-sans focus:bg-white focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  <!-- Icon Quick Selection -->
                  <div>
                    <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
                      Ícono / Categoría
                    </label>
                    <div class="flex flex-wrap gap-1.5">
                      @for (ic of availableIcons; track ic) {
                        <button
                          type="button"
                          (click)="deco.icon = ic"
                          [class.bg-emerald-50]="deco.icon === ic"
                          [class.border-emerald-400]="deco.icon === ic"
                          [class.ring-2]="deco.icon === ic"
                          [class.ring-emerald-400]="deco.icon === ic"
                          class="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-sm transition-all"
                        >
                          {{ ic }}
                        </button>
                      }
                    </div>
                  </div>

                  <!-- Sliders for X and Y Coordinates -->
                  <div class="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <div class="flex items-center justify-between mb-1">
                        <label class="text-[11px] font-mono uppercase tracking-wider text-slate-500">Posición X</label>
                        <span class="text-[11px] font-mono text-emerald-700 font-semibold">{{ deco.shape.x }}px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="850"
                        [(ngModel)]="deco.shape.x"
                        class="w-full accent-emerald-600"
                      />
                    </div>

                    <div>
                      <div class="flex items-center justify-between mb-1">
                        <label class="text-[11px] font-mono uppercase tracking-wider text-slate-500">Posición Y</label>
                        <span class="text-[11px] font-mono text-emerald-700 font-semibold">{{ deco.shape.y }}px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="750"
                        [(ngModel)]="deco.shape.y"
                        class="w-full accent-emerald-600"
                      />
                    </div>
                  </div>

                  <!-- Sliders for Width and Height -->
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <div class="flex items-center justify-between mb-1">
                        <label class="text-[11px] font-mono uppercase tracking-wider text-slate-500">Ancho (W)</label>
                        <span class="text-[11px] font-mono text-emerald-700 font-semibold">{{ deco.shape.w }}px</span>
                      </div>
                      <input
                        type="range"
                        min="40"
                        max="500"
                        [(ngModel)]="deco.shape.w"
                        class="w-full accent-emerald-600"
                      />
                    </div>

                    <div>
                      <div class="flex items-center justify-between mb-1">
                        <label class="text-[11px] font-mono uppercase tracking-wider text-slate-500">Alto (H)</label>
                        <span class="text-[11px] font-mono text-emerald-700 font-semibold">{{ deco.shape.h }}px</span>
                      </div>
                      <input
                        type="range"
                        min="30"
                        max="350"
                        [(ngModel)]="deco.shape.h"
                        class="w-full accent-emerald-600"
                      />
                    </div>
                  </div>

                  <!-- Rotation -->
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-[11px] font-mono uppercase tracking-wider text-slate-500">Rotación</label>
                      <span class="text-[11px] font-mono text-emerald-700 font-semibold">{{ deco.shape.rotation || 0 }}°</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="180"
                        step="15"
                        [(ngModel)]="deco.shape.rotation"
                        class="w-full accent-emerald-600"
                      />
                      <button
                        type="button"
                        (click)="deco.shape.rotation = ((deco.shape.rotation || 0) + 45) % 180"
                        class="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-mono text-slate-700 transition-colors"
                      >
                        +45°
                      </button>
                    </div>
                  </div>

                  <!-- Fine Nudge Controls for Decoration -->
                  <div class="pt-2 border-t border-slate-100">
                    <span class="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-2">Ajuste Fino (+/- 10px)</span>
                    <div class="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        (click)="nudgeDeco(deco, -10, 0)"
                        class="w-9 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-mono text-xs flex items-center justify-center transition-colors"
                        title="Mover Izquierda"
                      >
                        ◀
                      </button>
                      <div class="flex flex-col gap-1">
                        <button
                          type="button"
                          (click)="nudgeDeco(deco, 0, -10)"
                          class="w-9 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-mono text-xs flex items-center justify-center transition-colors"
                          title="Mover Arriba"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          (click)="nudgeDeco(deco, 0, 10)"
                          class="w-9 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-mono text-xs flex items-center justify-center transition-colors"
                          title="Mover Abajo"
                        >
                          ▼
                        </button>
                      </div>
                      <button
                        type="button"
                        (click)="nudgeDeco(deco, 10, 0)"
                        class="w-9 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-mono text-xs flex items-center justify-center transition-colors"
                        title="Mover Derecha"
                      >
                        ▶
                      </button>
                    </div>
                  </div>

                  <!-- Actions: Duplicate & Delete -->
                  <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      (click)="duplicateDeco(selectedDecoIndex()!)"
                      class="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-mono uppercase tracking-wider transition-colors shadow-xs"
                    >
                      Duplicar
                    </button>
                    <button
                      type="button"
                      (click)="deleteDeco(selectedDecoIndex()!)"
                      class="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-mono uppercase tracking-wider transition-colors shadow-xs"
                    >
                      Eliminar Área
                    </button>
                  </div>
                </div>
              } @else {
                <!-- Empty State Prompt -->
                <div class="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-3">
                  <p class="text-xs text-slate-500 font-mono">
                    No has seleccionado ninguna área de infraestructura.
                  </p>
                  <p class="text-[11px] text-slate-400 font-sans">
                    Haz clic en una de ellas en el mapa interactivo o añade una nueva usando el botón inferior:
                  </p>
                  <button
                    type="button"
                    (click)="openNewDecoModal()"
                    class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs uppercase tracking-wider transition-colors shadow-xs"
                  >
                    + Crear Área de Infraestructura
                  </button>
                </div>
              }
            </div>

            <!-- List of All Infrastructure Areas -->
            <div class="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-3">
              <div class="flex items-center justify-between">
                <h4 class="font-mono text-xs uppercase tracking-wider font-semibold text-slate-700">
                  Todas las Áreas ({{ layoutData.decorations.length }})
                </h4>
                <button
                  type="button"
                  (click)="openNewDecoModal()"
                  class="text-[11px] font-mono text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  + Nueva
                </button>
              </div>

              <div class="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                @for (deco of layoutData.decorations; track $index) {
                  @let isSelected = selectedDecoIndex() === $index;
                  <div
                    (click)="selectDeco($index)"
                    [class.border-emerald-400]="isSelected"
                    [class.bg-emerald-50]="isSelected"
                    [class.border-slate-200]="!isSelected"
                    [class.bg-slate-50]="!isSelected"
                    class="flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer hover:border-emerald-300"
                  >
                    <div class="flex items-center gap-2 overflow-hidden">
                      <span class="text-base">{{ deco.icon || '🏢' }}</span>
                      <div class="truncate">
                        <span class="text-xs font-medium text-slate-800 block truncate">{{ deco.label }}</span>
                        <span class="text-[10px] font-mono text-slate-400">
                          X: {{ deco.shape.x }}, Y: {{ deco.shape.y }} • {{ deco.shape.w }}x{{ deco.shape.h }}
                        </span>
                      </div>
                    </div>
                    <div class="flex items-center gap-1">
                      <button
                        type="button"
                        (click)="deleteDeco($index); $event.stopPropagation()"
                        class="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors text-xs"
                        title="Eliminar Área"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>

      <!-- MODAL: CREAR NUEVA ÁREA DE INFRAESTRUCTURA -->
      @if (showAddModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div class="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-7 space-y-6">
            <div class="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span class="text-[10px] font-mono uppercase tracking-widest text-emerald-600 font-semibold block">Nueva Zona de Servicio</span>
                <h3 class="font-serif italic text-xl text-slate-900">Añadir Área al Plano</h3>
              </div>
              <button
                type="button"
                (click)="showAddModal.set(false)"
                class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <!-- Presets Grid -->
            <div>
              <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
                Plantillas Rápidas
              </label>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                @for (preset of presets; track preset.label) {
                  <button
                    type="button"
                    (click)="applyPreset(preset)"
                    class="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 transition-all text-left group"
                  >
                    <span class="text-xl block mb-1">{{ preset.icon }}</span>
                    <span class="text-xs font-medium text-slate-800 block truncate group-hover:text-emerald-800">{{ preset.label }}</span>
                    <span class="text-[10px] font-mono text-slate-400">{{ preset.w }}x{{ preset.h }}px</span>
                  </button>
                }
              </div>
            </div>

            <!-- Custom Form Inputs -->
            <div class="space-y-4 pt-1">
              <div>
                <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                  Nombre del Área *
                </label>
                <input
                  type="text"
                  [(ngModel)]="newAreaLabel"
                  placeholder="Ej. Cafetería y Terraza"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-sans focus:bg-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
                  Ícono Representativo
                </label>
                <div class="flex flex-wrap gap-1.5">
                  @for (ic of availableIcons; track ic) {
                    <button
                      type="button"
                      (click)="newAreaIcon = ic"
                      [class.bg-emerald-50]="newAreaIcon === ic"
                      [class.border-emerald-400]="newAreaIcon === ic"
                      [class.ring-2]="newAreaIcon === ic"
                      [class.ring-emerald-400]="newAreaIcon === ic"
                      class="w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-base transition-all"
                    >
                      {{ ic }}
                    </button>
                  }
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                    Ancho inicial (px)
                  </label>
                  <input
                    type="number"
                    min="40"
                    max="600"
                    [(ngModel)]="newAreaWidth"
                    class="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                    Alto inicial (px)
                  </label>
                  <input
                    type="number"
                    min="30"
                    max="400"
                    [(ngModel)]="newAreaHeight"
                    class="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <!-- Modal Action Buttons -->
            <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                (click)="showAddModal.set(false)"
                class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-mono uppercase tracking-wider hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="confirmAddDecoration()"
                [disabled]="!newAreaLabel.trim()"
                class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-mono text-xs uppercase tracking-wider transition-colors shadow-md"
              >
                Añadir al Plano
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class ClubLayoutEditorComponent implements OnChanges {
  @Input({ required: true }) courts: AdminCourt[] = [];
  @Input() initialLayout: ClubLayout | null = null;
  @Input() isSaving = false;
  @Output() saveLayout = new EventEmitter<ClubLayout>();

  readonly activeTab = signal<'courts' | 'decorations'>('courts');
  readonly selectedCourtId = signal<string | null>(null);
  readonly selectedDecoIndex = signal<number | null>(null);
  readonly showAddModal = signal<boolean>(false);

  // Form fields for new decoration
  newAreaLabel = 'Recepción Central';
  newAreaIcon = '🏢';
  newAreaWidth = 240;
  newAreaHeight = 70;

  readonly availableIcons = ['🏢', '☕', '🚿', '🚗', '👥', '🚻', '🛍️', '🏋️', '🌿', '🛝', '🏥', '🎾', '🍻', '☀️'];

  readonly presets: DecoPreset[] = [
    { label: 'Recepción Central', icon: '🏢', w: 240, h: 70 },
    { label: 'Cafetería & Terraza', icon: '☕', w: 250, h: 80 },
    { label: 'Vestuarios & Duchas', icon: '🚿', w: 220, h: 70 },
    { label: 'Parqueadero General', icon: '🚗', w: 260, h: 70 },
    { label: 'Baños Públicos', icon: '🚻', w: 140, h: 60 },
    { label: 'Gradas de Espectadores', icon: '👥', w: 280, h: 50 },
    { label: 'Tienda Pro-Shop', icon: '🛍️', w: 180, h: 70 },
    { label: 'Zona de Calentamiento', icon: '🏋️', w: 220, h: 80 },
    { label: 'Zona Verde / Chill Out', icon: '🌿', w: 200, h: 80 }
  ];

  layoutData: ClubLayout = {
    name: 'Planta Principal',
    view_box_w: 1000,
    view_box_h: 800,
    courts: [],
    decorations: [
      {
        label: 'Recepción & Cafetería Central',
        icon: '🏢',
        shape: { kind: 'rect', x: 380, y: 30, w: 240, h: 70, rotation: 0 }
      },
      {
        label: 'Vestuarios & Lockers',
        icon: '🚿',
        shape: { kind: 'rect', x: 60, y: 700, w: 250, h: 60, rotation: 0 }
      },
      {
        label: 'Parqueadero Principal',
        icon: '🚗',
        shape: { kind: 'rect', x: 690, y: 700, w: 250, h: 60, rotation: 0 }
      }
    ]
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialLayout'] && this.initialLayout) {
      this.layoutData = {
        name: this.initialLayout.name || 'Planta Principal',
        view_box_w: this.initialLayout.view_box_w || 1000,
        view_box_h: this.initialLayout.view_box_h || 800,
        courts: (this.initialLayout.courts || []).map((c) => ({
          court_id: c.court_id,
          shape: {
            kind: 'rect',
            x: (c.shape as any)?.x ?? 50,
            y: (c.shape as any)?.y ?? 150,
            w: (c.shape as any)?.w ?? 160,
            h: (c.shape as any)?.h ?? 240,
            rotation: (c.shape as any)?.rotation ?? 0
          }
        })),
        decorations: this.initialLayout.decorations?.length
          ? this.initialLayout.decorations.map((d) => ({
              label: d.label,
              icon: d.icon || '🏢',
              shape: {
                kind: 'rect',
                x: (d.shape as any)?.x ?? 50,
                y: (d.shape as any)?.y ?? 50,
                w: (d.shape as any)?.w ?? 200,
                h: (d.shape as any)?.h ?? 70,
                rotation: (d.shape as any)?.rotation ?? 0
              }
            }))
          : this.layoutData.decorations
      };
    }

    // Ensure all courts exist in the layout
    this.syncCourtsWithLayout();

    if (!this.selectedCourtId() && this.courts.length > 0) {
      this.selectedCourtId.set(this.courts[0].id);
    }
  }

  syncCourtsWithLayout(): void {
    const existingIds = new Set(this.layoutData.courts.map((c) => c.court_id));
    let xOffset = 60;
    let yOffset = 150;

    for (const court of this.courts) {
      if (!existingIds.has(court.id)) {
        this.layoutData.courts.push({
          court_id: court.id,
          shape: {
            kind: 'rect',
            x: xOffset,
            y: yOffset,
            w: 160,
            h: 240,
            rotation: 0
          }
        });
        xOffset += 190;
        if (xOffset > 800) {
          xOffset = 60;
          yOffset += 270;
        }
      }
    }
  }

  selectCourt(id: string): void {
    this.activeTab.set('courts');
    this.selectedCourtId.set(id);
    this.selectedDecoIndex.set(null);
  }

  selectDeco(index: number): void {
    this.activeTab.set('decorations');
    this.selectedDecoIndex.set(index);
    this.selectedCourtId.set(null);
  }

  getCourtById(id: string): AdminCourt | undefined {
    return this.courts.find((c) => c.id === id);
  }

  selectedCourt(): AdminCourt | undefined {
    const id = this.selectedCourtId();
    return id ? this.getCourtById(id) : undefined;
  }

  selectedDeco(): DecorationItem | undefined {
    const idx = this.selectedDecoIndex();
    if (idx === null || idx < 0 || idx >= this.layoutData.decorations.length) {
      return undefined;
    }
    return this.layoutData.decorations[idx];
  }

  activeItem(): CourtLayoutItem | undefined {
    const id = this.selectedCourtId();
    return this.layoutData.courts.find((c) => c.court_id === id);
  }

  nudgeCourt(item: CourtLayoutItem, dx: number, dy: number): void {
    item.shape.x = Math.max(0, Math.min(850, (item.shape.x || 0) + dx));
    item.shape.y = Math.max(0, Math.min(650, (item.shape.y || 0) + dy));
  }

  nudgeDeco(deco: DecorationItem, dx: number, dy: number): void {
    deco.shape.x = Math.max(0, Math.min(850, (deco.shape.x || 0) + dx));
    deco.shape.y = Math.max(0, Math.min(750, (deco.shape.y || 0) + dy));
  }

  autoDistributeCourts(): void {
    let startX = 60;
    let startY = 140;
    const spacingX = 185;
    const spacingY = 270;

    this.layoutData.courts.forEach((item, index) => {
      const col = index % 5;
      const row = Math.floor(index / 5);
      item.shape.x = startX + col * spacingX;
      item.shape.y = startY + row * spacingY;
      item.shape.w = 160;
      item.shape.h = 240;
      item.shape.rotation = 0;
    });
  }

  // --- Infrastructure Area CRUD ---
  openNewDecoModal(): void {
    this.newAreaLabel = 'Nueva Área';
    this.newAreaIcon = '🏢';
    this.newAreaWidth = 220;
    this.newAreaHeight = 70;
    this.showAddModal.set(true);
  }

  applyPreset(preset: DecoPreset): void {
    this.newAreaLabel = preset.label;
    this.newAreaIcon = preset.icon;
    this.newAreaWidth = preset.w;
    this.newAreaHeight = preset.h;
  }

  confirmAddDecoration(): void {
    if (!this.newAreaLabel.trim()) return;

    // Pick a free spot or default coordinates
    const newY = this.layoutData.decorations.length > 0 ? 30 : 30;
    const newX = 50 + (this.layoutData.decorations.length * 40) % 600;

    const newDeco: DecorationItem = {
      label: this.newAreaLabel.trim(),
      icon: this.newAreaIcon,
      shape: {
        kind: 'rect',
        x: newX,
        y: newY,
        w: this.newAreaWidth,
        h: this.newAreaHeight,
        rotation: 0
      }
    };

    this.layoutData.decorations.push(newDeco);
    const newIndex = this.layoutData.decorations.length - 1;
    this.showAddModal.set(false);
    this.selectDeco(newIndex);
  }

  duplicateDeco(index: number): void {
    const original = this.layoutData.decorations[index];
    if (!original) return;

    const copy: DecorationItem = {
      label: `${original.label} (Copia)`,
      icon: original.icon,
      shape: {
        kind: 'rect',
        x: Math.min(850, original.shape.x + 30),
        y: Math.min(750, original.shape.y + 30),
        w: original.shape.w,
        h: original.shape.h,
        rotation: original.shape.rotation || 0
      }
    };

    this.layoutData.decorations.push(copy);
    this.selectDeco(this.layoutData.decorations.length - 1);
  }

  deleteDeco(index: number): void {
    if (index >= 0 && index < this.layoutData.decorations.length) {
      this.layoutData.decorations.splice(index, 1);
      if (this.selectedDecoIndex() === index) {
        this.selectedDecoIndex.set(null);
      } else if (this.selectedDecoIndex() !== null && this.selectedDecoIndex()! > index) {
        this.selectedDecoIndex.set(this.selectedDecoIndex()! - 1);
      }
    }
  }

  onSave(): void {
    this.saveLayout.emit(this.layoutData);
  }
}

