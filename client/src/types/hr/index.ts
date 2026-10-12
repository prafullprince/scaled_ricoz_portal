export type HrTask = { _id: string; title: string; description: string; deadline: string; priority?: string; status: "PENDING" | "DONE"; workflowStage?: string; effectiveStatus: "PENDING" | "DONE" | "OVERDUE" };
export type HrEmployee = { id: string; name: string; email: string; role: string; department: string | null; employmentType: string; joiningDate: string; status: string };
export type HrLeaveRequest = { id: string; employee: { id: string; name: string; email: string } | null; type: string; startDate: string; endDate: string; days: number; reason: string; status: "PENDING" | "APPROVED" | "REJECTED"; createdAt: string };
export type HrDashboardData = {
  generatedAt: string;
  metrics: { totalEmployees: number; presentToday: number; attendanceRate: number; pendingLeaveRequests: number; openPositions: number };
  attendanceTrend: Array<{ date: string; present: number }>;
  departmentHeadcount: Array<{ department: string; count: number }>;
  employees: HrEmployee[];
  leaveRequests: HrLeaveRequest[];
  tasks: HrTask[];
};