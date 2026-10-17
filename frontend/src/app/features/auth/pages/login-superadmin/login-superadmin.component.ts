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
  selector: 'app-login-superadmin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-white text-slate-900 flex items-center justify-center p-4 selection:bg-[#0056FB] selection:text-white relative overflow-hidden font-sans">
      <!-- Clean Luminous Ambient Glow -->
      <div class="ambient-lighting"></div>

      <div class="w-full max-w-md space-y-6 p-7 sm:p-9 rounded-3xl bg-white border border-slate-200/90 shadow-[0_25px_60px_rgba(15,23,42,0.07)] relative z-10">
        <!-- Developer & Superadmin Terminal Branding -->
        <div class="text-center space-y-2.5">
          <div class="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center mx-auto text-xl shadow-md border border-slate-700">
            👑
          </div>

          <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-mono tracking-wider uppercase">
            <span class="w-1.5 h-1.5 rounded-full bg-[#0056FB] animate-pulse"></span>
            <span>Platform Developer & Superadmin Console</span>
          </div>

          <h1 class="text-2xl sm:text-3xl font-serif italic text-slate-900 tracking-tight">
            Consola Superadministrador
          </h1>

          <p class="text-xs text-slate-500 font-sans leading-relaxed">
            Gestión centralizada de infraestructura, tenants, activación de sitios públicos y gobierno de la plataforma
          </p>
        </div>

        <!-- Error Feedback -->
        @if (errorMessage()) {
          <div class="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-mono flex items-start gap-2.5 animate-in fade-in">
            <span class="text-rose-500 font-bold shrink-0">⚠️</span>
            <span class="flex-1 leading-relaxed">{{ errorMessage() }}</span>
          </div>
        }

        <!-- Superadmin Auth Form -->
        <form (ngSubmit)="onLogin()" class="space-y-4">
          <div>
            <label for="admin-email" class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
              Correo de Desarrollador / Superadmin
            </label>
            <input
              id="admin-email"
              type="email"
              required
              [(ngModel)]="email"
              name="adminEmail"
              placeholder="admin@tuplataforma.com"
              class="w-full px-4 py-3 rounded-xl bg-slate-50/70 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0056FB] focus:ring-1 focus:ring-[#0056FB]/30 text-sm transition-colors font-mono"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label for="admin-pass" class="block text-[11px] font-mono uppercase tracking-wider text-slate-500">
                Clave Maestra
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
              id="admin-pass"
              [type]="showPassword() ? 'text' : 'password'"
              required
              [(ngModel)]="password"
              name="adminPassword"
              placeholder="••••••••••••"
              class="w-full px-4 py-3 rounded-xl bg-slate-50/70 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#0056FB] focus:ring-1 focus:ring-[#0056FB]/30 text-sm transition-colors font-mono"
            />
          </div>

          <button
            type="submit"
            [disabled]="isLoading() || !email || !password"
            class="w-full py-3.5 px-4 rounded-xl bg-slate-950 hover:bg-[#0056FB] disabled:opacity-40 text-white font-medium text-xs font-mono uppercase tracking-wider transition-all shadow-[0_4px_20px_rgba(15,23,42,0.2)] active:scale-[0.98] flex items-center justify-center gap-2 mt-6"
          >
            @if (isLoading()) {
              <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Validando Credenciales Globales...</span>
            } @else {
              <span>Ingresar a Consola de Plataforma ➔</span>
            }
          </button>
        </form>

        <div class="pt-3 border-t border-slate-100 text-center text-xs font-sans text-slate-500">
          ¿Trabajas en la recepción o administración de un club deportivo?
          <a
            routerLink="/auth/login"
            class="text-[#0056FB] font-medium hover:underline block mt-1"
          >
            Ir al Acceso de Clubes →
          </a>
        </div>
      </div>
    </div>
  `
})
export class LoginSuperadminComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal<boolean>(false);

  ngOnInit(): void {
    // If already authenticated and superadmin, navigate to superadmin
    if (this.authStore.isAuthenticated() && this.authStore.isSuperadmin()) {
      this.router.navigate(['/superadmin']);
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

              if (user.is_superadmin) {
                const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/superadmin';
                this.router.navigateByUrl(returnUrl);
              } else {
                // Not superadmin: revoke session and display explicit denial
                this.authStore.clearSession();
                this.errorMessage.set(
                  `Acceso no autorizado: La cuenta '${user.email}' no posee permisos de Desarrollador / Superadministrador de plataforma. Si eres recepcionista o administrador de un club, ingresa por /auth/login.`
                );
              }
            },
            error: () => {
              this.isLoading.set(false);
              this.errorMessage.set('Error al verificar privilegios de superadministrador.');
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
