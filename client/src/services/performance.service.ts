import api from "./axios";

export type PerformanceData = { period: string; competencies: { quality: number; delivery: number; collaboration: number; innovation: number; clientFocus: number; learning: number }; overall: number | null; output: number | null; feedback: Array<{ author: string; role: string; rating: number; comment: string; date: string }> };
export const PerformanceService = { async get() { const response = await api.get<{ performance: PerformanceData }>("/performance"); return response.data.performance; } };
