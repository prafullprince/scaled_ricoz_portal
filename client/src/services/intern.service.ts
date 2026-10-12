import axios from "axios";
import api from "./axios";
import type { JobRole } from "@/lib/jobRoles";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error) && error.response?.data?.message) {
    return error.response.data.message as string;
  }
  return fallback;
};

export interface RoleInfo {
  initialRole: string | null;
  currentRole: string | null;
}


export const InternService = {
  getMyRole: async (): Promise<RoleInfo> => {
    try {
      const result = await api.get("/intern/role");
      return result.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, "Unable to load your role."));
    }
  },

  updateMyRole: async (currentRole: JobRole): Promise<RoleInfo> => {
    try {
      const result = await api.patch("/intern/role", { currentRole });
      return result.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, "Unable to update your role."));
    }
  },
};
