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
    <div class="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-emerald-500 selection:text-white">
      <div class="w-full max-w-md space-y-8 p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-xl">
        <!-- Logo -->
        <div class="text-center space-y-2">
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center mx-auto text-slate-950 font-display font-extrabold text-2xl shadow-xl shadow-emerald-950">
            C
          </div>
          <h1 class="text-2xl font-display font-bold text-white tracking-tight">Acceso Administrativo</h1>
          <p class="text-xs text-slate-400">Ingresa con tus credenciales de administrador de club</p>
        </div>

        @if (errorMessage()) {
          <div class="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs text-center animate-in fade-in">
            {{ errorMessage() }}
          </div>
        }

        <form (ngSubmit)="onLogin()" class="space-y-4">
          <div>
            <label for="email" class="block text-xs font-semibold text-slate-300 mb-1.5">Correo Electrónico</label>
            <input
              id="email"
              type="email"
              required
              [(ngModel)]="email"
              name="email"
              placeholder="admin@clubpadel.com"
              class="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-sm transition-colors"
            />
          </div>

          <div>
            <label for="password" class="block text-xs font-semibold text-slate-300 mb-1.5">Contraseña</label>
            <input
              id="password"
              type="password"
              required
              [(ngModel)]="password"
              name="password"
              placeholder="••••••••••••"
              class="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-sm transition-colors"
            />
          </div>

          <button
            type="submit"
            [disabled]="isLoading() || !email || !password"
            class="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 mt-6"
          >
            @if (isLoading()) {
              <span class="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
              <span>Iniciando sesión...</span>
            } @else {
              <span>Ingresar al Panel</span>
            }
          </button>
        </form>

        <div class="pt-4 border-t border-slate-800 text-center text-xs text-slate-500">
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
