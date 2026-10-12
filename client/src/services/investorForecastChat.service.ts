import { companyHeaders } from "@/lib/company";
import { getStoreRef } from "@/redux/store.reference";

export type InvestorForecastChatMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type InvestorForecastChatSession = {
  sessionId: string;
  fiscalYearStart: number;
  title: string;
  updatedAt: string;
  messages: InvestorForecastChatMessage[];
};

function apiUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_API_URL}${path}`;
}

function headers() {
  const token = getStoreRef().getState().auth.access_token;
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...companyHeaders(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseError(response: Response) {
  const payload = await response.json().catch(() => null) as { message?: string } | null;
  return payload?.message ?? `Forecast chat request failed (${response.status}).`;
}

export const InvestorForecastChatService = {
  async listSessions(): Promise<InvestorForecastChatSession[]> {
    const response = await fetch(apiUrl("/analytics/investor/forecast-chat/sessions"), { headers: headers(), cache: "no-store" });
    if (!response.ok) throw new Error(await parseError(response));
    const payload = await response.json() as { sessions: InvestorForecastChatSession[] };
    return payload.sessions;
  },

  async createSession(fiscalYearStart: number): Promise<InvestorForecastChatSession> {
    const response = await fetch(apiUrl("/analytics/investor/forecast-chat/sessions"), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ fiscalYearStart }),
    });
    if (!response.ok) throw new Error(await parseError(response));
    const payload = await response.json() as { session: InvestorForecastChatSession };
    return payload.session;
  },

  async getSession(sessionId: string): Promise<InvestorForecastChatSession> {
    const response = await fetch(apiUrl(`/analytics/investor/forecast-chat/sessions/${encodeURIComponent(sessionId)}`), {
      headers: headers(),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await parseError(response));
    const payload = await response.json() as { session: InvestorForecastChatSession };
    return payload.session;
  },

  async deleteSession(sessionId: string): Promise<void> {
    const response = await fetch(apiUrl(`/analytics/investor/forecast-chat/sessions/${encodeURIComponent(sessionId)}`), {
      method: "DELETE",
      headers: headers(),
    });
    if (!response.ok) throw new Error(await parseError(response));
  },

  async streamMessage(
    sessionId: string,
    message: string,
    onDelta: (text: string) => void,
  ): Promise<void> {
    const response = await fetch(apiUrl(`/analytics/investor/forecast-chat/sessions/${encodeURIComponent(sessionId)}/messages`), {
      method: "POST",
      headers: { ...headers(), Accept: "text/event-stream" },
      body: JSON.stringify({ message }),
    });
    if (!response.ok || !response.body) throw new Error(await parseError(response));

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamError: string | null = null;
    const consume = (chunk: string) => {
      buffer += chunk;
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const event = frame.match(/^event:\s*(.+)$/m)?.[1];
        const data = frame.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
        if (!data) continue;
        const payload = JSON.parse(data) as { text?: string; message?: string };
        if (event === "delta" && payload.text) onDelta(payload.text);
        if (event === "error") streamError = payload.message ?? "The forecast assistant could not complete this answer.";
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        consume(decoder.decode(value, { stream: true }));
      }
      consume(decoder.decode());
    } finally {
      reader.releaseLock();
    }
    if (streamError) throw new Error(streamError);
  },
};
