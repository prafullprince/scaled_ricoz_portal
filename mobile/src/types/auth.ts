export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

export interface User {
  user_id: string;
  user_name: string;
  user_email: string;
  user_dp: string;
  user_about: string;
  roles: string[];
  permissions?: string[];
  system_roles?: string[];
  status: string;
  company?: { _id?: string; name: string } | null;
  phone_number?: string | null;
  email_verified_at?: string | null;
  created_at?: string;
  organization_level?: string | null;
  organization_department?: string | null;
  organization_designation?: string | null;
  employment_type?: 'EMPLOYEE' | 'INTERN' | null;
  organization_title?: string | null;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  access_token: string;
  refresh_token?: string;
  user: User;
}

export interface SignupPendingResponse {
  success: boolean;
  message: string;
  onboardingPending: true;
}

export type SignupResponse = AuthResponse | SignupPendingResponse;

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
  otp: string;
  confirmPassword: string;
}