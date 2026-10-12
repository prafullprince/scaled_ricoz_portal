import { getStoreRef } from "@/redux/store.reference";
import { companyHeaders } from "@/lib/company";

export type AssistantMessage = { role: "user" | "assistant"; content: string };

export async function streamAssistant(message: string, sessionId: string, onText: (text: string) => void) {
  const token = getStoreRef().getState().auth.access_token;
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assistant/chat`, { method: "POST", headers: { "Content-Type": "application/json", ...companyHeaders(), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ message, sessionId }) });
  if (!response.ok || !response.body) throw new Error("Assistant unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const consume = (chunk: string) => {
    buffer += chunk;
    const messages = buffer.split("\n\n");
    buffer = messages.pop() ?? "";
    for (const item of messages) {
      const event = item.match(/^event: (.+)$/m)?.[1];
      const data = item.match(/^data: (.+)$/m)?.[1];
      if (event === "delta" && data) onText(String((JSON.parse(data) as { text: string }).text));
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    consume(decoder.decode(value, { stream: true }));
  }
  consume(decoder.decode());
}
