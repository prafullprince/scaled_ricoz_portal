export type TaskPerson = { _id: string; name: string; email: string; roles?: string[] };
export interface WorkspaceTask {
  _id: string;
  title: string;
  description: string;
  deadline: string;
  status: 'PENDING' | 'DONE';
  effectiveStatus: 'PENDING' | 'DONE' | 'DELAYED';
  workflowStage?: string;
  completedAt?: string | null;
  createdAt?: string;
  department?: string | null;
  parentTaskId?: string | null;
  projectObjective?: string;
  recommendedStack?: string[];
  requirements?: string[];
  finalDeliverables?: string[];
  learningResources?: string[];
  currentOwner?: TaskPerson | string | null;
  assignedTo?: TaskPerson | string | null;
  productId?: { _id: string; title: string; deletedAt?: string | null } | string | null;
  workflowHistory?: { action: string; note?: string; createdAt: string }[];
  submission?: { description: string; githubUrl?: string; liveUrl?: string; submittedAt: string } | null;
}
export interface DailyTaskReport { _id: string; taskId: string; userId: string; reportDate: string; summary: string; progress: number }
export interface TaskSummary { total: number; pending: number; done: number; delayed: number; onTime: number }
export interface PersonalTaskReport { summary: TaskSummary; tasks: WorkspaceTask[]; dailyReports?: DailyTaskReport[] }
export interface TeamTaskReport {
  report: { user: TaskPerson; summary: TaskSummary; tasks: WorkspaceTask[]; dailyReports?: DailyTaskReport[] }[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}
export type ReportStatus = 'ALL' | 'PENDING' | 'DONE' | 'DELAYED' | 'ON_TIME';
export const taskColumns = ['Assigned', 'Enhancement', 'Submitted', 'Accepted'] as const;

export function latestEnhancement(task: WorkspaceTask) {
  return [...task.workflowHistory ?? []].reverse().find((event) => event.action === 'ENHANCEMENT_REQUESTED');
}
export function taskColumn(task: WorkspaceTask) {
  if (task.workflowStage === 'COMPLETED') return 'Accepted';
  if (task.workflowStage === 'SUBMITTED') return 'Submitted';
  if (task.status === 'PENDING' && task.workflowStage === 'ASSIGNED') return latestEnhancement(task) ? 'Enhancement' : 'Assigned';
  return null;
}
export function reportTaskMatches(task: WorkspaceTask, status: ReportStatus) {
  return status === 'ALL' || task.effectiveStatus === status || (status === 'ON_TIME' && task.effectiveStatus === 'DONE' && Boolean(task.completedAt) && Date.parse(task.completedAt!) <= Date.parse(task.deadline));
}
export function contributionDays(reports: DailyTaskReport[], today = new Date()) {
  const byDate = new Map<string, DailyTaskReport[]>();
  for (const report of reports) {
    const date = report.reportDate.slice(0, 10);
    byDate.set(date, [...byDate.get(date) ?? [], report]);
  }
  return Array.from({ length: 84 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (83 - index));
    const key = date.toISOString().slice(0, 10);
    const entries = byDate.get(key) ?? [];
    const progress = entries.length ? Math.max(...entries.map((report) => report.progress)) : 0;
    return { date: key, entries, progress, tone: !entries.length ? 0 : progress >= 80 ? 3 : progress >= 40 ? 2 : 1 };
  });
}