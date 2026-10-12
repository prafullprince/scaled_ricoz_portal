import api from "./axios";

export type AttendanceSession = { checkIn: string; checkOut: string | null; totalMinutes: number };
export type AttendanceRecord = { id: string; date: string; sessions: AttendanceSession[]; checkIn: string | null; checkOut: string | null; openSession: AttendanceSession | null; status: "PRESENT" | "LATE" | "LEAVE" | "ABSENT"; totalMinutes: number; totalHours: number; workType: "OVERTIME" | "PRESENT_DAY" | "HALF_TIME" | "UNDER_TWO_HOURS" };
export type AttendanceResponse = { today: AttendanceRecord | null; records: AttendanceRecord[]; summary: { present: number; late: number; leave: number; averageMinutes: number; month: string }; pagination: { page: number; pageSize: number; totalRecords: number; totalPages: number } };

export const AttendanceService = {
  async month(month = new Date().toISOString().slice(0, 7), page = 1, pageSize = 10) { const response = await api.get<{ attendance: AttendanceResponse }>("/attendance", { params: { month, page, pageSize } }); return response.data.attendance; },
  async checkIn() { const response = await api.post<{ attendance: AttendanceRecord }>("/attendance/check-in"); return response.data.attendance; },
  async checkOut() { const response = await api.post<{ attendance: AttendanceRecord }>("/attendance/check-out"); return response.data.attendance; },
};
