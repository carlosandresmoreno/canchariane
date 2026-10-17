export interface PublicClub {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency?: string;
  address?: string | null;
  phone?: string | null;
  logo_url?: string | null;
  courts: PublicCourt[];
  allowed_durations?: number[];
  default_duration?: number;
  slot_step_minutes?: number | null;
}

export interface PublicCourt {
  id: string;
  name: string;
  sport: string;
  surface: string;
  player_format: string;
  is_covered: boolean;
  has_lighting: boolean;
  price_per_hour_cents?: number;
}

export interface PublicSlot {
  court_id: string;
  court_name: string;
  period_start_utc: string; // ISO UTC
  period_end_utc: string;   // ISO UTC
  local_start: string;      // "14:00"
  local_end: string;        // "15:30"
  start_time: string;       // ISO UTC
  end_time: string;         // ISO UTC
  local_start_time: string; // "14:00"
  local_end_time: string;   // "15:30"
  duration_minutes: number;
  price_cents: number;
  hourly_rate_cents?: number;
  currency: string;
  is_available: boolean;
}

export interface PublicAvailabilityResponse {
  date: string;
  club_timezone: string;
  slots: PublicSlot[];
}

export interface CreateHoldRequest {
  court_id: string;
  start_time: string; // ISO
  duration_minutes: number;
}

export interface CreateHoldResponse {
  hold_id: string;
  court_id: string;
  start_time: string;
  end_time: string;
  expires_at: string;
  expires_in_seconds: number;
  price_cents: number;
  currency: string;
}

export interface ConfirmBookingRequest {
  hold_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  notes?: string;
}

export interface PublicBookingResponse {
  id: string;
  code: string;
  club_name: string;
  court_name: string;
  start_time: string;
  end_time: string;
  price_cents: number;
  currency: string;
  status: string;
  payment_status: string;
  customer_name: string;
  created_at: string;
}

export interface RectShape {
  kind: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
}

export interface PolygonShape {
  kind: 'polygon';
  points: [number, number][];
}

export type Shape = RectShape | PolygonShape;

export interface CourtLayoutItem {
  court_id: string;
  label?: string | null;
  shape: Shape;
}

export interface DecorationItem {
  id?: string;
  type?: string;
  label?: string | null;
  icon?: string | null;
  shape?: any;
  x?: number;
  y?: number;
  w?: number | null;
  h?: number | null;
  rotation?: number;
}

export interface PublicClubLayout {
  club_id: string;
  name: string;
  view_box_w: number;
  view_box_h: number;
  courts: CourtLayoutItem[];
  decorations: DecorationItem[];
}
