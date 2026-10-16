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
      class="relative w-full h-[450px] sm:h-[520px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800/80 shadow-2xl select-none"
      (mousedown)="onMouseDown($event)"
      (mousemove)="onMouseMove($event)"
      (mouseup)="onMouseUp()"
      (mouseleave)="onMouseUp()"
      (touchstart)="onTouchStart($event)"
      (touchmove)="onTouchMove($event)"
      (touchend)="onTouchEnd()"
    >
      <!-- Zoom & Pan Controls Floating Toolbar -->
      <div class="absolute top-4 right-4 z-20 flex flex-col gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/60 shadow-lg">
        <button
          type="button"
          (click)="zoomIn()"
          class="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800/80 text-slate-200 hover:bg-emerald-600 hover:text-white transition-colors text-lg font-bold"
          title="Acercar mapa"
          aria-label="Acercar mapa"
        >
          +
        </button>
        <button
          type="button"
          (click)="zoomOut()"
          class="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800/80 text-slate-200 hover:bg-emerald-600 hover:text-white transition-colors text-lg font-bold"
          title="Alejar mapa"
          aria-label="Alejar mapa"
        >
          −
        </button>
        <button
          type="button"
          (click)="resetView()"
          class="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-xs font-semibold"
          title="Restablecer vista"
          aria-label="Restablecer vista"
        >
          1:1
        </button>
      </div>

      <!-- Legend -->
      <div class="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-3 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-800 text-xs font-medium text-slate-300">
        <div class="flex items-center gap-1.5">
          <span class="w-3.5 h-3.5 rounded-md bg-emerald-500/80 border border-emerald-400"></span>
          <span>Disponible</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-3.5 h-3.5 rounded-md bg-slate-800 border border-slate-700"></span>
          <span>Ocupada</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-3.5 h-3.5 rounded-md bg-emerald-400 ring-2 ring-emerald-300 ring-offset-1 ring-offset-slate-900"></span>
          <span>Seleccionada</span>
        </div>
      </div>

      <!-- SVG Canvas -->
      <svg
        #svgRef
        class="w-full h-full cursor-grab active:cursor-grabbing transition-transform"
        [attr.viewBox]="viewBoxString()"
      >
        <defs>
          <!-- Grid Background Pattern -->
          <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.04)" stroke-width="1" />
          </pattern>
          <pattern id="blocked-hatch" width="12" height="12" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="12" stroke="rgba(239, 68, 68, 0.4)" stroke-width="3" />
          </pattern>
        </defs>

        <!-- Dynamic Pan and Zoom Transform Group -->
        <g [attr.transform]="transformString()">
          <!-- Background Grid Canvas -->
          <rect
            [attr.x]="0"
            [attr.y]="0"
            [attr.width]="layout()?.view_box_w || 1000"
            [attr.height]="layout()?.view_box_h || 1000"
            fill="url(#grid-pattern)"
          />

          <!-- Decorations (walkways, nets, labels) -->
          @for (dec of layout()?.decorations || []; track dec.id) {
            <g class="pointer-events-none">
              <rect
                [attr.x]="dec.x"
                [attr.y]="dec.y"
                [attr.width]="dec.w || 20"
                [attr.height]="dec.h || 20"
                fill="rgba(51, 65, 85, 0.4)"
                rx="4"
              />
              @if (dec.label) {
                <text
                  [attr.x]="dec.x + (dec.w || 20) / 2"
                  [attr.y]="dec.y + (dec.h || 20) / 2"
                  text-anchor="middle"
                  dominant-baseline="middle"
                  fill="#94a3b8"
                  font-size="12"
                  font-weight="600"
                >
                  {{ dec.label }}
                </text>
              }
            </g>
          }

          <!-- Courts Geometry -->
          @for (courtItem of layout()?.courts || []; track courtItem.court_id) {
            @let state = getCourtState(courtItem.court_id);
            @let slot = getCourtSlot(courtItem.court_id);
            <g
              class="group cursor-pointer transition-all duration-200 outline-none"
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
                  rx="12"
                  [attr.fill]="state.fill"
                  [attr.stroke]="state.stroke"
                  [attr.stroke-width]="state.strokeWidth"
                  class="transition-all duration-200 group-hover:brightness-110"
                />

                <!-- Court Service Lines Visual Effect -->
                <line
                  [attr.x1]="courtItem.shape.x + courtItem.shape.w / 2"
                  [attr.y1]="courtItem.shape.y + 10"
                  [attr.x2]="courtItem.shape.x + courtItem.shape.w / 2"
                  [attr.y2]="courtItem.shape.y + courtItem.shape.h - 10"
                  stroke="rgba(255, 255, 255, 0.15)"
                  stroke-dasharray="4,4"
                  stroke-width="1.5"
                  class="pointer-events-none"
                />

                <!-- Label & Price Text Overlay -->
                <text
                  [attr.x]="courtItem.shape.x + courtItem.shape.w / 2"
                  [attr.y]="courtItem.shape.y + courtItem.shape.h / 2 - 12"
                  text-anchor="middle"
                  dominant-baseline="middle"
                  fill="#f8fafc"
                  font-size="16"
                  font-weight="700"
                  class="pointer-events-none select-none drop-shadow-md"
                >
                  {{ courtItem.label || 'Cancha' }}
                </text>

                @if (state.isAvailable && slot) {
                  <!-- Price Pill -->
                  <g class="pointer-events-none">
                    <rect
                      [attr.x]="courtItem.shape.x + courtItem.shape.w / 2 - 45"
                      [attr.y]="courtItem.shape.y + courtItem.shape.h / 2 + 8"
                      width="90"
                      height="26"
                      rx="13"
                      fill="rgba(16, 185, 129, 0.95)"
                    />
                    <text
                      [attr.x]="courtItem.shape.x + courtItem.shape.w / 2"
                      [attr.y]="courtItem.shape.y + courtItem.shape.h / 2 + 22"
                      text-anchor="middle"
                      dominant-baseline="middle"
                      fill="#ffffff"
                      font-size="12"
                      font-weight="800"
                      class="select-none"
                    >
                      {{ formatPrice(slot.price_cents) }}
                    </text>
                  </g>
                } @else {
                  <text
                    [attr.x]="courtItem.shape.x + courtItem.shape.w / 2"
                    [attr.y]="courtItem.shape.y + courtItem.shape.h / 2 + 14"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    fill="#64748b"
                    font-size="13"
                    font-weight="600"
                    class="pointer-events-none select-none"
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
                  class="transition-all duration-200 group-hover:brightness-110"
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
  // Inputs
  readonly layout = input<PublicClubLayout | null>(null);
  readonly slots = input<PublicSlot[]>([]);
  readonly selectedCourtId = input<string | null>(null);

  // Output
  readonly courtSelect = output<string>();

  // Pan & Zoom Reactive Signals
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

  getCourtState(courtId: string): {
    isAvailable: boolean;
    fill: string;
    stroke: string;
    strokeWidth: number;
  } {
    const slot = this.getCourtSlot(courtId);
    const isAvailable = !!(slot && slot.is_available);
    const isSelected = this.selectedCourtId() === courtId;

    if (isSelected) {
      return {
        isAvailable,
        fill: 'rgba(16, 185, 129, 0.45)',
        stroke: '#34d399',
        strokeWidth: 4
      };
    }

    if (isAvailable) {
      return {
        isAvailable: true,
        fill: 'rgba(5, 150, 105, 0.28)',
        stroke: 'rgba(16, 185, 129, 0.8)',
        strokeWidth: 2
      };
    }

    return {
      isAvailable: false,
      fill: 'rgba(30, 41, 59, 0.7)',
      stroke: 'rgba(71, 85, 105, 0.5)',
      strokeWidth: 1.5
    };
  }

  selectCourt(courtId: string, isAvailable: boolean): void {
    if (isAvailable) {
      this.courtSelect.emit(courtId);
    }
  }

  formatPrice(cents?: number): string {
    if (!cents) return '$0';
    return '$' + (cents / 100).toLocaleString('es-CO');
  }

  // Pan & Zoom Handlers
  zoomIn(): void {
    this.scale.update((s) => Math.min(2.5, s + 0.2));
  }

  zoomOut(): void {
    this.scale.update((s) => Math.max(0.6, s - 0.2));
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
