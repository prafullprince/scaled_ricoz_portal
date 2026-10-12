import type { HrDashboardData } from "@/types/hr";
import api from "./axios";

export const HrService = {
  async managedCompanies() {
    return (await api.get<{ companies: Array<{ id: string; name: string; slug: string; description: string; industry: string }>; assignedCompanyCount: number; maxCompanies: number }>("/hr/companies")).data;
  },
  async dashboard() {
    const response = await api.get<{ success: true; dashboard: HrDashboardData }>("/hr/dashboard");
    return response.data.dashboard;
  },
  async reviewLeave(requestId: string, decision: "APPROVED" | "REJECTED") {
    const response = await api.patch(`/hr/leave/${requestId}`, { decision });
    return response.data.leave;
  },
  async aiReport(prompt: string) {
    const response = await api.post<{ success: true; report: string; generatedBy: string }>("/hr/ai-report", { prompt });
    return response.data;
  },
};