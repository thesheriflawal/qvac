import api from "./api";
export interface NotificationResponse { id: number; title: string; message: string; is_read: boolean; created_at: string; read_at?: string; }
export const notificationService = {
  getNotifications: async (page = 1, status: "all" | "unread" = "all") => { const r = await api.get("/users/me/notifications", { params: { page, status } }); return r.data as { data: NotificationResponse[]; meta?: unknown }; },
  markAsRead: async (id: number) => { const r = await api.patch(`/users/me/notifications/${id}/read`); return r.data; },
  markAllAsRead: async () => { const r = await api.patch("/users/me/notifications/read-all"); return r.data; },
};
