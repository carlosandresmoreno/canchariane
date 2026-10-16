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
      class="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl border font-mono text-sm shadow-md transition-colors"
      [ngClass]="timerClasses()"
    >
      <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div class="flex items-center gap-1">
        <span class="text-xs uppercase font-sans tracking-wide opacity-80">Bloqueo temporal:</span>
        <span class="font-bold text-base tracking-wider">{{ formattedTime() }}</span>
      </div>
    </div>
  `
})
export class CountdownTimerComponent implements OnInit, OnDestroy {
  readonly expiresAt = input<string | null>(null);
  readonly expired = output<void>();

  private timerId: any = null;
  readonly remainingSeconds = signal<number>(600);

  readonly formattedTime = computed(() => {
    const s = Math.max(0, this.remainingSeconds());
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  });

  readonly isNormal = computed(() => this.remainingSeconds() > 120);
  readonly isWarning = computed(() => this.remainingSeconds() <= 120 && this.remainingSeconds() > 45);
  readonly isUrgent = computed(() => this.remainingSeconds() <= 45);

  readonly timerClasses = computed(() => {
    if (this.isUrgent()) return 'bg-rose-950/70 border-rose-500/60 text-rose-300 animate-pulse';
    if (this.isWarning()) return 'bg-amber-950/60 border-amber-500/50 text-amber-300';
    return 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300';
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
