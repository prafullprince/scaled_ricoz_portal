"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, LoaderCircle, MessageSquarePlus, Send, Sparkles, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { InvestorForecastChatService, type InvestorForecastChatSession } from "@/services/investorForecastChat.service";
import { MarkdownContent } from "@/components/dashboard/MarkdownContent";

const suggestions = [
  "Summarize the financial outlook for this fiscal year.",
  "Which month has the highest projected profit, and why?",
  "What happens if revenue is 10% below plan?",
  "Which assumptions create the biggest financial risks?",
];

const forecastMarkdownClass = [
  "max-w-none min-w-0 break-words text-[14px] leading-7 text-[#34435a]",
  "[&_h1]:mb-3 [&_h1]:mt-5 [&_h1]:text-xl [&_h1]:font-extrabold [&_h1]:tracking-tight [&_h1]:text-[#17243b]",
  "[&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:border-b [&_h2]:border-[#e8edf4] [&_h2]:pb-2 [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:text-[#17243b]",
  "[&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-[#24334b]",
  "[&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:text-sm [&_h4]:font-bold [&_h4]:text-[#24334b]",
  "[&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_strong]:text-[#17243b]",
  "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6 [&_li]:pl-1",
  "[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-violet-300 [&_blockquote]:bg-violet-50/70 [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:text-[#4b5870]",
  "[&_hr]:my-5 [&_hr]:border-[#e8edf4] [&_a]:font-semibold [&_a]:text-blue-700 [&_a]:underline [&_a]:underline-offset-2",
].join(" ");

export function InvestorForecastChat({
  fiscalYearStart,
  draft,
  onDraftChange,
}: {
  fiscalYearStart: number;
  draft: string;
  onDraftChange: (value: string) => void;
}) {
  const [sessions, setSessions] = useState<InvestorForecastChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const transcriptRef = useRef<HTMLDivElement>(null);
  const activeSession = sessions.find((session) => session.sessionId === activeSessionId) ?? null;
  const activeMessageCount = activeSession?.messages.length ?? 0;
  const activeLastMessageContent = activeSession?.messages.at(-1)?.content ?? "";

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await InvestorForecastChatService.listSessions();
      setSessions((current) => result.map((session) => ({
        ...session,
        messages: current.find((item) => item.sessionId === session.sessionId)?.messages ?? session.messages,
      })));
      setActiveSessionId((current) => result.some((session) => session.sessionId === current) ? current : result[0]?.sessionId ?? "");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load your forecast chats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSessions(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSessions]);

  useEffect(() => {
    if (!activeSessionId) return;
    let active = true;
    InvestorForecastChatService.getSession(activeSessionId).then((session) => {
      if (active) setSessions((current) => current.map((item) => item.sessionId === session.sessionId ? session : item));
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Unable to load this conversation.");
    });
    return () => { active = false; };
  }, [activeSessionId]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [activeMessageCount, activeLastMessageContent]);

  async function newSession() {
    setCreating(true);
    setError("");
    try {
      const session = await InvestorForecastChatService.createSession(fiscalYearStart);
      setSessions((current) => [session, ...current]);
      setActiveSessionId(session.sessionId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to start a forecast chat.");
    } finally {
      setCreating(false);
    }
  }

  async function deleteSession(sessionId: string) {
    try {
      await InvestorForecastChatService.deleteSession(sessionId);
      const remaining = sessions.filter((session) => session.sessionId !== sessionId);
      setSessions(remaining);
      if (activeSessionId === sessionId) {
        if (remaining.length) setActiveSessionId(remaining[0]!.sessionId);
        else setActiveSessionId("");
      }
      toast.success("Forecast chat deleted.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to delete this forecast chat.");
    }
  }

  async function sendQuestion(question: string) {
    const text = question.trim();
    if (!text || sending) return;
    onDraftChange("");
    setError("");
    setSending(true);
    let session = activeSession;
    try {
      if (!session) {
        session = await InvestorForecastChatService.createSession(fiscalYearStart);
        setSessions((current) => [session!, ...current]);
        setActiveSessionId(session.sessionId);
      }
      const targetSession = session;
      const userMessage = { role: "user" as const, content: text, createdAt: new Date().toISOString() };
      const assistantMessage = { role: "assistant" as const, content: "", createdAt: new Date().toISOString() };
      setSessions((current) => current.map((item) =>
        item.sessionId === targetSession.sessionId
          ? {
              ...item,
              title: item.messages.length ? item.title : text.slice(0, 80),
              updatedAt: new Date().toISOString(),
              messages: [...item.messages, userMessage, assistantMessage],
            }
          : item,
      ));
      await InvestorForecastChatService.streamMessage(targetSession.sessionId, text, (delta) => {
        setSessions((current) => current.map((item) => {
          if (item.sessionId !== targetSession.sessionId) return item;
          const messages = [...item.messages];
          const last = messages.at(-1);
          if (last?.role === "assistant") {
            messages[messages.length - 1] = { ...last, content: `${last.content}${delta}` };
          }
          return { ...item, messages };
        }));
      });
      void loadSessions();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "The forecast assistant could not complete this answer.";
      setError(message);
      setSessions((current) => current.map((item) => {
        if (item.sessionId !== session?.sessionId) return item;
        const messages = [...item.messages];
        if (messages.at(-1)?.role === "assistant" && !messages.at(-1)?.content) messages.pop();
        return { ...item, messages };
      }));
    } finally {
      setSending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendQuestion(draft);
  }

  return (
    <section id="investor-forecast-chat" className="flex h-[680px] min-h-0 flex-col overflow-hidden rounded-2xl border border-[#dce5f0] bg-white shadow-[0_12px_32px_rgba(23,42,75,0.06)]" aria-label="AI financial forecast assistant">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#e8edf4] bg-gradient-to-r from-[#f8faff] via-white to-[#f8f6ff] px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-md shadow-violet-200"><Sparkles size={18} /></span>
          <div>
            <h3 className="text-sm font-extrabold text-[#17243b]">Ask your financial analyst</h3>
            <p className="mt-0.5 text-[10px] text-[#74829a]">Answers grounded in this company’s saved FY {fiscalYearStart}–{String(fiscalYearStart + 1).slice(-2)} plans</p>
          </div>
        </div>
        <button type="button" onClick={() => void newSession()} disabled={creating || sending} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dce4ef] bg-white px-3 text-xs font-bold text-[#34435b] transition hover:border-blue-300 hover:text-blue-700 disabled:opacity-50">
          {creating ? <LoaderCircle size={14} className="animate-spin" /> : <MessageSquarePlus size={14} />} New chat
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[220px_minmax(0,1fr)] md:grid-rows-1">
        <aside className="min-h-0 overflow-y-auto border-b border-[#e8edf4] bg-[#fafbfd] p-3 md:border-b-0 md:border-r">
          <p className="mb-2 px-2 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#91a0b5]">Your conversations</p>
          {loading ? <div className="space-y-2 p-2" aria-label="Loading conversations">{[0, 1, 2].map((item) => <div key={item} className="h-9 animate-pulse rounded-lg bg-slate-100" />)}</div> : sessions.length ? (
            <ul className="flex gap-2 overflow-x-auto md:block md:space-y-1 md:overflow-visible">
              {sessions.map((session) => (
                <li key={session.sessionId} className="group relative shrink-0">
                  <button type="button" onClick={() => setActiveSessionId(session.sessionId)} className={`w-48 rounded-lg px-3 py-2.5 text-left transition md:w-full ${activeSessionId === session.sessionId ? "bg-blue-50 text-blue-800 ring-1 ring-blue-100" : "text-[#53627a] hover:bg-white hover:text-[#17243b]"}`}>
                    <span className="block truncate pr-5 text-[11px] font-bold">{session.title || "Financial forecast chat"}</span>
                    <span className="mt-1 block text-[9px] text-[#92a0b4]">FY {session.fiscalYearStart}–{String(session.fiscalYearStart + 1).slice(-2)}</span>
                  </button>
                  <button type="button" onClick={() => void deleteSession(session.sessionId)} aria-label={`Delete ${session.title}`} className="absolute right-1.5 top-2.5 hidden rounded p-1 text-[#9aa7b8] hover:bg-rose-50 hover:text-rose-600 group-hover:block"><Trash2 size={13} /></button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 py-3 text-[10px] leading-5 text-[#8794a8]">Your saved forecast conversations will appear here.</p>
          )}
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col">
          <div ref={transcriptRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6" aria-live="polite">
            {!activeSession?.messages.length ? (
              <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><Bot size={24} /></div>
                <h4 className="mt-4 text-center text-base font-extrabold text-[#1d2b43]">Explore the company forecast</h4>
                <p className="mx-auto mt-2 max-w-md text-center text-xs leading-5 text-[#77869d]">Ask about projected revenue, monthly profitability, costs, staffing, plan assumptions, or hypothetical scenarios. Answers use saved plan data—not actuals or external sources.</p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => void sendQuestion(suggestion)} disabled={sending} className="rounded-xl border border-[#e1e8f1] bg-white p-3 text-left text-[10px] font-semibold leading-4 text-[#52617a] transition hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-800 disabled:opacity-50">{suggestion}</button>)}
                </div>
              </div>
            ) : activeSession.messages.map((message, index) => (
              <article key={`${message.createdAt}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "assistant" ? <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 text-white"><Sparkles size={14} /></span> : null}
                <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-xs leading-6 ${message.role === "user" ? "rounded-br-md bg-[#123e9e] text-white" : "min-w-0 rounded-bl-md border border-[#e5eaf2] bg-[#f8fafd] text-[#34435a]"}`}>
                  {message.role === "assistant" ? (
                    message.content
                      ? <MarkdownContent className={forecastMarkdownClass}>{message.content}</MarkdownContent>
                      : sending ? <span className="inline-flex items-center gap-2 text-[#7c6bc4]"><LoaderCircle size={14} className="animate-spin" />Analyzing saved plan data…</span> : <span className="text-[#8794a8]">No response received.</span>
                  ) : <p className="whitespace-pre-wrap">{message.content}</p>}
                </div>
                {message.role === "user" ? <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#eaf0fb] text-[#385b9c]"><UserRound size={14} /></span> : null}
              </article>
            ))}
          </div>

          {error ? <p role="alert" className="mx-4 mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-semibold text-rose-800 sm:mx-6">{error}</p> : null}
          <form onSubmit={submit} className="shrink-0 border-t border-[#e8edf4] bg-white p-3 sm:p-4">
            <div className="flex items-end gap-2 rounded-2xl border border-[#dce4ef] bg-[#fbfcfe] p-2 transition focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-50">
              <label htmlFor="investor-forecast-question" className="sr-only">Ask a question about the financial forecast</label>
              <textarea id="investor-forecast-question" value={draft} onChange={(event) => onDraftChange(event.target.value)} onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendQuestion(draft);
                }
              }} maxLength={4000} rows={1} placeholder="Ask anything about the financial plan…" disabled={sending} className="max-h-36 min-h-10 flex-1 resize-y bg-transparent px-2 py-2 text-xs leading-5 text-[#24334b] outline-none placeholder:text-[#9aa6b7] disabled:opacity-60" />
              <button type="submit" aria-label={sending ? "Generating answer" : "Send question"} disabled={!draft.trim() || sending} className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#244fbd] to-[#472ac4] text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">{sending ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={15} />}</button>
            </div>
            <p className="mt-2 text-center text-[9px] text-[#9aa6b7]">AI answers can be inaccurate. Verify material decisions against the saved plan; hypothetical scenarios do not change company data.</p>
          </form>
        </div>
      </div>
    </section>
  );
}
