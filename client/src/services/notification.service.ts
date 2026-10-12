import axios from "axios";
import api from "./axios";

export type TaskNotification = { _id: string; taskId: string; title: string; message: string; readAt: string | null; createdAt: string };
type NotificationPage = { notifications: TaskNotification[]; unread: number; pagination: { page: number; totalPages: number; total: number } };
function emptyPage(page: number): NotificationPage {
  return { notifications: [], unread: 0, pagination: { page, totalPages: 0, total: 0 } };
}

export const NotificationService = {
  async list(page = 1) {
    try {
      return (await api.get<NotificationPage>("/notifications", { params: { page } })).data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) return emptyPage(page);
      throw error;
    }
  },
  async read(id: string) { await api.patch(`/notifications/${id}/read`); window.dispatchEvent(new Event("ricoz-notifications-changed")); },
  async taskDetails(taskId: string) {
    return (await api.get<{ task: import("./task.service").Task }>(`/notifications/task/${taskId}`)).data.task;
  },
  async readAll() { await api.patch("/notifications/read"); window.dispatchEvent(new Event("ricoz-notifications-changed")); },
  async remove(id: string) { await api.delete(`/notifications/${id}`); window.dispatchEvent(new Event("ricoz-notifications-changed")); },
};