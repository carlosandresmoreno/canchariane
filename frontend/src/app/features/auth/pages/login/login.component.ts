import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
    <div class="min-h-screen bg-[#0A1832] text-[#e2e8f4] flex items-center justify-center p-4 selection:bg-[#0056FB] selection:text-white relative overflow-hidden font-sans">
      <!-- Organic Deep Marine Ambient Glow -->
      <div class="ambient-lighting"></div>

      <div class="w-full max-w-md space-y-8 p-8 sm:p-10 rounded-3xl bg-[#0e2042]/90 backdrop-blur-2xl border border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.6)] relative z-10">
        <!-- Logo -->
        <div class="text-center space-y-2">
          <div class="w-12 h-12 rounded-2xl bg-[#132a54] border border-[#0056FB]/40 flex items-center justify-center mx-auto text-[#0056FB] font-serif italic text-2xl shadow-[0_0_20px_rgba(0,86,251,0.3)]">
            C
          </div>
          <h1 class="text-3xl font-serif italic text-white tracking-tight">Acceso Administrativo</h1>
          <p class="text-xs text-[#8fa3c7] font-sans">Ingresa tus credenciales para operar el panel del club</p>
        </div>

        @if (errorMessage()) {
          <div class="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs text-center font-sans animate-in fade-in">
            {{ errorMessage() }}
          </div>
        }

        <form (ngSubmit)="onLogin()" class="space-y-4">
          <div>
            <label for="email" class="block text-[11px] font-mono uppercase tracking-wider text-[#8fa3c7] mb-1.5">Correo Electrónico</label>
            <input
              id="email"
              type="email"
              required
              [(ngModel)]="email"
              name="email"
              placeholder="admin@canchariane.com"
              class="w-full px-4 py-3 rounded-xl bg-[#071328]/80 border border-white/[0.1] text-white placeholder-[#556b8e] focus:bg-[#081734] focus:outline-none focus:border-[#0056FB] focus:ring-1 focus:ring-[#0056FB]/40 text-sm transition-colors font-mono"
            />
          </div>

          <div>
            <label for="password" class="block text-[11px] font-mono uppercase tracking-wider text-[#8fa3c7] mb-1.5">Contraseña</label>
            <input
              id="password"
              type="password"
              required
              [(ngModel)]="password"
              name="password"
              placeholder="••••••••••••"
              class="w-full px-4 py-3 rounded-xl bg-[#071328]/80 border border-white/[0.1] text-white placeholder-[#556b8e] focus:bg-[#081734] focus:outline-none focus:border-[#0056FB] focus:ring-1 focus:ring-[#0056FB]/40 text-sm transition-colors font-mono"
            />
          </div>

          <button
            type="submit"
            [disabled]="isLoading() || !email || !password"
            class="w-full py-3.5 px-4 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] disabled:opacity-40 text-white font-medium text-xs font-mono uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(0,86,251,0.4)] active:scale-[0.98] flex items-center justify-center gap-2 mt-6"
          >
            @if (isLoading()) {
              <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Iniciando sesión...</span>
            } @else {
              <span>Ingresar al Panel</span>
            }
          </button>
        </form>

        <!-- Quick Demo Credentials Box -->
        <div class="p-3.5 rounded-2xl bg-[#071328]/80 border border-white/[0.08] text-xs space-y-2.5">
          <div class="text-[#8fa3c7] font-mono text-[10px] uppercase tracking-wider flex items-center justify-between">
            <span>Credenciales Demo:</span>
            <span class="text-[#0056FB] font-semibold">1-Clic</span>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              (click)="fillCredentials('admin@canchariane.com', 'AdminPassword123!')"
              class="flex-1 py-2 px-2.5 rounded-xl bg-[#0e2042] hover:bg-[#132a54] text-[#e2e8f4] border border-white/[0.08] hover:border-[#0056FB]/40 text-xs font-mono tracking-wider transition-colors shadow-sm"
            >
              Administrador
            </button>
            <button
              type="button"
              (click)="fillCredentials('staff@canchariane.com', 'StaffPassword123!')"
              class="flex-1 py-2 px-2.5 rounded-xl bg-[#0e2042] hover:bg-[#132a54] text-[#e2e8f4] border border-white/[0.08] hover:border-[#0056FB]/40 text-xs font-mono tracking-wider transition-colors shadow-sm"
            >
              Recepcionista
            </button>
          </div>
        </div>

        <div class="pt-4 border-t border-white/[0.08] text-center text-xs text-[#556b8e] font-sans">
          ¿No tienes acceso? Contacta al superadministrador de tu club.
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  fillCredentials(email: string, pass: string): void {
    this.email = email;
    this.password = pass;
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
          // Fetch current user details
          this.authService.getMe().subscribe({
            next: (user) => {
              this.authStore.setCurrentUser(user);
              this.isLoading.set(false);
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
          this.errorMessage.set(
            err.error?.detail || 'Credenciales inválidas. Verifica tu correo y contraseña.'
          );
        }
      });
  }
}
