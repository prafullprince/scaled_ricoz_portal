import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AuthStatus, User } from '@/types/auth';

interface AuthState {
  accessToken: string | null;
  user: User | null;
  status: AuthStatus;
}

const initialState: AuthState = {
  accessToken: null,
  user: null,
  status: 'checking',
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<{ accessToken: string; user: User }>) {
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user;
      state.status = 'authenticated';
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
    clearSession(state) {
      state.accessToken = null;
      state.user = null;
      state.status = 'unauthenticated';
    },
  },
});

export const { clearSession, setSession, setUser } = authSlice.actions;
export default authSlice.reducer;