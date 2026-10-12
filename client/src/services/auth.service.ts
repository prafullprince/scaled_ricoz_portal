import axios from "axios";
import api from "./axios";
import { ChangePasswordInput, LoginInput, RegisterInput, UpdateProfileInput } from "./types/auth.types";
import { setActiveCompanyId } from "@/lib/company";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error) && error.response?.data?.message) {
    return error.response.data.message as string;
  }
  return fallback;
};

export const AuthService = {
  requestPasswordReset: async (email: string) => {
    try {
      const result = await api.post("/auth/forgot-password", { email });
      return result.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, "Unable to request a password reset."));
    }
  },

  resetPassword: async (input: { email: string; otp: string; newPassword: string }) => {
    try {
      const result = await api.post("/auth/reset-password", input);
      return result.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, "Unable to reset your password."));
    }
  },

  // send_otp
  sendOtp: async (email: string) => {
    try {
      const result = await api.post("/auth/send_otp", { email });
      if (!result) {
        return;
      }
      return result.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, "Something went wrong. Please try again."));
    }
  },

  // signup
  signup: async (registerInput: RegisterInput) => {
    try {
        const result = await api.post("/auth/signup", registerInput);
        if(!result) {
            return;
        }

        return result.data;
    } catch (error) {
        throw new Error(getErrorMessage(error, "Something went wrong. Please try again."));
    }
  },

  // login
  login: async (loginInput: LoginInput) => {
    try {
      const result = await api.post("/auth/login", loginInput);
      if(!result) return;

      return result.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, "Something went wrong. Please try again."));
    }
  },

  currentUser: async () => {
    try {
      const result = await api.get("/auth/me");
      return result.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, "Unable to load your account."));
    }
  },

  logout: async () => {
    await api.post("/auth/logout");
    setActiveCompanyId(null);
  },

  logoutAll: async () => {
    await api.post("/auth/logout-all");
    setActiveCompanyId(null);
  },

  updateProfile: async (input: UpdateProfileInput) => {
    try {
      const result = await api.patch("/auth/profile", input);
      return result.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, "Something went wrong. Please try again."));
    }
  },

  changePassword: async (input: ChangePasswordInput) => {
    try {
      const result = await api.post("/auth/change-password", input);
      return result.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, "Something went wrong. Please try again."));
    }
  },

  listSessions: async () => {
    try {
      const result = await api.get("/auth/sessions");
      return result.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, "Unable to load your sessions."));
    }
  },

  revokeSession: async (id: string) => {
    try {
      const result = await api.delete(`/auth/sessions/${id}`);
      return result.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, "Unable to revoke that session."));
    }
  },

  // refresh
  refresh: async () => {
    try {
      const result = await api.post("/auth/refresh");
      if(!result) {
        return;
      }

      return result.data;
    } catch (error) {
      console.log(error);
      if(axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data.message);
      }
      return;
    }
  },
};
