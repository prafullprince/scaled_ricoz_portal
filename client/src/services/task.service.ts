import api from "./axios";
import type { TaskPriorityValue } from "@/lib/task-priority";

export type TaskEffectiveStatus = "PENDING" | "DONE" | "DELAYED";
export type TaskWorkflowStage =
  | "ADMIN_REVIEW"
  | "HEAD_PLANNING"
  | "MANAGER_PLANNING"
  | "DELEGATED"
  | "ASSIGNED"
  | "SUBMITTED"
  | "MANAGER_REVIEW"
  | "HEAD_REVIEW"
  | "ADMIN_FINAL_REVIEW"
  | "CEO_REVIEW"
  | "COMPLETED";
export type TaskPerson = {
  _id: string;
  name: string;
  email: string;
  roles?: string[];
};
export type TaskWorkflowEvent = {
  action: string;
  actorId: TaskPerson | string;
  recipientId?: TaskPerson | string | null;
  note?: string;
  createdAt: string;
};
export type TaskSubmission = {
  description: string;
  githubUrl?: string;
  liveUrl?: string;
  submittedAt: string;
};
export type Task = {
  _id: string;
  title: string;
  description: string;
  projectObjective?: string;
  recommendedStack?: string[];
  requirements?: string[];
  finalDeliverables?: string[];
  learningResources?: string[];
  deadline: string;
  priority?: TaskPriorityValue;
  assignedTo: TaskPerson | string | null;
  assignedBy?: TaskPerson | string;
  createdBy?: TaskPerson | string;
  currentOwner?: TaskPerson | string | null;
  parentTaskId?: string | null;
  productId?: string | { _id: string; title: string; deletedAt?: string | null } | null;
  collaborationBatchId?: string | null;
  collaborationConversationId?: string | null;
  department?: string | null;
  workflowStage?: TaskWorkflowStage;
  workflowHistory?: TaskWorkflowEvent[];
  submission?: TaskSubmission | null;
  status: "PENDING" | "DONE";
  effectiveStatus: TaskEffectiveStatus;
  completedAt?: string | null;
  createdAt: string;
};

export type Assignee = {
  _id: string;
  name: string;
  email: string;
  roles: string[];
  initialRole?: string | null;
  currentRole?: string | null;
  activeTaskCount: number;
  totalTaskCount: number;
  completedTaskCount: number;
  currentTask: { _id: string; title: string; deadline: string } | null;
  available: boolean;
};
export type TaskSummary = {
  total: number;
  pending: number;
  done: number;
  delayed: number;
  onTime: number;
};
export type DailyReport = {
  _id: string;
  taskId: string;
  userId: string;
  reportDate: string;
  summary: string;
  progress: number;
};
export type WorkflowCandidate = TaskPerson & {
  department: string;
  level: string;
};
export type WorkflowCandidateOptions = {
  candidates: WorkflowCandidate[];
  seniorCandidates: WorkflowCandidate[];
};
export type WorkflowSubtaskInput = {
  title: string;
  description: string;
  deadline: string;
  assignedToIds: string[];
  priority: TaskPriorityValue;
  recommendedStack?: string[];
  requirements?: string[];
  finalDeliverables?: string[];
  learningResources?: string[];
};
export type HierarchyPerformance = {
  key: string;
  label: string;
  subtitle: string;
  total: number;
  delivered: number;
  accepted: number;
  overdue: number;
  completionRate: number;
  onTimeRate: number;
  score: number;
  profileUserId: string | null;
};
export type HierarchyProgressWorkItem = {
  taskId: string;
  title: string;
  assignee: TaskPerson | null;
  progress: number;
  report: {
    summary: string;
    progress: number;
    reportDate: string;
    updatedAt: string;
  };
  stage: TaskWorkflowStage;
  submitted: boolean;
  accepted: boolean;
};
export type PersonalTodoStatus = "OPEN" | "COMPLETED" | "DELETED";
export type PersonalTodoAction = "CREATED" | "EDITED" | "COMPLETED" | "DELETED";
export type PersonalTodoHistoryEvent = {
    action: PersonalTodoAction;
    actorId: string;
    title: string;
    description: string;
    deadline: string;
    createdAt: string;
};
export type PersonalTodo = {
    id: string;
    title: string;
    description: string;
    deadline: string;
    status: PersonalTodoStatus;
    completedAt: string | null;
    deletedAt: string | null;
    createdAt: string;
    updatedAt: string;
    history: PersonalTodoHistoryEvent[];
};
export type PersonalTodoHistoryPage = {
    todos: PersonalTodo[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
};
export type HierarchyProgressPackage = {
  taskId: string;
  title: string;
  department: string | null;
  stage: TaskWorkflowStage;
  deadline: string;
  progress: number;
  totalWorkItems: number;
  reportedWorkItems: number;
  submittedWorkItems: number;
  acceptedWorkItems: number;
  workItems: HierarchyProgressWorkItem[];
};

export const TaskService = {
  async myTodos() {
    return (await api.get<{ todos: PersonalTodo[] }>("/tasks/todos")).data.todos;
  },
  async myTodoHistory(page = 1, pageSize = 10) {
    return (await api.get<PersonalTodoHistoryPage>("/tasks/todos/history", {
      params: { page, pageSize },
    })).data;
  },
  async createMyTodo(input: { title: string; description: string; deadline: string }) {
    return (await api.post<{ todo: PersonalTodo }>("/tasks/todos", input)).data.todo;
  },
  async updateMyTodo(todoId: string, input: { title: string; description: string; deadline: string }) {
    return (await api.patch<{ todo: PersonalTodo }>(`/tasks/todos/${encodeURIComponent(todoId)}`, input)).data.todo;
  },
  async completeMyTodo(todoId: string) {
    return (await api.post<{ todo: PersonalTodo }>(`/tasks/todos/${encodeURIComponent(todoId)}/complete`)).data.todo;
  },
  async deleteMyTodo(todoId: string) {
    return (await api.delete<{ todo: PersonalTodo }>(`/tasks/todos/${encodeURIComponent(todoId)}`)).data.todo;
  },
  async myWorkPriorities() {
    return (await api.get<{
      categories: Array<{ key: string; label: string; enabled: boolean; builtIn: boolean }>;
      overrides: Array<{ itemKey: string; priorityKey: string }>;
    }>("/tasks/my-work-priorities")).data;
  },
  async setMyWorkPriority(itemKey: string, priorityKey: string) {
    await api.put("/tasks/my-work-priorities", { itemKey, priorityKey });
  },
  async resetMyWorkPriority(itemKey: string) {
    await api.delete("/tasks/my-work-priorities", { data: { itemKey } });
  },
  async addMyWorkPriorityCategory(label: string) {
    return (await api.post<{ key: string; label: string }>("/tasks/my-work-priorities/categories", { label })).data;
  },
  async editMyWorkPriorityCategory(key: string, label: string) {
    return (await api.patch<{ key: string; label: string }>("/tasks/my-work-priorities/categories", { key, label })).data;
  },
  async deleteMyWorkPriorityCategory(key: string) {
    await api.delete("/tasks/my-work-priorities/categories", { data: { key } });
  },
  async restoreMyWorkPriorityCategory(key: string) {
    return (await api.post<{ key: string; label: string }>("/tasks/my-work-priorities/categories/restore", { key })).data;
  },
  async workflow(department?: string) {
    const response = await api.get<{ tasks: Task[]; subtasks: Task[] }>(
      "/tasks/workflow",
      { params: { department } },
    );
    return response.data;
  },
  async hierarchyPerformance(department?: string) {
    const response = await api.get<{
      scope: string;
      leaderboard: HierarchyPerformance[];
    }>("/tasks/workflow/performance", { params: { department } });
    return response.data;
  },
  async hierarchyProgress(department?: string) {
    const response = await api.get<{ packages: HierarchyProgressPackage[] }>(
      "/tasks/workflow/progress",
      { params: { department } },
    );
    return response.data.packages;
  },
  async workflowCandidates(taskId: string) {
    const response = await api.get<WorkflowCandidateOptions>(
      `/tasks/workflow/${taskId}/candidates`,
    );
    return {
      candidates: response.data.candidates ?? [],
      seniorCandidates: response.data.seniorCandidates ?? [],
    };
  },
  async createWorkflowTask(input: {
    title: string;
    description: string;
    deadline: string;
    priority: TaskPriorityValue;
    department?: string;
  }) {
    const response = await api.post<{ task: Task }>("/tasks/workflow", input);
    return response.data.task;
  },
  async routeToHead(
    taskId: string,
    input: { department: string; headId?: string; recipientId?: string; note?: string },
  ) {
    const response = await api.patch<{ task: Task }>(
      `/tasks/workflow/${taskId}/route-head`,
      input,
    );
    return response.data.task;
  },
  async routeToManager(
    taskId: string,
    input: {
      managerId: string;
      projectObjective: string;
      recommendedStack: string[];
      requirements: string[];
      finalDeliverables: string[];
      learningResources: string[];
    },
  ) {
    const response = await api.patch<{ task: Task }>(
      `/tasks/workflow/${taskId}/route-manager`,
      input,
    );
    return response.data.task;
  },
  async delegate(taskId: string, subtasks: WorkflowSubtaskInput[]) {
    const response = await api.post<{ task: Task; subtasks: Task[] }>(
      `/tasks/workflow/${taskId}/subtasks`,
      { subtasks },
    );
    return response.data;
  },
  async submitWorkflowReport(taskId: string, input: { recipientId: string; report: string }) {
    const response = await api.post<{ task: Task }>(
      `/tasks/workflow/${taskId}/report`,
      input,
    );
    return response.data.task;
  },
  async review(
    taskId: string,
    input: {
      decision: "APPROVE" | "ENHANCEMENT";
      note?: string;
      subtaskId?: string;
    },
  ) {
    const response = await api.patch<{ task: Task; subtasks: Task[] }>(
      `/tasks/workflow/${taskId}/review`,
      input,
    );
    return response.data;
  },
  async mine() {
    const response = await api.get<{ tasks: Task[] }>("/tasks/mine");
    return response.data.tasks;
  },
  async report(userId?: string) {
    const response = await api.get<{
      summary: TaskSummary;
      tasks: Task[];
      dailyReports?: DailyReport[];
    }>("/tasks/report", { params: userId ? { userId } : undefined });
    return response.data;
  },
  async assignees() {
    const response = await api.get<{ assignees: Assignee[] }>(
      "/tasks/admin/assignees",
    );
    return response.data.assignees;
  },
  async adminTasks(search = "", status = "") {
    const response = await api.get<{ tasks: Task[] }>("/tasks/admin", {
      params: { search: search || undefined, status: status || undefined },
    });
    return response.data.tasks;
  },
  async adminReport(search = "", options: { department?: string; page?: number; pageSize?: number; status?: string; signal?: AbortSignal } = {}) {
    const { signal, ...params } = options;
    const response = await api.get<{
      report: Array<{
        user: Assignee;
        summary: TaskSummary;
        tasks: Task[];
        dailyReports?: DailyReport[];
      }>;
      tasks: Task[];
      department: string;
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    }>("/tasks/admin/report", { params: { ...params, search: search || undefined }, signal });
    return response.data;
  },
  async create(input: {
    title: string;
    description: string;
    projectObjective: string;
    recommendedStack: string[];
    requirements: string[];
    finalDeliverables: string[];
    learningResources: string[];
    deadline: string;
    assignedTo: string;
    priority?: TaskPriorityValue;
  }) {
    const response = await api.post<{ task: Task }>("/tasks/admin", input);
    return response.data.task;
  },
  async setStatus(id: string, status: "PENDING" | "DONE") {
    const response = await api.patch<{ task: Task }>(
      `/tasks/admin/${id}/status`,
      { status },
    );
    return response.data.task;
  },
  async submitMyTask(
    id: string,
    input: {
      submissionDescription: string;
      githubUrl?: string;
      liveUrl?: string;
    },
  ) {
    const response = await api.patch<{ task: Task }>(`/tasks/${id}/status`, {
      status: "DONE",
      ...input,
    });
    return response.data.task;
  },
  async submitDailyReport(input: {
    taskId: string;
    summary: string;
    progress: number;
    reportDate?: string;
  }) {
    const response = await api.post<{ report: DailyReport }>(
      "/tasks/daily-reports",
      input,
    );
    return response.data.report;
  },
};
