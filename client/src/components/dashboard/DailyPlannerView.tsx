"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, ArrowUp, CheckCircle2, Clock3, Lightbulb, LoaderCircle, MessageSquare, Plus, Sparkles, Sun, Target, Trash2, History } from "lucide-react";
import { PlannerService, type PlannerResult } from "@/services/planner.service";
import { useAppSelector } from "@/redux/hooks";
import { MarkdownContent } from "./MarkdownContent";

const starterText = "Plan my day around my assigned tasks and department priorities.";

export function DailyPlannerView() {
  const [mode, setMode] = useState<"chat" | "schedule">("chat");
  return <div className="mx-auto max-w-6xl text-(--brand-text)">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-(--brand-border) pb-4"><h1 className="text-xl font-semibold">Daily planner</h1><div role="tablist" aria-label="Planner view" className="flex gap-1 rounded-md bg-(--brand-surface) p-1">{(["chat", "schedule"] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={mode === tab} onClick={() => setMode(tab)} className={`inline-flex min-h-9 items-center gap-2 rounded px-3 text-sm font-semibold ${mode === tab ? "bg-(--brand-background) text-(--brand-text) shadow-sm" : "text-(--brand-text-secondary)"}`}>{tab === "chat" ? <MessageSquare size={15}/> : <Sun size={15}/>} {tab === "chat" ? "Conversation" : "Schedule"}</button>)}</div></header>
    {mode === "chat" ? <PlannerConversation/> : <SchedulePlanner/>}
  </div>;
}

type ConversationTurn = Awaited<ReturnType<typeof PlannerService.conversations>>["history"][number];

function PlannerConversation() {
  const companyId = useAppSelector((state) => state.auth.user?.company?.id);
  return <ConversationWorkspace key={companyId}/>;
}

function ConversationWorkspace() {
  const [history, setHistory] = useState<ConversationTurn[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const turns = history.filter((turn) => turn.sessionId === sessionId);
  const sessions = [...new Map(history.map((turn) => [turn.sessionId, { id: turn.sessionId, title: history.find((entry) => entry.sessionId === turn.sessionId)?.workDescription ?? "Conversation" }])).values()].reverse();
  useEffect(() => {
    let active = true;
    PlannerService.conversations().then((data) => {
      if (!active) return;
      setHistory(data.history);
      setSuggestions(data.suggestions);
      setSessionId(data.history.at(-1)?.sessionId ?? crypto.randomUUID());
    }).catch(() => { if (active) { setError("Conversations could not be loaded."); setSessionId(crypto.randomUUID()); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [history, sending, sessionId]);

  async function send(message: string) {
    if (!message.trim() || sending || !sessionId) return;
    const text = message.trim();
    const temporaryId = crypto.randomUUID();
    setSending(true);
    setError("");
    setDraft("");
    setHistory((current) => [...current, { _id: temporaryId, sessionId, workDescription: text, answer: "", createdAt: new Date().toISOString() }]);
    try {
      let answer = "";
      const response = await PlannerService.chatStream(text, sessionId, (delta) => {
        answer += delta;
        setHistory((current) => current.map((turn) => turn._id === temporaryId ? { ...turn, answer } : turn));
      });
      setHistory((current) => current.map((turn) => turn._id === temporaryId ? { ...turn, _id: response.id, answer } : turn));
      setSuggestions(response.suggestions);
    } catch {
      setHistory((current) => current.filter((turn) => turn._id !== temporaryId));
      setDraft(text);
      setError("Your message could not be sent. Please try again.");
    } finally { setSending(false); }
  }

  async function removeConversation() {
    if (!window.confirm("Delete this conversation?")) return;
    setDeleting(true);
    try { await PlannerService.deleteConversation(sessionId); setHistory((current) => current.filter((turn) => turn.sessionId !== sessionId)); setSessionId(crypto.randomUUID()); setError(""); }
    catch { setError("Conversation could not be deleted."); }
    finally { setDeleting(false); }
  }

  return <div className="grid h-[calc(100dvh-230px)] min-h-[440px] gap-5 lg:h-[calc(100dvh-210px)] lg:grid-cols-[220px_minmax(0,1fr)]">
    <aside className="hidden min-w-0 border-r border-(--brand-border) pr-4 lg:block">
      <button type="button" disabled={sending || deleting || loading} onClick={() => { setSessionId(crypto.randomUUID()); setDraft(""); setError(""); }} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-(--brand-border) text-sm font-semibold hover:bg-(--brand-surface-hover) disabled:opacity-50"><Plus size={16}/>New conversation</button>
      <details open className="mt-4"><summary className="cursor-pointer text-xs font-semibold text-(--brand-text-secondary)">Recent conversations</summary><nav aria-label="Conversation history" className="mt-3 flex max-h-40 flex-col gap-1 overflow-y-auto lg:max-h-[55dvh]">{sessions.map((session) => <button key={session.id} type="button" disabled={sending || deleting} onClick={() => { setSessionId(session.id); setError(""); }} title={session.title} className={`min-h-10 truncate rounded px-2 text-left text-sm ${sessionId === session.id ? "bg-(--brand-surface-active) font-semibold" : "text-(--brand-text-secondary) hover:bg-(--brand-surface-hover)"}`}>{session.title}</button>)}</nav></details>
    </aside>
    <section className="flex min-h-0 min-w-0 flex-col" aria-label="Planner conversation">
      <div className="mb-3 flex gap-2 lg:hidden"><select aria-label="Select conversation" value={sessionId} disabled={sending || deleting} onChange={(event) => setSessionId(event.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-(--brand-border) bg-(--brand-surface) px-2 text-sm">{!sessions.some((session) => session.id === sessionId) ? <option value={sessionId}>New conversation</option> : null}{sessions.map((session) => <option key={session.id} value={session.id}>{session.title.slice(0, 60)}</option>)}</select><button type="button" title="New conversation" aria-label="New conversation" disabled={sending || deleting || loading} onClick={() => { setSessionId(crypto.randomUUID()); setDraft(""); setError(""); }} className="flex size-9 shrink-0 items-center justify-center rounded-md border border-(--brand-border)"><Plus size={16}/></button></div>
      <div className="mb-2 flex min-h-8 items-center justify-between"><span className="flex items-center gap-2 text-xs font-semibold text-(--brand-text-secondary)"><Sparkles size={15} className="text-(--brand-red)"/>Ricoz assistant</span>{turns.length ? <button type="button" disabled={sending || deleting} onClick={() => void removeConversation()} title="Delete conversation" aria-label="Delete conversation" className="rounded p-2 text-(--brand-text-secondary) hover:text-(--status-danger)"><Trash2 size={16}/></button> : null}</div>
      <div role="log" aria-label="Messages" aria-live="polite" className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-1 py-4">
        {loading ? <p className="flex items-center gap-2 text-sm text-(--brand-text-secondary)"><LoaderCircle size={16} className="animate-spin"/>Loading conversations...</p> : !turns.length ? <div className="flex min-h-56 flex-col items-center justify-center text-center"><MessageSquare size={32} className="mb-4 text-(--brand-red)"/><h2 className="text-2xl font-semibold">What is on your mind?</h2></div> : turns.map((turn) => <article key={turn._id} className="space-y-4"><div className="ml-auto max-w-[90%] rounded-lg bg-(--brand-surface-active) px-4 py-3"><p className="whitespace-pre-wrap break-words text-sm leading-6">{turn.workDescription}</p></div>{turn.answer ? <div className="max-w-prose break-words"><p className="mb-1 text-xs font-semibold text-(--brand-text-secondary)">Ricoz</p><MarkdownContent className="space-y-2 text-sm leading-7 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mb-1 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_code]:rounded [&_code]:bg-(--brand-surface-hover) [&_code]:px-1 [&_a]:text-(--brand-red) [&_a]:underline">{turn.answer}</MarkdownContent></div> : <LoaderCircle aria-label="Thinking" size={18} className="animate-spin text-(--brand-text-secondary)"/>}</article>)}<div ref={endRef}/>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">{suggestions.map((suggestion) => <button key={suggestion} type="button" disabled={sending || loading || deleting} onClick={() => void send(suggestion)} className="inline-flex max-w-full items-start gap-1.5 text-left text-xs text-(--brand-text-secondary) hover:text-(--brand-red) disabled:opacity-50"><ArrowRight size={13} className="mt-0.5 shrink-0"/><span className="break-words">{suggestion}</span></button>)}</div>
      {error ? <p role="alert" className="mt-3 text-sm text-(--status-danger)">{error}</p> : null}
      <form onSubmit={(event) => { event.preventDefault(); void send(draft); }} className="mt-4 flex items-end gap-2 rounded-lg border border-(--brand-border-strong) bg-(--brand-surface) p-3 focus-within:border-(--brand-red)"><textarea aria-label="Message Ricoz assistant" placeholder="Ask anything..." rows={2} maxLength={4000} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!sending && !loading && !deleting) void send(draft); } }} className="max-h-40 min-w-0 flex-1 resize-y bg-transparent text-sm leading-6 outline-none"/><button type="submit" title="Send message" aria-label="Send message" disabled={!draft.trim() || sending || loading || deleting} className="flex size-10 shrink-0 items-center justify-center rounded-md bg-(--brand-red) text-white disabled:opacity-40">{sending ? <LoaderCircle size={18} className="animate-spin"/> : <ArrowUp size={19}/>}</button></form>
    </section>
  </div>;
}

function SchedulePlanner() {
  const user = useAppSelector((state) => state.auth.user);
  const [workDescription, setWorkDescription] = useState(starterText);
  const [plan, setPlan] = useState<PlannerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionId] = useState("daily-planner");
  const [streamingCharacters, setStreamingCharacters] = useState(0);
  const [streamingText, setStreamingText] = useState("");
  const [history, setHistory] = useState<Awaited<ReturnType<typeof PlannerService.history>>>([]);
  useEffect(() => { let active = true; PlannerService.history().then((items) => { if (active) setHistory(items); }).catch(() => { if (active) setError("Plan history could not be loaded."); }); return () => { active = false; }; }, []);

  async function deletePlan(id: string) {
    try { await PlannerService.deleteHistory(id); setHistory((items) => items.filter((item) => item._id !== id)); }
    catch { setError("Could not delete this plan."); }
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workDescription.trim()) return;
    setLoading(true);
    setError("");
    try {
      setPlan(null);
      setStreamingCharacters(0);
      setStreamingText("");
      await PlannerService.generateStream(workDescription, sessionId, (event) => {
        if (event.event === "delta") {
          setStreamingCharacters((count) => count + event.text.length);
          setStreamingText((current) => current + event.text);
        }
        if (event.event === "plan") setPlan(event.plan);
      });
      setHistory(await PlannerService.history());
    } catch {
      setError("We couldn't generate your plan. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1180px] space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#008f69]"><span className="rounded bg-[#00b982] px-2 py-1 text-white">MOD-02 EOS</span><ArrowRight size={13} className="text-[#91a2b9]" /><span className="text-[#5c6f8d]">Daily Planner</span></div>
        <h1 className="mt-8 text-[22px] font-bold tracking-[-0.03em] text-(--brand-navy)">Daily Work Planner</h1>
        <p className="mt-1 text-sm text-[#5c6f8d]">EOS-02 · AI-powered daily planning</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_280px]">
        <form onSubmit={handleGenerate} className="rounded-[16px] border border-(--brand-border) bg-white p-5 shadow-(--shadow-xs) sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-(--brand-navy)"><Sun size={19} className="text-[#f5a400]" /> What will you work on today?</h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#5c6f8d]">Describe your planned work in plain language. FEOS AI will break it down into tasks, milestones, priorities, and a time-blocked schedule.</p>
          <textarea value={workDescription} onChange={(event) => setWorkDescription(event.target.value)} rows={6} aria-label="Describe your planned work" placeholder="List the work you want to complete today..." className="mt-3 w-full resize-none rounded-[16px] border border-[#00b982] bg-[#fbfcfe] px-4 py-4 text-sm leading-6 text-(--brand-navy) outline-none transition-shadow focus:ring-4 focus:ring-[#d8f8ed]" />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs text-[#91a2b9]">{loading ? `AI stream received ${streamingCharacters} characters` : `${workDescription.split(/\n|[,;]+/).map((item) => item.trim()).filter(Boolean).length} items detected`}</span><button type="submit" disabled={loading || !workDescription.trim()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#00b982] px-5 text-sm font-bold text-white transition hover:bg-[#009f70] disabled:cursor-not-allowed disabled:opacity-60">{loading ? <><LoaderCircle size={16} className="animate-spin" /> Generating plan...</> : <><Sparkles size={16} /> Generate Plan with AI</>}</button></div>
          {error ? <p role="alert" className="mt-4 flex items-center gap-2 text-sm font-medium text-(--status-danger)"><AlertCircle size={16} />{error}</p> : null}
          {loading && streamingText ? <div className="mt-5 rounded-xl border border-[#d8f8ed] bg-[#f5fffb] p-4" aria-live="polite"><p className="flex items-center gap-2 text-xs font-bold text-[#008f69]"><Sparkles size={14} /> FEOS AI is drafting your plan</p><p className="mt-3 max-h-36 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-[#5c6f8d]">{streamingText}<span className="ml-1 inline-block h-3 w-1 animate-pulse bg-[#00b982]" /></p></div> : null}
        </form>

        <aside className="space-y-5">
          <section className="rounded-[16px] border border-(--brand-border) bg-white p-5 shadow-(--shadow-xs)">
            <h2 className="text-sm font-bold text-(--brand-navy)">Yesterday&apos;s Summary</h2>
            <div className="mt-4 divide-y divide-(--brand-border)"><SummaryRow label="Assigned tasks" value={user ? "Ready" : "--"} /><SummaryRow label="Active focus time" value="--" /><SummaryRow label="Meetings attended" value="--" /></div>
          </section>
          <section className="rounded-[16px] bg-[#ddfaf1] p-5 text-[#006f55]"><h2 className="flex items-center gap-2 text-xs font-bold"><Sparkles size={15} /> AI Recommendation</h2><p className="mt-3 text-xs leading-5">Based on your workload patterns, protect your first focus block for the highest-priority task and leave space between meetings.</p></section>
        </aside>
      </div>

      {plan ? <GeneratedPlan plan={plan} /> : null}
      <section className="border-t border-(--brand-border) pt-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-(--brand-navy)"><History size={18} /> Plan history</h2>
        <div className="mt-3 divide-y divide-(--brand-border)">
          {history.length ? history.map((item) => <div key={item._id} className="flex items-center gap-3 py-3"><button type="button" onClick={() => setPlan(item.plan)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-semibold text-(--brand-navy)">{item.plan.summary}</span><span className="text-xs text-(--brand-text-secondary)">{new Date(item.createdAt).toLocaleString()} · Expires {new Date(item.expiresAt).toLocaleDateString()}</span></button><button type="button" title="Delete plan" aria-label="Delete plan" onClick={() => void deletePlan(item._id)} className="rounded-md p-2 text-(--status-danger) hover:bg-(--status-danger-bg)"><Trash2 size={16} /></button></div>) : <p className="py-4 text-sm text-(--brand-text-secondary)">No saved plans.</p>}
        </div>
      </section>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 py-3 text-xs"><span className="text-[#5c6f8d]">{label}</span><strong className="text-right text-(--brand-navy)">{value}</strong></div>;
}

function GeneratedPlan({ plan }: { plan: PlannerResult }) {
  return <section className="rounded-[16px] border border-[#bfeede] bg-white p-5 shadow-(--shadow-xs) sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#008f69]"><CheckCircle2 size={15} /> Plan ready</p><h2 className="mt-2 text-lg font-bold text-(--brand-navy)">{plan.summary}</h2></div><span className="rounded-full bg-[#e8faf4] px-3 py-1.5 text-xs font-bold text-[#008f69]">{Math.round(plan.totalFocusMinutes / 60)}h focus time</span></div><div className="mt-5 grid gap-3 md:grid-cols-2">{plan.blocks.map((block) => <article key={`${block.start}-${block.title}`} className="rounded-xl border border-(--brand-border) bg-[#fbfcfe] p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-(--brand-navy)">{block.title}</p><span className={`text-[10px] font-bold uppercase ${block.priority === "high" ? "text-(--status-danger)" : "text-[#008f69]"}`}>{block.priority}</span></div><p className="mt-2 text-xs leading-5 text-[#5c6f8d]">{block.detail}</p><p className="mt-3 flex items-center gap-1 text-xs font-semibold text-[#91a2b9]"><Clock3 size={13} /> {block.start} - {block.end} · {block.durationMinutes} min</p></article>)}</div><div className="mt-5 grid gap-3 border-t border-(--brand-border) pt-5 md:grid-cols-2"><div><p className="flex items-center gap-2 text-xs font-bold text-(--brand-navy)"><Lightbulb size={15} className="text-[#f5a400]" /> Recommendations</p><ul className="mt-2 space-y-2">{plan.recommendations.map((item) => <li key={item} className="flex gap-2 text-xs leading-5 text-[#5c6f8d]"><Target size={13} className="mt-1 shrink-0 text-[#00b982]" />{item}</li>)}</ul></div></div></section>;
}
