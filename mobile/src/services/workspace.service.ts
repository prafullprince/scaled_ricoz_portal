import { api, fetchWithMobileAuth } from '@/services/api';
import type { User } from '@/types/auth';
import type { PersonalTaskReport, ReportStatus, TeamTaskReport, WorkspaceTask } from '@/features/task-model';

export const workspaceService = {
  async dashboard(user: User) {
    const roles = new Set(user.roles);
    const area = roles.has('INTERN') ? 'intern' : roles.has('EMPLOYEE') ? 'employee' : null;
    if (!area) return { user, message: 'Your role dashboard is available from the workspace.' };
    const response = await api.get(`/protected/${area}/dashboard`);
    return response.data;
  },
  async gate(area: 'customer' | 'investor' | 'intern' | 'employee') {
    const response = await api.get(`/protected/${area}`);
    return response.data;
  },
  async roleDashboard(area: 'intern' | 'employee') {
    const response = await api.get(`/${area}/dashboard`);
    return response.data.dashboard ?? response.data;
  },
  async workflowPerformance(department?: string) {
    const response = await api.get('/tasks/workflow/performance', { params: { department } });
    return response.data;
  },
  async workflowProgress(department?: string) {
    const response = await api.get('/tasks/workflow/progress', { params: { department } });
    return response.data;
  },
  async myTaskReport() {
    const response = await api.get<PersonalTaskReport>('/tasks/report');
    return response.data;
  },
  async adminTaskReport(search = '', options: { department?: string; page?: number; pageSize?: number; status?: ReportStatus } = {}) {
    const response = await api.get<TeamTaskReport>('/tasks/admin/report', { params: { ...options, search: search || undefined } });
    return response.data;
  },
  async conversations() {
    const response = await api.get('/chat/conversations', { params: { limit: 30 } });
    return response.data;
  },
  async tasks() {
    const response = await api.get<{ tasks: WorkspaceTask[] }>('/tasks/mine');
    return response.data;
  },
  async workflowTasks(department?: string) {
    const response = await api.get('/tasks/workflow', { params: { department } });
    return response.data;
  },
  async createWorkflowTask(input: { title: string; description: string; deadline: string; department?: string }) {
    return (await api.post<{ task: WorkspaceTask }>('/tasks/workflow', input)).data.task;
  },
  async workflowCandidates(taskId: string) {
    return (await api.get<{ candidates: { _id: string; name: string; email: string; roles: string[]; level: string; department: string }[] }>(`/tasks/workflow/${taskId}/candidates`)).data.candidates;
  },
  async planWorkflowTask(taskId: string, input: { managerId: string; projectObjective: string; recommendedStack: string[]; requirements: string[]; finalDeliverables: string[]; learningResources: string[] }) {
    return (await api.patch(`/tasks/workflow/${taskId}/route-manager`, input)).data;
  },
  async delegateWorkflowTask(taskId: string, subtasks: { title: string; description: string; deadline: string; assignedToIds: string[] }[]) {
    return (await api.post(`/tasks/workflow/${taskId}/subtasks`, { subtasks })).data;
  },
  async routeWorkflowToHead(taskId: string, department: string, note?: string, headId?: string) {
    const response = await api.patch(`/tasks/workflow/${taskId}/route-head`, { department, note, headId });
    return response.data;
  },
  async reviewWorkflow(taskId: string, decision: 'APPROVE' | 'ENHANCEMENT', note?: string, subtaskId?: string) {
    const response = await api.patch(`/tasks/workflow/${taskId}/review`, { decision, note, subtaskId });
    return response.data;
  },
  async attendance(month = new Date().toISOString().slice(0, 7)) {
    const response = await api.get('/attendance', { params: { month, page: 1, pageSize: 31 } });
    return response.data;
  },
  async checkIn() {
    const response = await api.post('/attendance/check-in');
    return response.data;
  },
  async checkOut() {
    const response = await api.post('/attendance/check-out');
    return response.data;
  },
  async leave() {
    const response = await api.get('/leave');
    return response.data;
  },
  async personalLeave() {
    const response = await api.get('/leave', { params: { scope: 'self' } });
    return response.data;
  },
  async createLeave(input: { type: 'EARNED' | 'SICK' | 'CASUAL'; startDate: string; endDate: string; reason: string }) {
    const response = await api.post('/leave', input);
    return response.data;
  },
  async generatePlan(workDescription: string, date = new Date().toISOString().slice(0, 10)) {
    const response = await api.post('/planner/generate', { workDescription, date });
    return response.data;
  },
  async submitDailyReport(input: { taskId: string; summary: string; progress: number }) {
    const response = await api.post('/tasks/daily-reports', input);
    return response.data;
  },
  async submitTask(taskId: string, submissionDescription: string, urls?: { githubUrl?: string; liveUrl?: string }) {
    const response = await api.patch<{ task: WorkspaceTask }>(`/tasks/${taskId}/status`, { status: 'DONE', submissionDescription, ...urls });
    return response.data;
  },
  async performance() {
    const response = await api.get('/performance');
    return response.data;
  },
  async opportunities() {
    const response = await api.get('/recruitment/opportunities');
    return response.data;
  },
  async applications() {
    const response = await api.get('/recruitment/me/applications');
    return response.data;
  },
  async employee() {
    const response = await api.get('/employee/dashboard');
    return response.data;
  },
  async intern() {
    const response = await api.get('/intern/dashboard');
    return response.data;
  },
  async investor() {
    const response = await api.get('/investor/verification');
    return response.data;
  },
  async analytics() {
    const response = await api.get('/analytics/investor/overview');
    return response.data;
  },
  async organization() {
    const response = await api.get('/organization');
    return response.data;
  },
  async adminUsers() {
    const response = await api.get('/admin/users');
    return response.data;
  },
  async services() {
    const response = await api.get('/services');
    return response.data;
  },
  async streamAssistantMessage(message: string, onDelta: (text: string) => void) {
    const response = await fetchWithMobileAuth('/assistant/chat', {
      method: 'POST',
      headers: { Accept: 'text/event-stream' },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) throw new Error(`Assistant request failed (${response.status}).`);
    if (!response.body) throw new Error('Assistant response stream is unavailable.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n');
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        const event = frame.match(/^event:\s*(.+)$/m)?.[1];
        const data = frame.match(/^data:\s*(.+)$/m)?.[1];
        if (event !== 'delta' || !data) continue;
        const payload = JSON.parse(data) as { text?: unknown };
        if (typeof payload.text === 'string') onDelta(payload.text);
      }
      if (done) break;
    }
  },
};