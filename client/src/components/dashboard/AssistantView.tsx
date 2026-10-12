"use client";

import { FormEvent, useState } from "react";
import { Bot, LoaderCircle, Send, Sparkles, UserRound } from "lucide-react";
import { streamAssistant, type AssistantMessage } from "@/services/assistant.service";
import { MarkdownContent } from "./MarkdownContent";

const starters = ["What’s at risk this week?", "Summarize my day", "Generate a weekly report", "Who should I reassign tasks to?"];

export function AssistantView() {
  const [messages, setMessages] = useState<AssistantMessage[]>([{ role: "assistant", content: "Hi, I’m FEOS AI. Ask me about your tasks, workload, deadlines, or daily plan." }]);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage(message = value) {
    const trimmed = message.trim();
    if (!trimmed || loading) return;
    setValue("");
    setLoading(true);
    setMessages((current) => [...current, { role: "user", content: trimmed }, { role: "assistant", content: "" }]);
    try {
      await streamAssistant(trimmed, "assistant", (text) => setMessages((current) => { const next = [...current]; next[next.length - 1] = { role: "assistant", content: `${next[next.length - 1]?.content ?? ""}${text}` }; return next; }));
    } catch {
      setMessages((current) => {
        const next = [...current];
        next[next.length - 1] = { role: "assistant", content: "The assistant could not complete this request. Please try again." };
        return next;
      });
    } finally { setLoading(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void sendMessage(); }

  return <div className="mx-auto max-w-[1180px] space-y-6"><div><div className="flex items-center gap-2 text-xs font-bold text-[#008f69]"><span className="rounded bg-[#7c8da5] px-2 py-1 text-white">MOD-16 AI</span><span>›</span><span className="text-[#5c6f8d]">AI Assistant</span></div><h1 className="mt-8 text-[22px] font-bold text-(--brand-navy)">AI Assistant</h1><p className="mt-1 text-sm text-[#5c6f8d]">MOD-16 · Your personal FEOS AI copilot</p></div><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_205px]"><section className="flex min-h-[560px] flex-col overflow-hidden rounded-[16px] border border-(--brand-border) bg-white shadow-(--shadow-xs)"><div className="flex items-center justify-between border-b border-(--brand-border) px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00b982] text-white"><Sparkles size={19} /></span><div><p className="text-sm font-bold text-(--brand-navy)">FEOS AI</p><p className="flex items-center gap-1 text-xs text-[#8da0ba]"><span className="h-1.5 w-1.5 rounded-full bg-[#00b982]" /> Connected to your workspace</p></div></div><span className="rounded-full bg-[#e6faf4] px-3 py-1 text-xs font-bold text-[#008f69]">{process.env.NEXT_PUBLIC_AI_MODEL ?? "AI"}</span></div><div className="flex-1 space-y-4 overflow-y-auto bg-[#fcfdff] p-5">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex items-start gap-3 ${message.role === "user" ? "justify-end" : ""}`}><span className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${message.role === "user" ? "bg-[#00b982] text-white" : "bg-[#e6faf4] text-[#008f69]"}`}>{message.role === "user" ? <UserRound size={15} /> : <Bot size={16} />}</span><div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "whitespace-pre-wrap bg-[#00b982] text-white" : "bg-[#f0f3f8] text-(--brand-navy)"}`}>
  {message.content ? message.role === "assistant" ? <MarkdownContent className="space-y-2 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:mb-1.5 [&_h2]:mt-4 [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_code]:rounded [&_code]:bg-black/5 [&_code]:px-1 [&_a]:underline">{message.content}</MarkdownContent> : message.content : message.role === "assistant" ? <LoaderCircle size={16} className="animate-spin" /> : null}
</div></div>)}</div><div className="border-t border-(--brand-border) p-4"><div className="mb-3 flex gap-2 overflow-x-auto">{starters.map((starter) => <button key={starter} type="button" onClick={() => void sendMessage(starter)} className="shrink-0 rounded-full border border-(--brand-border) px-3 py-1.5 text-xs font-semibold text-[#5c6f8d] hover:border-[#9de8d1] hover:text-[#008f69]">{starter}</button>)}</div><form onSubmit={submit} className="flex items-center gap-2 rounded-2xl border border-(--brand-border) bg-white px-4 py-2"><input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Ask FEOS AI anything about your work, team, or business..." className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" /><button type="submit" aria-label="Send message" disabled={loading || !value.trim()} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00b982] text-white disabled:opacity-50"><Send size={15} /></button></form></div></section><aside className="rounded-[16px] border border-(--brand-border) bg-white p-5 shadow-(--shadow-xs)"><h2 className="text-sm font-bold text-(--brand-navy)">Capabilities</h2><div className="mt-4 space-y-4">{["Task Planning", "Team Analysis", "Forecasting", "Reports", "Knowledge Search"].map((item) => <div key={item} className="flex items-center gap-3"><span className="h-8 w-8 rounded-full bg-[#eefaf6]" /><div><p className="text-xs font-bold text-(--brand-navy)">{item}</p><p className="text-[10px] text-[#8da0ba]">Ask FEOS AI</p></div></div>)}</div></aside></div></div>;
}
