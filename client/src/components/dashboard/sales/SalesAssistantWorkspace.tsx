"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, LoaderCircle, Plus, Send, Sparkles, UserRound } from "lucide-react";
import { MarkdownContent } from "@/components/dashboard/MarkdownContent";
import { SalesService } from "@/services/sales.service";
import type { SalesAssistantOverview } from "@/types/sales";

type Message = { id: number; role: "assistant" | "user"; content: string };

const suggestions = [
  "Which leads should I call today?",
  "Show pipeline risk summary",
  "Who are the top priority leads?",
  "Revenue forecast this month",
  "Leads with no follow-up in 5+ days",
  "Best performing lead sources",
];
const markdownClass = "[&>p]:my-2 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>ul]:my-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:my-2 [&>ol]:list-decimal [&>ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-bold [&>h1]:mb-2 [&>h1]:mt-3 [&>h1]:text-base [&>h1]:font-bold [&>h2]:mb-2 [&>h2]:mt-3 [&>h2]:text-sm [&>h2]:font-bold [&_a]:text-blue-600 [&_a]:underline";

function moneyByCurrency(amounts: SalesAssistantOverview["pipeline"]) {
  if (!amounts.length) return "No open pipeline";
  return amounts.map(({ _id, pipelineValue }) => new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: _id,
    maximumFractionDigits: 0,
  }).format(pipelineValue / 100)).join(" · ");
}

function welcomeMessage(overview: SalesAssistantOverview | null) {
  if (!overview) return "Hello! I’m your AI Sales Assistant. I can analyze your current leads, follow-ups, pipeline and revenue forecast. What would you like to know?";
  return [
    "Hello! I’m your AI Sales Assistant. I have live access to the Sales data available in your workspace:",
    "",
    `- **${overview.totalLeads}** total leads`,
    `- **${overview.hotLeads}** high-priority leads`,
    `- **${moneyByCurrency(overview.pipeline)}** open pipeline`,
    "",
    "What would you like to know?",
  ].join("\n");
}

export function SalesAssistantWorkspace() {
  const [overview, setOverview] = useState<SalesAssistantOverview | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const abort = new AbortController();
    void SalesService.salesAssistantOverview(abort.signal).then(setOverview).catch(() => {
      if (!abort.signal.aborted) setError("Live Sales metrics could not be loaded. You can still ask questions about accessible CRM data.");
    }).finally(() => {
      if (!abort.signal.aborted) setLoadingOverview(false);
    });
    return () => abort.abort();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function sendMessage(messageText: string) {
    const message = messageText.trim();
    if (!message || sending) return;
    setError("");
    setDraft("");
    setSending(true);
    const userMessage: Message = { id: nextId.current++, role: "user", content: message };
    const assistantMessage: Message = { id: nextId.current++, role: "assistant", content: "" };
    const activeSession = sessionId || crypto.randomUUID();
    if (!sessionId) setSessionId(activeSession);
    setMessages((current) => [...current, userMessage, assistantMessage]);
    try {
      await SalesService.streamSalesAssistant(message, activeSession, (text) => {
        setMessages((current) => current.map((item) => item.id === assistantMessage.id
          ? { ...item, content: item.content + text }
          : item));
      });
    } catch (caught) {
      setMessages((current) => current.map((item) => item.id === assistantMessage.id
        ? { ...item, content: item.content || "I couldn’t complete that request. Please try again." }
        : item));
      setError(caught instanceof Error ? caught.message : "The Sales assistant could not complete this request.");
    } finally {
      setSending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft);
  }

  function newConversation() {
    setSessionId("");
    setMessages([]);
    setError("");
    inputRef.current?.focus();
  }

  const assistantIsTyping = sending && messages.at(-1)?.role === "assistant" && !messages.at(-1)?.content;
  const totalPipeline = overview ? moneyByCurrency(overview.pipeline) : loadingOverview ? "Loading live pipeline…" : "Pipeline metrics unavailable";

  return <section className="mx-auto flex min-h-[min(760px,calc(100dvh-220px))] max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-(--brand-border) bg-(--brand-surface) shadow-[0_18px_55px_rgba(21,35,58,0.09)]" aria-label="AI Sales Assistant">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-(--brand-border) bg-(--brand-surface) px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20"><Bot size={19} /></span>
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold text-(--brand-text)">AI Sales Assistant</h2>
          <p className="mt-0.5 truncate text-xs text-(--brand-text-secondary)">
            {overview ? `${overview.totalLeads} leads · ${totalPipeline} pipeline loaded` : totalPipeline}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500" />Live</span>
        <button type="button" onClick={newConversation} disabled={sending} title="Start a new conversation" aria-label="Start a new conversation" className="grid h-9 w-9 place-items-center rounded-lg border border-(--brand-border) text-(--brand-text-secondary) transition hover:bg-(--brand-surface-hover) disabled:opacity-50"><Plus size={16} /></button>
      </div>
    </header>

    <div className="flex min-h-[340px] flex-1 flex-col gap-5 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-50/70 via-(--brand-background) to-(--brand-background) px-4 py-5 sm:px-6">
      <div className="flex max-w-[90%] items-start gap-2.5 self-start sm:max-w-[78%]">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-600 text-white"><Bot size={14} /></span>
        <div className="rounded-2xl rounded-tl-md border border-(--brand-border) bg-(--brand-surface) px-4 py-3 text-sm leading-6 text-(--brand-text) shadow-sm">
          <MarkdownContent className={markdownClass}>{welcomeMessage(overview)}</MarkdownContent>
        </div>
      </div>
      {messages.map((message) => <div key={message.id} className={`flex max-w-[90%] items-start gap-2.5 sm:max-w-[78%] ${message.role === "user" ? "self-end" : "self-start"}`}>
        {message.role === "assistant" && <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-600 text-white"><Bot size={14} /></span>}
        <div className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${message.role === "user" ? "rounded-tr-md bg-[#1645a2] text-white" : "rounded-tl-md border border-(--brand-border) bg-(--brand-surface) text-(--brand-text)"}`}>
          {message.role === "assistant"
            ? message.content
              ? <MarkdownContent className={markdownClass}>{message.content}</MarkdownContent>
              : <span className="inline-flex items-center gap-2 text-(--brand-text-secondary)"><LoaderCircle size={15} className="animate-spin" />Checking live Sales data…</span>
            : message.content}
        </div>
        {message.role === "user" && <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#dfe8f7] text-[#1645a2]"><UserRound size={14} /></span>}
      </div>)}
      {assistantIsTyping && <span className="sr-only" role="status">Assistant is responding</span>}
      <div ref={bottomRef} />
    </div>

    <div className="border-t border-(--brand-border) bg-(--brand-surface) px-4 pb-4 pt-3 sm:px-5">
      {error && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {!messages.length && <div className="mb-3 flex flex-wrap gap-2">
        {suggestions.map((suggestion) => <button key={suggestion} type="button" disabled={sending} onClick={() => void sendMessage(suggestion)} className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-[11px] font-semibold text-purple-800 transition hover:border-purple-300 hover:bg-purple-100 disabled:opacity-50">{suggestion}</button>)}
      </div>}
      <form onSubmit={submit} className="flex items-end gap-2 rounded-xl border border-(--brand-border) bg-(--input-background) p-2 transition focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-400/15">
        <label className="sr-only" htmlFor="sales-assistant-prompt">Ask the Sales assistant</label>
        <textarea
          ref={inputRef}
          id="sales-assistant-prompt"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(draft); } }}
          maxLength={4000}
          rows={1}
          placeholder="Ask about leads, pipeline, forecast, risks…"
          className="max-h-32 min-h-10 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-(--brand-text) outline-none placeholder:text-(--brand-text-muted)"
        />
        <button type="submit" disabled={!draft.trim() || sending} aria-label="Send message" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45">
          {sending ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
      <p className="mt-2 flex items-center justify-center gap-1 text-center text-[10px] text-(--brand-text-muted)"><Sparkles size={11} />Answers use live, access-scoped CRM data. Verify critical decisions before acting.</p>
    </div>
  </section>;
}
