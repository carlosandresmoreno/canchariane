export interface Membership {
  club_id: string;
  role: 'owner' | 'admin' | 'staff';
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  is_superadmin: boolean;
  memberships: Membership[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}
