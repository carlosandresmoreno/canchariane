import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CourtLayoutItem, DecorationItem, PolygonShape, PublicClubLayout, PublicSlot, RectShape } from '../../models/public.models';

@Component({
  selector: 'app-court-map',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="relative w-full h-[460px] sm:h-[540px] rounded-3xl overflow-hidden bg-[#F8FAFC] border border-slate-200 shadow-sm select-none"
      (mousedown)="onMouseDown($event)"
      (mousemove)="onMouseMove($event)"
      (mouseup)="onMouseUp()"
      (mouseleave)="onMouseUp()"
      (touchstart)="onTouchStart($event)"
      (touchmove)="onTouchMove($event)"
      (touchend)="onTouchEnd()"
    >
      <!-- Subtle Architectural Coordinate Grid Overlay -->
      <div class="absolute top-4 left-4 z-20 pointer-events-none flex items-center gap-2">
        <span class="w-1.5 h-1.5 rounded-full bg-[#0056FB] animate-pulse"></span>
        <span class="font-mono text-[10px] uppercase tracking-widest text-slate-500 font-medium">Plano Arquitectónico Interactivo</span>
      </div>

      <!-- Zoom & Pan Floating Controls -->
      <div class="absolute top-4 right-4 z-20 flex flex-col gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 shadow-sm">
        <button
          type="button"
          (click)="zoomIn()"
          class="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 text-slate-700 hover:bg-[#0056FB] hover:text-white transition-all text-base font-light shadow-xs"
          title="Acercar plano"
          aria-label="Acercar plano"
        >
          +
        </button>
        <button
          type="button"
          (click)="zoomOut()"
          class="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 text-slate-700 hover:bg-[#0056FB] hover:text-white transition-all text-base font-light shadow-xs"
          title="Alejar plano"
          aria-label="Alejar plano"
        >
          −
        </button>
        <button
          type="button"
          (click)="resetView()"
          class="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 text-slate-600 hover:bg-[#0056FB] hover:text-white transition-all font-mono text-[10px] shadow-xs"
          title="Restablecer escala"
          aria-label="Restablecer escala"
        >
          1:1
        </button>
      </div>

      <!-- Minimalist Luxury Legend -->
      <div class="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-4 bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-200 text-[11px] font-medium text-slate-600 shadow-sm">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-white border-2 border-[#0056FB]"></span>
          <span class="text-slate-800 font-medium">Disponible</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-300"></span>
          <span class="text-slate-400">Ocupada</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-[#0056FB] ring-2 ring-[#0056FB]/25"></span>
          <span class="text-slate-900 font-semibold">Seleccionada</span>
        </div>
      </div>

      <!-- SVG Canvas -->
      <svg
        #svgRef
        class="w-full h-full cursor-grab active:cursor-grabbing transition-transform"
        [attr.viewBox]="viewBoxString()"
      >
        <defs>
          <!-- Subtle Blueprint Millimeter Grid -->
          <pattern id="arch-grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(15, 23, 42, 0.04)" stroke-width="0.75" />
          </pattern>
        </defs>

        <!-- Dynamic Pan and Zoom Transform Group -->
        <g [attr.transform]="transformString()">
          <!-- Blueprint Base Rect -->
          <rect
            [attr.x]="0"
            [attr.y]="0"
            [attr.width]="layout()?.view_box_w || 1000"
            [attr.height]="layout()?.view_box_h || 1000"
            fill="url(#arch-grid)"
          />

          <!-- Decorations (Recepción, Cafetería, Parqueadero) -->
          @for (dec of layout()?.decorations || []; track dec.id) {
            @let decShape = getDecorationShape(dec);
            @if (decShape) {
              <g class="pointer-events-none">
                <rect
                  [attr.x]="decShape.x"
                  [attr.y]="decShape.y"
                  [attr.width]="decShape.w"
                  [attr.height]="decShape.h"
                  fill="rgba(255, 255, 255, 0.95)"
                  stroke="rgba(203, 213, 225, 0.8)"
                  stroke-width="1"
                  rx="8"
                />
                @if (dec.label) {
                  <text
                    [attr.x]="decShape.x + decShape.w / 2"
                    [attr.y]="decShape.y + decShape.h / 2"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    fill="#64748b"
                    font-size="11"
                    font-family="'Plus Jakarta Sans', sans-serif"
                    font-weight="500"
                    letter-spacing="0.05em"
                  >
                    {{ dec.label }}
                  </text>
                }
              </g>
            }
          }

          <!-- Courts Geometry -->
          @for (courtItem of layout()?.courts || []; track courtItem.court_id) {
            @let state = getCourtState(courtItem.court_id);
            @let slot = getCourtSlot(courtItem.court_id);
            <g
              class="group cursor-pointer transition-all duration-300 outline-none"
              tabindex="0"
              role="button"
              [attr.aria-label]="courtItem.label + (state.isAvailable ? ' - Disponible por ' + formatPrice(slot?.price_cents) : ' - Ocupada')"
              (click)="selectCourt(courtItem.court_id, state.isAvailable)"
              (keydown.enter)="selectCourt(courtItem.court_id, state.isAvailable)"
              (keydown.space)="selectCourt(courtItem.court_id, state.isAvailable)"
            >
              @if (isRect(courtItem.shape)) {
                <rect
                  [attr.x]="courtItem.shape.x"
                  [attr.y]="courtItem.shape.y"
                  [attr.width]="courtItem.shape.w"
                  [attr.height]="courtItem.shape.h"
                  rx="16"
                  [attr.fill]="state.fill"
                  [attr.stroke]="state.stroke"
                  [attr.stroke-width]="state.strokeWidth"
                  class="transition-all duration-300 shadow-sm"
                />

                <!-- Court Service Lines -->
                <line
                  [attr.x1]="courtItem.shape.x + courtItem.shape.w / 2"
                  [attr.y1]="courtItem.shape.y + 12"
                  [attr.x2]="courtItem.shape.x + courtItem.shape.w / 2"
                  [attr.y2]="courtItem.shape.y + courtItem.shape.h - 12"
                  [attr.stroke]="state.serviceLineStroke"
                  stroke-dasharray="3,3"
                  stroke-width="1"
                  class="pointer-events-none"
                />

                <!-- Court Title -->
                <text
                  [attr.x]="courtItem.shape.x + courtItem.shape.w / 2"
                  [attr.y]="courtItem.shape.y + courtItem.shape.h / 2 - 12"
                  text-anchor="middle"
                  dominant-baseline="middle"
                  [attr.fill]="state.titleColor"
                  font-family="'Plus Jakarta Sans', sans-serif"
                  font-size="15"
                  font-weight="600"
                  letter-spacing="-0.01em"
                  class="pointer-events-none select-none"
                >
                  {{ courtItem.label || 'Cancha' }}
                </text>

                <!-- Status / Price Badge Overlay -->
                @if (state.isAvailable && slot) {
                  <g class="pointer-events-none select-none">
                    <rect
                      [attr.x]="courtItem.shape.x + courtItem.shape.w / 2 - 48"
                      [attr.y]="courtItem.shape.y + courtItem.shape.h / 2 + 10"
                      width="96"
                      height="24"
                      rx="12"
                      fill="#EFF6FF"
                      stroke="#0056FB"
                      stroke-width="1"
                    />
                    <text
                      [attr.x]="courtItem.shape.x + courtItem.shape.w / 2"
                      [attr.y]="courtItem.shape.y + courtItem.shape.h / 2 + 23"
                      text-anchor="middle"
                      dominant-baseline="middle"
                      fill="#0056FB"
                      font-family="'JetBrains Mono', monospace"
                      font-size="11"
                      font-weight="600"
                    >
                      {{ formatPrice(slot.price_cents) }}
                    </text>
                  </g>
                } @else {
                  <text
                    [attr.x]="courtItem.shape.x + courtItem.shape.w / 2"
                    [attr.y]="courtItem.shape.y + courtItem.shape.h / 2 + 16"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    fill="#94A3B8"
                    font-family="'Plus Jakarta Sans', sans-serif"
                    font-size="12"
                    font-weight="400"
                    letter-spacing="0.05em"
                    class="pointer-events-none select-none uppercase text-[10px]"
                  >
                    Ocupada
                  </text>
                }
              } @else if (isPolygon(courtItem.shape)) {
                <polygon
                  [attr.points]="getPointsString(courtItem.shape.points)"
                  [attr.fill]="state.fill"
                  [attr.stroke]="state.stroke"
                  [attr.stroke-width]="state.strokeWidth"
                  class="transition-all duration-300"
                />
              }
            </g>
          }
        </g>
      </svg>
    </div>
  `
})
export class CourtMapComponent {
  readonly layout = input<PublicClubLayout | null>(null);
  readonly slots = input<PublicSlot[]>([]);
  readonly selectedCourtId = input<string | null>(null);
  readonly courtSelect = output<string>();

  readonly scale = signal<number>(1);
  readonly panX = signal<number>(0);
  readonly panY = signal<number>(0);

  private isDragging = false;
  private startX = 0;
  private startY = 0;

  readonly viewBoxString = computed(() => {
    const l = this.layout();
    const w = l?.view_box_w || 1000;
    const h = l?.view_box_h || 1000;
    return `0 0 ${w} ${h}`;
  });

  readonly transformString = computed(() => {
    return `translate(${this.panX()}, ${this.panY()}) scale(${this.scale()})`;
  });

  isRect(shape: any): shape is RectShape {
    return shape?.kind === 'rect';
  }

  isPolygon(shape: any): shape is PolygonShape {
    return shape?.kind === 'polygon';
  }

  getPointsString(points: [number, number][]): string {
    return points.map(([x, y]) => `${x},${y}`).join(' ');
  }

  getCourtSlot(courtId: string): PublicSlot | undefined {
    return this.slots().find((s) => s.court_id === courtId);
  }

  getDecorationShape(dec: any): { x: number; y: number; w: number; h: number } | null {
    if (dec?.shape && typeof dec.shape.x === 'number') {
      return {
        x: dec.shape.x,
        y: dec.shape.y,
        w: dec.shape.w || 200,
        h: dec.shape.h || 60
      };
    }
    if (typeof dec?.x === 'number') {
      return {
        x: dec.x,
        y: dec.y,
        w: dec.w || 200,
        h: dec.h || 60
      };
    }
    return null;
  }

  getCourtState(courtId: string): {
    isAvailable: boolean;
    fill: string;
    stroke: string;
    strokeWidth: number;
    titleColor: string;
    serviceLineStroke: string;
  } {
    const slot = this.getCourtSlot(courtId);
    const isAvailable = !!(slot && slot.is_available);
    const isSelected = this.selectedCourtId() === courtId;

    if (isSelected) {
      return {
        isAvailable,
        fill: '#EFF6FF',
        stroke: '#0056FB',
        strokeWidth: 2.5,
        titleColor: '#0056FB',
        serviceLineStroke: 'rgba(0, 86, 251, 0.25)'
      };
    }

    if (isAvailable) {
      return {
        isAvailable: true,
        fill: '#FFFFFF',
        stroke: '#0056FB',
        strokeWidth: 1.5,
        titleColor: '#0F172A',
        serviceLineStroke: 'rgba(0, 86, 251, 0.15)'
      };
    }

    return {
      isAvailable: false,
      fill: '#F1F5F9',
      stroke: '#E2E8F0',
      strokeWidth: 1,
      titleColor: '#94A3B8',
      serviceLineStroke: 'rgba(0, 0, 0, 0.03)'
    };
  }

  selectCourt(courtId: string, isAvailable: boolean): void {
    if (isAvailable) {
      this.courtSelect.emit(courtId);
    }
  }

  formatPrice(cents?: number): string {
    if (!cents) return '$0 COP';
    return '$' + (cents / 100).toLocaleString('es-CO');
  }

  zoomIn(): void {
    this.scale.update((s) => Math.min(2.5, +(s + 0.25).toFixed(2)));
  }

  zoomOut(): void {
    this.scale.update((s) => Math.max(0.75, +(s - 0.25).toFixed(2)));
  }

  resetView(): void {
    this.scale.set(1);
    this.panX.set(0);
    this.panY.set(0);
  }

  onMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    this.isDragging = true;
    this.startX = e.clientX - this.panX();
    this.startY = e.clientY - this.panY();
  }

  onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    this.panX.set(e.clientX - this.startX);
    this.panY.set(e.clientY - this.startY);
  }

  onMouseUp(): void {
    this.isDragging = false;
  }

  onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      this.isDragging = true;
      this.startX = e.touches[0].clientX - this.panX();
      this.startY = e.touches[0].clientY - this.panY();
    }
  }

  onTouchMove(e: TouchEvent): void {
    if (!this.isDragging || e.touches.length !== 1) return;
    this.panX.set(e.touches[0].clientX - this.startX);
    this.panY.set(e.touches[0].clientY - this.startY);
  }

  onTouchEnd(): void {
    this.isDragging = false;
  }
}
