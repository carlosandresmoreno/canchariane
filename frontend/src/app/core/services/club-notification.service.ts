import { Injectable, signal, computed } from '@angular/core';

export interface ClubNotification {
  id: string;
  clubId: string;
  bookingId?: string;
  type: 'booking_public' | 'booking_staff' | 'booking_admin' | 'booking_cancelled' | 'block_created';
  title: string;
  message: string;
  customerName?: string;
  courtName?: string;
  timeStr?: string;
  timestamp: string; // ISO string
  read: boolean;
  origin?: 'public' | 'admin' | 'staff' | string;
}

@Injectable({
  providedIn: 'root'
})
export class ClubNotificationService {
  private currentClubId = signal<string>('');
  readonly notifications = signal<ClubNotification[]>([]);

  readonly unreadCount = computed(() => {
    return this.notifications().filter((n) => !n.read).length;
  });

  readonly unreadWebCount = computed(() => {
    return this.notifications().filter((n) => !n.read && (n.origin === 'public' || n.type === 'booking_public')).length;
  });

  loadNotifications(clubId: string): void {
    if (!clubId) return;
    this.currentClubId.set(clubId);

    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(`canchariane_notifs_${clubId}`);
        if (stored) {
          const parsed: ClubNotification[] = JSON.parse(stored);
          this.notifications.set(parsed);
          return;
        }
      } catch (e) {
        console.warn('Error reading notifications from localStorage', e);
      }
    }
    this.notifications.set([]);
  }

  addNotification(item: Omit<ClubNotification, 'id' | 'timestamp' | 'read' | 'clubId'>): ClubNotification {
    const clubId = this.currentClubId();
    const newNotif: ClubNotification = {
      ...item,
      id: 'notif-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now(),
      clubId,
      timestamp: new Date().toISOString(),
      read: false
    };

    const updated = [newNotif, ...this.notifications()].slice(0, 40);
    this.notifications.set(updated);
    this.persist(clubId, updated);
    return newNotif;
  }

  markAsRead(id: string): void {
    const updated = this.notifications().map((n) => (n.id === id ? { ...n, read: true } : n));
    this.notifications.set(updated);
    this.persist(this.currentClubId(), updated);
  }

  markAllAsRead(): void {
    const updated = this.notifications().map((n) => ({ ...n, read: true }));
    this.notifications.set(updated);
    this.persist(this.currentClubId(), updated);
  }

  clearAll(): void {
    this.notifications.set([]);
    this.persist(this.currentClubId(), []);
  }

  private persist(clubId: string, list: ClubNotification[]): void {
    if (!clubId || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(`canchariane_notifs_${clubId}`, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save notifications to localStorage', e);
    }
  }

  formatTimeAgo(isoStr: string): string {
    if (!isoStr) return '';
    try {
      const now = Date.now();
      const past = new Date(isoStr).getTime();
      const diffSec = Math.floor((now - past) / 1000);

      if (diffSec < 45) return 'Hace un momento';
      if (diffSec < 90) return 'Hace 1 minuto';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `Hace ${diffMin} min`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `Hace ${diffHours} h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Ayer';
      if (diffDays < 7) return `Hace ${diffDays} días`;

      return new Date(isoStr).toLocaleDateString('es-CO', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  }
}

