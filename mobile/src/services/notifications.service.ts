import { api } from '@/services/api';

export interface TaskNotification {
  _id: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  notifications: TaskNotification[];
  unread: number;
  pagination: { page: number; totalPages: number; total: number };
}

const emptyPage = (page: number): NotificationPage => ({ notifications: [], unread: 0, pagination: { page, totalPages: 0, total: 0 } });

export const notificationsService = {
  async list(page = 1): Promise<NotificationPage> {
    try {
      const response = await api.get<NotificationPage>('/notifications', { params: { page } });
      return response.data;
    } catch (error) {
      if ((error as { response?: { status?: number } }).response?.status === 404) return emptyPage(page);
      throw error;
    }
  },
  async readAll() {
    await api.patch('/notifications/read');
  },
  async remove(id: string) {
    await api.delete(`/notifications/${id}`);
  },
};
