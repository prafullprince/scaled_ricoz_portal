import api from "./axios";
import { getStoreRef } from "@/redux/store.reference";
import { companyHeaders } from "@/lib/company";

export type PlannerBlock = {
  title: string;
  detail: string;
  start: string;
  end: string;
  durationMinutes: number;
  priority: "high" | "medium" | "low";
  taskId?: string;
};

export type PlannerResult = {
  summary: string;
  blocks: PlannerBlock[];
  recommendations: string[];
  totalFocusMinutes: number;
  detectedItems: number;
};

export type PlannerStreamEvent =
  | { event: "session"; sessionId: string }
  | { event: "delta"; text: string }
  | { event: "plan"; plan: PlannerResult }
  | { event: "done"; sessionId: string; streamedCharacters: number }
  | { event: "error"; message: string };

export const PlannerService = {
  async conversations() {
    return (await api.get<{ history: Array<{ _id: string; sessionId: string; workDescription: string; answer: string; createdAt: string }>; suggestions: string[] }>("/planner/chat")).data;
  },
  async chat(message: string, sessionId: string) {
    return (await api.post<{ id: string; answer: string; suggestions: string[]; unavailable: boolean }>("/planner/chat", { message, sessionId })).data;
  },
  async chatStream(message: string, sessionId: string, onText: (text: string) => void) {
    const token = getStoreRef().getState().auth.access_token;
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/planner/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream", ...companyHeaders(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ message, sessionId }),
    });
    if (!response.ok || !response.body) throw new Error("Planner conversation stream is unavailable.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const result: { value: { id: string; suggestions: string[]; unavailable: boolean } | null } = { value: null };
    const consume = (chunk: string) => {
      buffer += chunk.replace(/\r\n/g, "\n");
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const event = frame.match(/^event:\s*(.+)$/m)?.[1];
        const data = frame.match(/^data:\s*(.+)$/m)?.[1];
        if (!event || !data) continue;
        const payload = JSON.parse(data) as { text?: string; id?: string; suggestions?: string[]; unavailable?: boolean; message?: string };
        if (event === "delta" && typeof payload.text === "string") onText(payload.text);
        if (event === "done" && payload.id) result.value = { id: payload.id, suggestions: payload.suggestions ?? [], unavailable: Boolean(payload.unavailable) };
        if (event === "error") throw new Error(payload.message ?? "Planner conversation failed.");
      }
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      consume(decoder.decode(value, { stream: true }));
    }
    consume(decoder.decode());
    if (!result.value) throw new Error("Planner conversation ended before completion.");
    return result.value;
  },
  async deleteConversation(sessionId: string) { await api.delete(`/planner/chat/${sessionId}`); },
  async history() {
    return (await api.get<{ history: Array<{ _id: string; createdAt: string; expiresAt: string; plan: PlannerResult }> }>("/planner/history")).data.history;
  },
  async deleteHistory(id: string) {
    await api.delete(`/planner/history/${id}`);
  },
  async generate(workDescription: string, sessionId?: string, date = new Date().toISOString().slice(0, 10)) {
    const response = await api.post<{ plan: PlannerResult }>("/planner/generate", { workDescription, date, sessionId });
    return response.data.plan;
  },
  async generateStream(workDescription: string, sessionId: string, onEvent: (event: PlannerStreamEvent) => void, date = new Date().toISOString().slice(0, 10)) {
    const token = getStoreRef().getState().auth.access_token;
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/planner/generate/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...companyHeaders(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ workDescription, date, sessionId }),
    });
    if (!response.ok || !response.body) {
      const fallbackPlan = await PlannerService.generate(workDescription, sessionId, date);
      onEvent({ event: "plan", plan: fallbackPlan });
      return fallbackPlan;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalPlan: PlannerResult | null = null;
    const consume = (chunk: string) => {
      buffer += chunk;
      const messages = buffer.split("\n\n");
      buffer = messages.pop() ?? "";
      for (const message of messages) {
        const eventName = message.match(/^event: (.+)$/m)?.[1] ?? "message";
        const data = message.match(/^data: (.+)$/m)?.[1];
        if (!data) continue;
        const payload = JSON.parse(data) as Record<string, unknown>;
        if (eventName === "plan") finalPlan = payload.plan as PlannerResult;
        if (eventName === "error") return;
        if (eventName !== "message") onEvent({ event: eventName, ...payload } as PlannerStreamEvent);
      }
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      consume(decoder.decode(value, { stream: true }));
    }
    consume(decoder.decode());
    if (!finalPlan) {
      const fallbackPlan = await PlannerService.generate(workDescription, sessionId, date);
      onEvent({ event: "plan", plan: fallbackPlan });
      return fallbackPlan;
    }
    return finalPlan;
  },
};
