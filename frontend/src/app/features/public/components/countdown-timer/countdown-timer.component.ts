import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  input,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-countdown-timer',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/95 backdrop-blur-xl border transition-all duration-300 shadow-sm"
      [ngClass]="containerBorderClass()"
    >
      <div class="relative flex items-center justify-center">
        <span
          class="w-2 h-2 rounded-full"
          [ngClass]="isUrgent() ? 'bg-rose-500 animate-ping' : 'bg-olive-600'"
        ></span>
        <span
          class="absolute w-2 h-2 rounded-full"
          [ngClass]="isUrgent() ? 'bg-rose-600' : 'bg-stone-800'"
        ></span>
      </div>

      <div class="flex items-baseline gap-2">
        <span class="text-[10px] uppercase font-mono tracking-widest text-stone-500 font-medium">Hold Activo:</span>
        <span class="font-mono font-medium text-sm tracking-wider" [ngClass]="textClass()">{{ formattedTime() }}</span>
      </div>

      <!-- Linear Micro Progress Bar -->
      <div class="w-12 h-1 rounded-full bg-stone-100 overflow-hidden ml-1">
        <div
          class="h-full rounded-full transition-all duration-1000 ease-linear"
          [style.width.%]="progressPercent()"
          [ngClass]="progressClass()"
        ></div>
      </div>
    </div>
  `
})
export class CountdownTimerComponent implements OnInit, OnDestroy {
  readonly expiresAt = input<string | null>(null);
  readonly expired = output<void>();

  private timerId: any = null;
  readonly remainingSeconds = signal<number>(600);
  private initialSeconds = 600;

  readonly formattedTime = computed(() => {
    const s = Math.max(0, this.remainingSeconds());
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  });

  readonly progressPercent = computed(() => {
    return Math.min(100, Math.max(0, (this.remainingSeconds() / this.initialSeconds) * 100));
  });

  readonly isNormal = computed(() => this.remainingSeconds() > 120);
  readonly isWarning = computed(() => this.remainingSeconds() <= 120 && this.remainingSeconds() > 45);
  readonly isUrgent = computed(() => this.remainingSeconds() <= 45);

  readonly containerBorderClass = computed(() => {
    if (this.isUrgent()) return 'border-rose-300 shadow-rose-100';
    if (this.isWarning()) return 'border-amber-300 shadow-amber-100';
    return 'border-stone-200/80 shadow-stone-100';
  });

  readonly textClass = computed(() => {
    if (this.isUrgent()) return 'text-rose-600';
    if (this.isWarning()) return 'text-amber-800';
    return 'text-stone-900';
  });

  readonly progressClass = computed(() => {
    if (this.isUrgent()) return 'bg-rose-500';
    if (this.isWarning()) return 'bg-amber-600';
    return 'bg-stone-800';
  });

  ngOnInit(): void {
    this.updateRemaining();
    this.timerId = setInterval(() => {
      this.updateRemaining();
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
    }
  }

  private updateRemaining(): void {
    const exp = this.expiresAt();
    if (!exp) return;

    const target = new Date(exp).getTime();
    const now = Date.now();
    const diff = Math.floor((target - now) / 1000);

    if (diff <= 0) {
      this.remainingSeconds.set(0);
      if (this.timerId) clearInterval(this.timerId);
      this.expired.emit();
    } else {
      this.remainingSeconds.set(diff);
    }
  }
}
