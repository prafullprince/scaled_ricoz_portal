import api from "./axios";

export type RoleDashboard = {
  profile: { designation: string | null; department: string | null };
  stats: { activeProjects: number | null; tasksDueToday: number; urgentTasks: number; leaveRemaining: number | null; trainingProgress: number | null };
  tasks: Array<{ id: string; title: string; description: string; deadline: string; status: "PENDING" | "DONE"; progress: number }>;
  completedTasks: number;
  leaveBalances: { earned: number; earnedTotal: number; sick: number; sickTotal: number; casual: number; casualTotal: number } | null;
  trainingModules: Array<{ title: string; progress: number; status: "Completed" | "In Progress" }>;
  schedule: Array<{ title: string; time: string; duration: string; tone: "blue" | "red" | "green" | "yellow" }>;
  productivity: number[];
};

export const RoleDashboardService = {
  async get(area: "employee" | "intern") {
    const response = await api.get<{ dashboard: RoleDashboard }>(`/${area}/dashboard`);
    return response.data.dashboard;
  },
};
