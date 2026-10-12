import { ISignupData } from "@/types/auth/auth.types";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type AuthStatus = "checking" | "authenticated" | "unauthenticated";

export interface IUser {
  user_name: string;
  user_email: string;
  user_about: string;
  user_dp: string;
  user_id: string;
  roles: string[];
  permissions?: string[];
  system_roles?: string[];
  status: string;
  phone_number?: string | null;
  email_verified_at?: string | null;
  created_at?: string;
  organization_level?: string | null;
  organization_department?: string | null;
  organization_designation?: string | null;
  employment_type?: "EMPLOYEE" | "INTERN" | null;
  organization_title?: string | null;
  company?: { id: string; name: string; slug: string; is_default: boolean };
  can_switch_company?: boolean;
  can_create_company?: boolean;
  can_view_company_admin_pages?: boolean;
}
interface AuthState {
  signupData: ISignupData | null;
  loading: boolean;
  access_token: string | null;
  user: IUser | null;
  status: AuthStatus;
}

// initial_state
const initialState: AuthState = {
  signupData: null,
  loading: false,
  access_token: null,
  user: null,
  status: "checking",
};

type AuthSession = {
  accessToken: string;
  user: IUser;
};

// auth_slice
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setSignupData(state, action: PayloadAction<ISignupData>) {
      state.signupData = action.payload;
    },
    clearSignupData(state) {
      state.signupData = null;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setSession(state, action: PayloadAction<AuthSession>) {
      state.access_token = action.payload.accessToken;
      state.user = action.payload.user;
      state.status = "authenticated";
    },
    setAccessToken(state, action: PayloadAction<string>) {
      state.access_token = action.payload;
      state.status = "authenticated";
    },
    setUser(state, action: PayloadAction<IUser>) {
      state.user = action.payload;
    },
    clearAuth(state) {
      state.access_token = null;
      state.user = null;
      state.status = "unauthenticated";
    },
    finishAuthCheckUnauthenticated(state) {
      if (state.status === "checking") {
        state.status = "unauthenticated";
      }
    },
  },
});

// export
export const { setSignupData, clearSignupData, setLoading, setSession, setAccessToken, setUser, clearAuth, finishAuthCheckUnauthenticated } =
  authSlice.actions;
export default authSlice.reducer;
