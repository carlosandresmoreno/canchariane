import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../../../core/services/auth.service';
import { AuthStore } from '../../../../core/state/auth.store';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-white text-slate-900 flex items-center justify-center p-4 selection:bg-[#0056FB] selection:text-white relative overflow-hidden font-sans">
      <!-- Clean Luminous Ambient Glow -->
      <div class="ambient-lighting"></div>

      <div class="w-full max-w-md space-y-6 p-7 sm:p-9 rounded-3xl bg-white border border-slate-200/90 shadow-[0_20px_50px_rgba(15,23,42,0.06)] relative z-10">
        <!-- Club Branding Header -->
        <div class="text-center space-y-2.5">
          <img src="logo-mark.svg" alt="Canchariane" class="w-14 h-14 rounded-2xl mx-auto shadow-md" />

          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50/70 border border-blue-200 text-[#0056FB] text-[10px] font-mono tracking-wider uppercase">
            <span class="w-1.5 h-1.5 rounded-full bg-[#0056FB]"></span>
            <span>Acceso Personal & Administración de Sede</span>
          </div>

          <h1 class="text-2xl sm:text-3xl font-serif italic text-slate-900 tracking-tight">
            Acceso a Club Deportivo
          </h1>

          <p class="text-xs text-slate-500 font-sans leading-relaxed">
            Ingreso para dueños del club, administradores y recepcionistas
          </p>

          @if (clubSlug()) {
            <div class="mt-2 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-mono">
              <span class="text-slate-400">Sede:</span>
              <strong class="text-slate-900">/c/{{ clubSlug() }}</strong>
            </div>
          }
        </div>

        <!-- Error Banner -->
        @if (errorMessage()) {
          <div class="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-mono flex items-start gap-2.5 animate-in fade-in">
            <span class="text-rose-500 font-bold shrink-0">⚠️</span>
            <span class="flex-1 leading-relaxed">{{ errorMessage() }}</span>
          </div>
        }

        <!-- Club Login Form -->
        <form (ngSubmit)="onLogin()" class="space-y-4">
          <div>
            <label for="email" class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
              Correo Electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              [(ngModel)]="email"
              name="email"
              placeholder="ejemplo@miclub.com"
              class="w-full px-4 py-3 rounded-xl bg-slate-50/70 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0056FB] focus:ring-1 focus:ring-[#0056FB]/30 text-sm transition-colors font-mono"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label for="password" class="block text-[11px] font-mono uppercase tracking-wider text-slate-500">
                Contraseña
              </label>
              <button
                type="button"
                (click)="showPassword.set(!showPassword())"
                class="text-[10px] font-mono text-slate-400 hover:text-slate-700 uppercase tracking-wider transition-colors"
              >
                {{ showPassword() ? 'Ocultar' : 'Mostrar' }}
              </button>
            </div>
            <input
              id="password"
              [type]="showPassword() ? 'text' : 'password'"
              required
              [(ngModel)]="password"
              name="password"
              placeholder="••••••••••••"
              class="w-full px-4 py-3 rounded-xl bg-slate-50/70 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0056FB] focus:ring-1 focus:ring-[#0056FB]/30 text-sm transition-colors font-mono"
            />
          </div>

          <button
            type="submit"
            [disabled]="isLoading() || !email || !password"
            class="w-full py-3.5 px-4 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] disabled:opacity-40 text-white font-medium text-xs font-mono uppercase tracking-wider transition-all shadow-[0_4px_20px_rgba(0,86,251,0.25)] active:scale-[0.98] flex items-center justify-center gap-2 mt-6"
          >
            @if (isLoading()) {
              <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Iniciando sesión...</span>
            } @else {
              <span>Ingresar al Panel del Club ➔</span>
            }
          </button>
        </form>

        <div class="pt-3 border-t border-slate-100 text-center text-xs font-sans text-slate-500">
          ¿Eres desarrollador o administrador general de la plataforma?
          <a
            routerLink="/auth/login-superadmin"
            class="text-[#0056FB] font-medium hover:underline block mt-1"
          >
            Ir a Consola Superadmin →
          </a>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  readonly clubSlug = signal<string | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal<boolean>(false);

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParams;
    if (qp['club']) {
      this.clubSlug.set(qp['club']);
    }
  }

  onLogin(): void {
    if (!this.email || !this.password) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService
      .login({ email: this.email.trim(), password: this.password })
      .subscribe({
        next: (tokenRes) => {
          this.authStore.setAccessToken(tokenRes.access_token);

          this.authService.getMe().subscribe({
            next: (user) => {
              this.authStore.setCurrentUser(user);
              this.isLoading.set(false);

              // Route directly to Club Operations Dashboard
              const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/admin';
              this.router.navigateByUrl(returnUrl);
            },
            error: () => {
              this.isLoading.set(false);
              this.router.navigate(['/admin']);
            }
          });
        },
        error: (err) => {
          this.isLoading.set(false);
          const detail = err.error?.detail;
          this.errorMessage.set(
            typeof detail === 'string'
              ? detail
              : 'Credenciales inválidas. Verifica tu correo y contraseña.'
          );
        }
      });
  }
}
