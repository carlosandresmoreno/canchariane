import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthStore } from '../../../../core/state/auth.store';
import {
  SuperadminClub,
  SuperadminClubCreate,
  SuperadminClubUpdate,
  SuperadminService,
  SuperadminStats
} from '../../services/superadmin.service';

@Component({
  selector: 'app-superadmin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-white text-slate-900 flex flex-col selection:bg-[#0056FB] selection:text-white relative overflow-hidden font-sans">
      <!-- Clean Luminous Ambient Glow -->
      <div class="ambient-lighting"></div>

      <!-- Top Global Header -->
      <header class="border-b border-slate-200/80 bg-white/90 backdrop-blur-xl sticky top-0 z-30">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center font-serif italic text-base text-[#0056FB] shadow-xs">
              👑
            </div>
            <div>
              <div class="flex items-center gap-2.5">
                <h1 class="font-display font-semibold text-slate-900 text-sm sm:text-base tracking-wide">
                  Superadministración Global
                </h1>
                <span class="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0056FB] border border-blue-200 text-[10px] font-mono tracking-wider uppercase flex items-center gap-1.5 font-medium">
                  <span class="w-1.5 h-1.5 rounded-full bg-[#0056FB]"></span>
                  Tenant Engine
                </span>
              </div>
              <p class="text-[11px] text-slate-500 font-mono tracking-wider uppercase">
                Control Central de Clubes, Membresías y Plataforma
              </p>
            </div>
          </div>

          <!-- Actions & Profile -->
          <div class="flex items-center gap-3 sm:gap-4">
            <a
              routerLink="/admin"
              class="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-950 font-mono text-xs uppercase tracking-wider transition-colors shadow-xs"
              title="Ir al panel del club activo"
            >
              <span>Panel de Club</span>
              <span>↗</span>
            </a>

            <button
              type="button"
              (click)="openCreateModal()"
              class="px-4 py-2 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] text-white font-mono text-xs uppercase tracking-wider font-medium transition-all shadow-md active:scale-95 flex items-center gap-1.5"
            >
              <span>+ Nuevo Club</span>
            </button>

            <!-- User Menu -->
            <div class="flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <div class="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-mono font-medium text-slate-700 shadow-xs">
                {{ authStore.userInitials() }}
              </div>
              <button
                type="button"
                (click)="logout()"
                class="text-xs uppercase tracking-wider font-mono text-slate-500 hover:text-slate-900 transition-colors hidden sm:inline"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Main Layout -->
      <main class="max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full flex-1 space-y-8 relative z-10">
        <!-- Notification Message -->
        @if (feedbackMessage()) {
          <div class="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between font-mono animate-in fade-in">
            <span>{{ feedbackMessage() }}</span>
            <button type="button" (click)="feedbackMessage.set(null)" class="text-emerald-600 hover:text-emerald-950">✕</button>
          </div>
        }

        <!-- Platform-Wide KPI Monoliths -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5">
          <div class="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-between group hover:border-[#0056FB]/40 transition-all duration-300">
            <div>
              <span class="text-[10px] text-slate-400 uppercase font-mono tracking-[0.2em] block mb-1">Clubes Activos</span>
              <div class="text-2xl sm:text-3xl font-serif italic text-slate-900">
                {{ stats()?.active_clubs ?? 0 }} <span class="text-sm font-sans font-normal text-slate-400">/ {{ stats()?.total_clubs ?? 0 }}</span>
              </div>
              <span class="text-[10px] text-slate-500 font-mono mt-0.5 block">Total de tenants</span>
            </div>
            <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-[#0056FB] font-mono text-xs sm:text-sm group-hover:scale-105 transition-transform shadow-xs">
              🏢
            </div>
          </div>

          <div class="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-between group hover:border-[#0056FB]/40 transition-all duration-300">
            <div>
              <span class="text-[10px] text-slate-400 uppercase font-mono tracking-[0.2em] block mb-1">Pistas Totales</span>
              <div class="text-2xl sm:text-3xl font-serif italic text-slate-900">
                {{ stats()?.total_courts ?? 0 }}
              </div>
              <span class="text-[10px] text-slate-500 font-mono mt-0.5 block">Canchas en red</span>
            </div>
            <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-[#0056FB] font-mono text-xs sm:text-sm group-hover:scale-105 transition-transform shadow-xs">
              🎾
            </div>
          </div>

          <div class="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-between group hover:border-[#0056FB]/40 transition-all duration-300">
            <div>
              <span class="text-[10px] text-slate-400 uppercase font-mono tracking-[0.2em] block mb-1">Reservas Totales</span>
              <div class="text-2xl sm:text-3xl font-serif italic text-slate-900">
                {{ stats()?.total_bookings ?? 0 }}
              </div>
              <span class="text-[10px] text-slate-500 font-mono mt-0.5 block">Partidos agendados</span>
            </div>
            <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-[#0056FB] font-mono text-xs sm:text-sm group-hover:scale-105 transition-transform shadow-xs">
              📅
            </div>
          </div>

          <div class="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-between group hover:border-[#0056FB]/40 transition-all duration-300">
            <div>
              <span class="text-[10px] text-slate-400 uppercase font-mono tracking-[0.2em] block mb-1">Usuarios Globales</span>
              <div class="text-2xl sm:text-3xl font-serif italic text-slate-900">
                {{ stats()?.total_users ?? 0 }}
              </div>
              <span class="text-[10px] text-slate-500 font-mono mt-0.5 block">Cuentas activas</span>
            </div>
            <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-[#0056FB] font-mono text-xs sm:text-sm group-hover:scale-105 transition-transform shadow-xs">
              👥
            </div>
          </div>
        </div>

        <!-- Club Management Console -->
        <div class="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <!-- Control Bar -->
          <div class="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <h2 class="font-serif italic text-xl sm:text-2xl text-slate-900">Gestión de Clubes Deportivos</h2>
              <p class="text-xs text-slate-500 font-mono mt-0.5">Crea, edita y configura los parámetros de cada club en la plataforma</p>
            </div>

            <!-- Filters -->
            <div class="flex flex-wrap items-center gap-3">
              <!-- Search box -->
              <div class="relative min-w-[220px]">
                <input
                  type="text"
                  [(ngModel)]="searchQuery"
                  (input)="onSearchChange()"
                  placeholder="Buscar por nombre o slug..."
                  class="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0056FB] transition-colors"
                />
                <span class="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
              </div>

              <!-- Status filter -->
              <select
                [(ngModel)]="selectedStatus"
                (change)="loadClubs()"
                class="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-[#0056FB] transition-colors font-mono"
              >
                <option value="all">Todos los Estados</option>
                <option value="active">Activos</option>
                <option value="trial">En Prueba (Trial)</option>
                <option value="suspended">Suspendidos</option>
              </select>

              <button
                type="button"
                (click)="loadAllData()"
                class="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors shadow-xs"
                title="Recargar datos"
              >
                🔄
              </button>
            </div>
          </div>

          <!-- Table of Clubs -->
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="border-b border-slate-200 bg-slate-50 text-[11px] font-mono uppercase tracking-wider text-slate-600">
                  <th class="py-3.5 px-6">Club / Slug</th>
                  <th class="py-3.5 px-4">Zona / Moneda</th>
                  <th class="py-3.5 px-4 text-center">Pistas</th>
                  <th class="py-3.5 px-4 text-center">Miembros</th>
                  <th class="py-3.5 px-4 text-center">Suscripción</th>
                  <th class="py-3.5 px-4 text-center">Público</th>
                  <th class="py-3.5 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (c of clubs(); track c.id) {
                  <tr class="hover:bg-slate-50/70 transition-colors">
                    <td class="py-4 px-6">
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-serif italic text-xs text-[#0056FB]">
                          {{ c.name.charAt(0) }}
                        </div>
                        <div>
                          <div class="font-semibold text-slate-900 text-sm">{{ c.name }}</div>
                          <div class="font-mono text-[11px] text-[#0056FB]">/c/{{ c.slug }}</div>
                        </div>
                      </div>
                    </td>

                    <td class="py-4 px-4 font-mono text-[11px] text-slate-600">
                      <div>{{ c.timezone }}</div>
                      <div class="text-slate-400 text-[10px]">{{ c.currency }}</div>
                    </td>

                    <td class="py-4 px-4 text-center">
                      <span class="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-slate-100 font-mono text-slate-700 font-medium">
                        {{ c.courts_count }}
                      </span>
                    </td>

                    <td class="py-4 px-4 text-center">
                      <span class="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-slate-100 font-mono text-slate-700 font-medium">
                        {{ c.members_count }}
                      </span>
                    </td>

                    <td class="py-4 px-4 text-center">
                      <span
                        class="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold border"
                        [ngClass]="getSubscriptionBadgeClass(c.subscription_status)"
                      >
                        {{ c.subscription_status }}
                      </span>
                    </td>

                    <td class="py-4 px-4 text-center">
                      <button
                        type="button"
                        (click)="togglePublished(c)"
                        class="px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider font-medium border transition-colors"
                        [ngClass]="c.is_published ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'"
                      >
                        {{ c.is_published ? 'Publicado' : 'Oculto' }}
                      </button>
                    </td>

                    <td class="py-4 px-6 text-right">
                      <div class="flex items-center justify-end gap-2">
                        <a
                          [routerLink]="['/c', c.slug]"
                          target="_blank"
                          class="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                          title="Abrir reserva pública"
                        >
                          👁
                        </a>
                        <button
                          type="button"
                          (click)="openMemberModal(c)"
                          class="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                          title="Gestionar Administradores / Staff"
                        >
                          👥
                        </button>
                        <button
                          type="button"
                          (click)="openEditModal(c)"
                          class="px-3 py-1.5 rounded-lg bg-[#0056FB]/10 hover:bg-[#0056FB]/20 border border-[#0056FB]/20 text-[#0056FB] font-mono text-[11px] font-medium transition-colors"
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="py-12 text-center text-slate-400 font-mono text-xs">
                      No se encontraron clubes registrados con los criterios seleccionados.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <!-- ============================================================= -->
      <!-- MODAL: CREAR CLUB                                             -->
      <!-- ============================================================= -->
      @if (showCreateModal()) {
        <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-xl p-7 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 font-sans text-slate-900 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span class="text-[10px] uppercase tracking-[0.2em] text-[#0056FB] font-mono font-semibold block">Alta de Tenant</span>
                <h3 class="font-serif italic text-2xl text-slate-900">Crear Nuevo Club Deportivo</h3>
              </div>
              <button
                type="button"
                (click)="showCreateModal.set(false)"
                class="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:border-slate-400 transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            <form (ngSubmit)="submitCreateClub()" class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Nombre del Club *</label>
                  <input
                    type="text"
                    required
                    [(ngModel)]="createForm.name"
                    (input)="onNameChange()"
                    name="name"
                    placeholder="Ej: Club Raqueta Real"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  />
                </div>

                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Slug URL (/c/...) *</label>
                  <input
                    type="text"
                    required
                    [(ngModel)]="createForm.slug"
                    name="slug"
                    placeholder="raqueta-real"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Zona Horaria</label>
                  <input
                    type="text"
                    [(ngModel)]="createForm.timezone"
                    name="timezone"
                    placeholder="America/Bogota"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  />
                </div>

                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Moneda</label>
                  <select
                    [(ngModel)]="createForm.currency"
                    name="currency"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors font-mono"
                  >
                    <option value="COP">COP (Pesos Colombianos)</option>
                    <option value="USD">USD (Dólares)</option>
                    <option value="EUR">EUR (Euros)</option>
                    <option value="MXN">MXN (Pesos Mexicanos)</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Teléfono / WhatsApp</label>
                  <input
                    type="tel"
                    [(ngModel)]="createForm.phone"
                    name="phone"
                    placeholder="+57 300 123 4567"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  />
                </div>

                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Correo de Contacto</label>
                  <input
                    type="email"
                    [(ngModel)]="createForm.email"
                    name="email"
                    placeholder="contacto@club.com"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Dirección Física</label>
                <input
                  type="text"
                  [(ngModel)]="createForm.address"
                  name="address"
                  placeholder="Calle 100 # 15-20, Bogotá"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                />
              </div>

              <div class="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-2">
                <label class="block text-[11px] font-mono uppercase tracking-wider text-[#0056FB] font-semibold">
                  Asignar Administrador Inicial (Opcional)
                </label>
                <input
                  type="email"
                  [(ngModel)]="createForm.admin_user_email"
                  name="admin_user_email"
                  placeholder="admin@canchariane.com"
                  class="w-full px-4 py-2.5 rounded-xl bg-white border border-blue-200 text-slate-900 placeholder-slate-400 text-sm font-mono focus:outline-none focus:border-[#0056FB] transition-colors"
                />
                <p class="text-[11px] text-slate-500 font-sans">
                  Si especificas un correo de usuario existente, se le otorgará de inmediato el rol 'admin' sobre este club.
                </p>
              </div>

              <div class="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  (click)="showCreateModal.set(false)"
                  class="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-mono uppercase tracking-wider hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  [disabled]="isSubmitting() || !createForm.name || !createForm.slug"
                  class="flex-1 py-3 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] disabled:opacity-40 text-white font-medium text-xs font-mono uppercase tracking-wider transition-all duration-300 shadow-md"
                >
                  {{ isSubmitting() ? 'Creando Club...' : 'Crear Club Tenant' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- ============================================================= -->
      <!-- MODAL: EDITAR CLUB                                            -->
      <!-- ============================================================= -->
      @if (editingClub()) {
        <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-lg p-7 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 font-sans text-slate-900">
            <div class="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span class="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono block">Editar Tenant</span>
                <h3 class="font-serif italic text-2xl text-slate-900">{{ editingClub()?.name }}</h3>
              </div>
              <button
                type="button"
                (click)="editingClub.set(null)"
                class="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:border-slate-400 transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            <form (ngSubmit)="submitEditClub()" class="space-y-4">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Nombre</label>
                  <input
                    type="text"
                    required
                    [(ngModel)]="editForm.name"
                    name="editName"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  />
                </div>

                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Slug URL</label>
                  <input
                    type="text"
                    required
                    [(ngModel)]="editForm.slug"
                    name="editSlug"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Estado Suscripción</label>
                  <select
                    [(ngModel)]="editForm.subscription_status"
                    name="editSub"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  >
                    <option value="active">Activo (Active)</option>
                    <option value="trial">En Prueba (Trial)</option>
                    <option value="suspended">Suspendido</option>
                  </select>
                </div>

                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Zona Horaria</label>
                  <input
                    type="text"
                    [(ngModel)]="editForm.timezone"
                    name="editTimezone"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Teléfono</label>
                  <input
                    type="tel"
                    [(ngModel)]="editForm.phone"
                    name="editPhone"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  />
                </div>

                <div>
                  <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Correo</label>
                  <input
                    type="email"
                    [(ngModel)]="editForm.email"
                    name="editEmail"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Dirección</label>
                <input
                  type="text"
                  [(ngModel)]="editForm.address"
                  name="editAddress"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                />
              </div>

              <div class="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="editPublished"
                  [(ngModel)]="editForm.is_published"
                  name="editPublished"
                  class="w-4 h-4 rounded text-[#0056FB] focus:ring-[#0056FB]"
                />
                <label for="editPublished" class="text-xs font-mono text-slate-700">
                  Visible en catálogo público y reservas abiertas
                </label>
              </div>

              <div class="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  (click)="editingClub.set(null)"
                  class="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-mono uppercase tracking-wider hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  [disabled]="isSubmitting()"
                  class="flex-1 py-3 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] text-white font-medium text-xs font-mono uppercase tracking-wider transition-all duration-300 shadow-md"
                >
                  {{ isSubmitting() ? 'Guardando...' : 'Guardar Cambios' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- ============================================================= -->
      <!-- MODAL: ASIGNAR ADMINISTRADOR / STAFF                          -->
      <!-- ============================================================= -->
      @if (managingMemberClub()) {
        <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-md p-7 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 font-sans text-slate-900">
            <div class="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span class="text-[10px] uppercase tracking-[0.2em] text-[#0056FB] font-mono font-semibold block">Membresías & Roles</span>
                <h3 class="font-serif italic text-2xl text-slate-900">{{ managingMemberClub()?.name }}</h3>
              </div>
              <button
                type="button"
                (click)="managingMemberClub.set(null)"
                class="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:border-slate-400 transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            <form (ngSubmit)="submitAssignMember()" class="space-y-4">
              <div>
                <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Correo del Usuario *</label>
                <input
                  type="email"
                  required
                  [(ngModel)]="memberForm.email"
                  name="memberEmail"
                  placeholder="ej: staff@canchariane.com"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm font-mono focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors"
                />
              </div>

              <div>
                <label class="block text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Rol en este Club</label>
                <select
                  [(ngModel)]="memberForm.role"
                  name="memberRole"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-[#0056FB] transition-colors font-mono"
                >
                  <option value="admin">Administrador (Control total del club)</option>
                  <option value="staff">Staff / Recepcionista (Operación diaria)</option>
                </select>
              </div>

              <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 font-sans">
                💡 Nota: El usuario debe estar previamente registrado en la base de datos.
              </div>

              <div class="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  (click)="managingMemberClub.set(null)"
                  class="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-mono uppercase tracking-wider hover:bg-slate-100 transition-colors"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  [disabled]="isSubmitting() || !memberForm.email"
                  class="flex-1 py-3 rounded-xl bg-[#0056FB] hover:bg-[#0048d6] disabled:opacity-40 text-white font-medium text-xs font-mono uppercase tracking-wider transition-all duration-300 shadow-md"
                >
                  {{ isSubmitting() ? 'Asignando...' : 'Asignar Membresía' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class SuperadminDashboardComponent implements OnInit {
  readonly authStore = inject(AuthStore);
  private readonly superadminService = inject(SuperadminService);
  private readonly router = inject(Router);

  readonly stats = signal<SuperadminStats | null>(null);
  readonly clubs = signal<SuperadminClub[]>([]);
  readonly feedbackMessage = signal<string | null>(null);

  readonly showCreateModal = signal<boolean>(false);
  readonly editingClub = signal<SuperadminClub | null>(null);
  readonly managingMemberClub = signal<SuperadminClub | null>(null);
  readonly isSubmitting = signal<boolean>(false);

  searchQuery = '';
  selectedStatus = 'all';

  // Create form state
  createForm: SuperadminClubCreate = {
    name: '',
    slug: '',
    timezone: 'America/Bogota',
    currency: 'COP',
    subscription_status: 'active',
    is_published: true,
    address: '',
    phone: '',
    email: '',
    admin_user_email: 'admin@canchariane.com'
  };

  // Edit form state
  editForm: SuperadminClubUpdate = {
    name: '',
    slug: '',
    timezone: 'America/Bogota',
    subscription_status: 'active',
    is_published: true,
    address: '',
    phone: '',
    email: ''
  };

  // Member assignment form
  memberForm = {
    email: '',
    role: 'admin'
  };

  ngOnInit(): void {
    this.loadAllData();
  }

  loadAllData(): void {
    this.loadStats();
    this.loadClubs();
  }

  loadStats(): void {
    this.superadminService.getStats().subscribe({
      next: (s) => this.stats.set(s),
      error: (e) => console.error('Error fetching superadmin stats', e)
    });
  }

  loadClubs(): void {
    this.superadminService.getClubs(this.searchQuery, this.selectedStatus).subscribe({
      next: (list) => this.clubs.set(list),
      error: (e) => console.error('Error fetching clubs', e)
    });
  }

  onSearchChange(): void {
    this.loadClubs();
  }

  onNameChange(): void {
    if (!this.createForm.slug || this.createForm.slug === this.slugify(this.createForm.name.slice(0, -1))) {
      this.createForm.slug = this.slugify(this.createForm.name);
    }
  }

  slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  openCreateModal(): void {
    this.createForm = {
      name: '',
      slug: '',
      timezone: 'America/Bogota',
      currency: 'COP',
      subscription_status: 'active',
      is_published: true,
      address: '',
      phone: '',
      email: '',
      admin_user_email: 'admin@canchariane.com'
    };
    this.showCreateModal.set(true);
  }

  submitCreateClub(): void {
    if (!this.createForm.name || !this.createForm.slug) return;
    this.isSubmitting.set(true);

    this.superadminService.createClub(this.createForm).subscribe({
      next: (created) => {
        this.isSubmitting.set(false);
        this.showCreateModal.set(false);
        this.feedbackMessage.set(`Club '${created.name}' creado exitosamente con slug /c/${created.slug}.`);
        this.loadAllData();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        alert(err.error?.detail || 'Error al crear el club');
      }
    });
  }

  openEditModal(club: SuperadminClub): void {
    this.editingClub.set(club);
    this.editForm = {
      name: club.name,
      slug: club.slug,
      timezone: club.timezone,
      subscription_status: club.subscription_status,
      is_published: club.is_published,
      address: club.address ?? '',
      phone: club.phone ?? '',
      email: club.email ?? ''
    };
  }

  submitEditClub(): void {
    const club = this.editingClub();
    if (!club) return;
    this.isSubmitting.set(true);

    this.superadminService.updateClub(club.id, this.editForm).subscribe({
      next: (updated) => {
        this.isSubmitting.set(false);
        this.editingClub.set(null);
        this.feedbackMessage.set(`Club '${updated.name}' actualizado correctamente.`);
        this.loadAllData();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        alert(err.error?.detail || 'Error al actualizar el club');
      }
    });
  }

  togglePublished(club: SuperadminClub): void {
    this.superadminService.updateClub(club.id, { is_published: !club.is_published }).subscribe({
      next: () => {
        this.loadClubs();
        this.loadStats();
      },
      error: (err) => alert(err.error?.detail || 'Error al alternar publicación')
    });
  }

  openMemberModal(club: SuperadminClub): void {
    this.managingMemberClub.set(club);
    this.memberForm = {
      email: '',
      role: 'admin'
    };
  }

  submitAssignMember(): void {
    const club = this.managingMemberClub();
    if (!club || !this.memberForm.email) return;
    this.isSubmitting.set(true);

    this.superadminService.addMember(club.id, this.memberForm.email.trim(), this.memberForm.role).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.managingMemberClub.set(null);
        this.feedbackMessage.set(
          `Rol '${res.role}' asignado exitosamente a ${res.user_email} en ${club.name}.`
        );
        this.loadClubs();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        alert(err.error?.detail || 'Error al asignar la membresía');
      }
    });
  }

  getSubscriptionBadgeClass(status: string): string {
    switch (status) {
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'trial':
        return 'bg-blue-50 text-[#0056FB] border-blue-200';
      case 'suspended':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  }

  logout(): void {
    this.authStore.clearSession();
    this.router.navigate(['/auth/login']);
  }
}
