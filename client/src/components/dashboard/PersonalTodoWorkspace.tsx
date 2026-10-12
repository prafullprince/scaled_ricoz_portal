"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Clock3, LoaderCircle, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { MarkdownContent } from "@/components/dashboard/MarkdownContent";
import { TaskService, type PersonalTodo, type PersonalTodoAction, type PersonalTodoHistoryEvent, type PersonalTodoStatus } from "@/services/task.service";

type TodoView = "ACTIVE" | "HISTORY";
type DescriptionView = "WRITE" | "PREVIEW";

const inputClass = "mt-1.5 h-11 w-full rounded-xl border border-[#dce4ef] bg-white px-3.5 text-sm font-medium text-[#26364f] outline-none transition placeholder:font-normal placeholder:text-[#94a1b5] hover:border-[#c1cfe0] focus:border-[#4f78bd] focus:ring-4 focus:ring-[#4f78bd]/10";
const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
const actionLabels: Record<PersonalTodoAction, string> = {
  CREATED: "Created",
  EDITED: "Edited",
  COMPLETED: "Marked complete",
  DELETED: "Deleted",
};

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00.000Z`));
}

function displayTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusStyle(status: PersonalTodoStatus) {
  if (status === "COMPLETED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "DELETED") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

export function PersonalTodoWorkspace({ view }: { view: TodoView }) {
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalHistory, setTotalHistory] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState(today);
  const [editingId, setEditingId] = useState("");
  const [descriptionView, setDescriptionView] = useState<DescriptionView>("WRITE");
  const [expandedHistoryId, setExpandedHistoryId] = useState("");

  useEffect(() => {
    let active = true;
    const load = view === "ACTIVE"
      ? TaskService.myTodos().then((items) => {
          if (active) setTodos(items);
        })
      : TaskService.myTodoHistory(page).then((result) => {
          if (!active) return;
          setTodos(result.todos);
          setTotalPages(result.pagination.totalPages);
          setTotalHistory(result.pagination.total);
          if (result.pagination.page !== page) setPage(result.pagination.page);
        });
    load.catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Your TODOs could not be loaded.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [page, view]);

  function changePage(nextPage: number) {
    setError("");
    setLoading(true);
    setPage(nextPage);
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setDeadline(today());
    setEditingId("");
    setDescriptionView("WRITE");
  }

  function editTodo(todo: PersonalTodo) {
    setTitle(todo.title);
    setDescription(todo.description);
    setDeadline(todo.deadline);
    setEditingId(todo.id);
    setDescriptionView("WRITE");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyId(editingId || "create");
    setError("");
    try {
      const input = { title: title.trim(), description: description.trim(), deadline };
      if (editingId) {
        const updated = await TaskService.updateMyTodo(editingId, input);
        setTodos((items) => items.map((item) => item.id === updated.id ? updated : item));
      } else {
        const created = await TaskService.createMyTodo(input);
        setTodos((items) => [...items, created].sort((left, right) => left.deadline.localeCompare(right.deadline)));
      }
      resetForm();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The TODO could not be saved.");
    } finally {
      setBusyId("");
    }
  }

  async function completeTodo(todo: PersonalTodo) {
    setBusyId(todo.id);
    setError("");
    try {
      await TaskService.completeMyTodo(todo.id);
      setTodos((items) => items.filter((item) => item.id !== todo.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The TODO could not be completed.");
    } finally {
      setBusyId("");
    }
  }

  async function deleteTodo(todo: PersonalTodo) {
    if (!window.confirm(`Delete “${todo.title}”? It will disappear from your calendar but remain in TODO History.`)) return;
    setBusyId(todo.id);
    setError("");
    try {
      await TaskService.deleteMyTodo(todo.id);
      setTodos((items) => items.filter((item) => item.id !== todo.id));
      if (editingId === todo.id) resetForm();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The TODO could not be deleted.");
    } finally {
      setBusyId("");
    }
  }

  const activeCount = view === "ACTIVE" ? todos.length : 0;
  return <section className="space-y-5">
    <header className="relative isolate overflow-hidden rounded-3xl border border-[#dce6f7] bg-[linear-gradient(115deg,#f2f6ff_0%,#fff_52%,#edf8ff_100%)] p-5 shadow-[0_12px_35px_-28px_rgba(28,58,112,0.38)] sm:p-7">
      <div aria-hidden="true" className="absolute -right-12 -top-24 -z-10 size-72 rounded-full bg-[#dceaff]/70 blur-3xl"/>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white bg-white text-[#315aa4] shadow-sm"><ClipboardList size={21}/></span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4169ad]">Personal planning · My Work</p>
            <h2 className="mt-1.5 text-lg font-bold tracking-tight text-[#17233a] sm:text-xl">{view === "ACTIVE" ? "Your TODOs" : "TODO History"}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#657795]">{view === "ACTIVE" ? "Capture personal work, format details with Markdown, and keep deadlines visible on your calendar." : "A paginated activity record of your TODOs, including edits, completion, and deletion."}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/90 bg-white/80 px-4 py-3 text-center shadow-sm backdrop-blur">
          <p className="text-xl font-bold tabular-nums text-[#17233a]">{view === "ACTIVE" ? activeCount : totalHistory}</p>
          <p className="mt-0.5 text-[10px] font-semibold text-[#7183a0]">{view === "ACTIVE" ? "Open TODOs" : "History records"}</p>
        </div>
      </div>
    </header>

    {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

    {view === "ACTIVE" ? <div className="grid items-start gap-5 xl:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.18fr)]">
      <form onSubmit={(event) => void saveTodo(event)} className="space-y-4 rounded-2xl border border-[#e3eaf3] bg-white p-5 shadow-[0_12px_35px_-30px_rgba(24,43,77,0.42)] sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4169ad]">{editingId ? "Update your task" : "Make a little progress"}</p>
            <h3 className="mt-1 text-base font-bold tracking-tight text-[#17233a]">{editingId ? "Edit TODO" : "Create a TODO"}</h3>
          </div>
          {editingId ? <button type="button" onClick={resetForm} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#657795] hover:bg-slate-100"><X size={13}/>Cancel</button> : null}
        </div>
        <label className="block text-xs font-semibold text-[#465875]">Title <span className="text-rose-600">*</span>
          <input required autoComplete="off" maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder="What do you need to do?"/>
        </label>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-[#465875]">Description <span className="text-rose-600">*</span></span>
            <div className="flex rounded-lg border border-[#e0e7f0] bg-[#f7f9fc] p-0.5">
              {(["WRITE", "PREVIEW"] as const).map((mode) => <button key={mode} type="button" aria-pressed={descriptionView === mode} onClick={() => setDescriptionView(mode)} className={`rounded-md px-2.5 py-1 text-[10px] font-bold transition ${descriptionView === mode ? "bg-white text-[#315aa4] shadow-sm" : "text-[#7d8ba0] hover:text-[#43516a]"}`}>{mode === "WRITE" ? "Write" : "Preview"}</button>)}
            </div>
          </div>
          {descriptionView === "WRITE" ? <textarea required minLength={1} maxLength={4_000} value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-40 w-full resize-y rounded-xl border border-[#dce4ef] bg-white px-3.5 py-3 text-sm leading-6 text-[#26364f] outline-none transition placeholder:text-[#94a1b5] hover:border-[#c1cfe0] focus:border-[#4f78bd] focus:ring-4 focus:ring-[#4f78bd]/10" placeholder={"Add helpful context. Markdown is supported.\n\n- Use lists\n- **Emphasize** key points"}/> : <div className="min-h-40 rounded-xl border border-[#dce4ef] bg-[#fbfcfe] px-3.5 py-3 text-sm leading-6 text-[#26364f]">{description.trim() ? <MarkdownContent>{description}</MarkdownContent> : <p className="text-[#94a1b5]">Your formatted description preview will appear here.</p>}</div>}
          <p className="mt-1.5 text-right text-[10px] text-[#8290a5]">{description.length.toLocaleString()} / 4,000</p>
        </div>
        <label className="block text-xs font-semibold text-[#465875]">Deadline <span className="text-rose-600">*</span>
          <input required type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className={inputClass}/>
        </label>
        <button type="submit" disabled={Boolean(busyId)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1645a2] to-[#245bc0] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_-10px_rgba(22,69,162,0.8)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_22px_-12px_rgba(22,69,162,0.9)] disabled:translate-y-0 disabled:opacity-50">
          {busyId ? <LoaderCircle size={16} className="animate-spin"/> : editingId ? <Save size={16}/> : <Plus size={16}/>}
          {busyId ? "Saving…" : editingId ? "Save changes" : "Add TODO"}
        </button>
      </form>

      <section className="space-y-3 rounded-2xl border border-[#e3eaf3] bg-white p-5 shadow-[0_12px_35px_-30px_rgba(24,43,77,0.42)] sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-[#edf1f6] pb-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4169ad]">Your list</p><h3 className="mt-0.5 text-sm font-bold text-[#17233a]">Open TODOs</h3></div>
          <span className="rounded-full border border-[#e6ebf3] bg-[#f7f9fc] px-2.5 py-1 text-xs font-semibold tabular-nums text-[#52627a]">{todos.length}</span>
        </div>
        {loading ? <p role="status" className="flex items-center gap-2 py-8 text-sm text-[#7183a0]"><LoaderCircle size={16} className="animate-spin"/>Loading TODOs…</p>
          : todos.length ? <ul className="space-y-3">{todos.map((todo) => <li key={todo.id} className="rounded-2xl border border-[#e8edf4] bg-white p-4 transition hover:border-[#cbd8eb] hover:shadow-[0_8px_24px_-20px_rgba(24,43,77,0.6)]">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#eef3ff] text-[#4169ad]"><ClipboardList size={16}/></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h4 className="min-w-0 flex-1 text-sm font-bold text-[#17233a]">{todo.title}</h4>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700"><CalendarDays size={12}/>{displayDate(todo.deadline)}</span>
                </div>
                <MarkdownContent className="mt-2 break-words text-xs leading-5 text-[#657795]">{todo.description}</MarkdownContent>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-[#edf1f6] pt-3">
              <button type="button" onClick={() => editTodo(todo)} disabled={Boolean(busyId)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dce4ef] bg-white px-2.5 text-[11px] font-semibold text-[#52627a] hover:bg-[#f7f9fc] disabled:opacity-50"><Pencil size={12}/>Edit</button>
              <button type="button" onClick={() => void completeTodo(todo)} disabled={Boolean(busyId)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">{busyId === todo.id ? <LoaderCircle size={12} className="animate-spin"/> : <Check size={12}/>}Mark complete</button>
              <button type="button" onClick={() => void deleteTodo(todo)} disabled={Boolean(busyId)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={12}/>Delete</button>
            </div>
          </li>)}</ul>
          : <div className="rounded-2xl border border-dashed border-[#d5dfed] bg-[#fafbfe] px-5 py-12 text-center"><span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#eef3ff] text-[#5575b0]"><CheckCircle2 size={21}/></span><p className="mt-3 text-sm font-semibold text-[#34445f]">Nothing on your list</p><p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-[#7183a0]">Create a TODO to keep a personal deadline on your calendar.</p></div>}
      </section>
    </div> : <section className="space-y-3 rounded-2xl border border-[#e3eaf3] bg-white p-5 shadow-[0_12px_35px_-30px_rgba(24,43,77,0.42)] sm:p-6">
      <div className="flex items-center justify-between gap-3 border-b border-[#edf1f6] pb-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4169ad]">Personal archive</p><h3 className="mt-0.5 text-sm font-bold text-[#17233a]">TODO activity</h3></div>
        <span className="rounded-full border border-[#e6ebf3] bg-[#f7f9fc] px-2.5 py-1 text-xs font-semibold tabular-nums text-[#52627a]">{totalHistory}</span>
      </div>
      {loading ? <p role="status" className="flex items-center gap-2 py-8 text-sm text-[#7183a0]"><LoaderCircle size={16} className="animate-spin"/>Loading TODO history…</p>
        : todos.length ? <ul className="space-y-3">{todos.map((todo) => <li key={todo.id} className="rounded-2xl border border-[#e8edf4] bg-white p-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-bold text-[#17233a]">{todo.title}</h4><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusStyle(todo.status)}`}>{todo.status.replaceAll("_", " ")}</span></div>
              <MarkdownContent className="mt-2 break-words text-xs leading-5 text-[#657795]">{todo.description}</MarkdownContent>
              <p className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-medium text-[#8290a5]"><CalendarDays size={12}/>Deadline {displayDate(todo.deadline)}<span className="px-1">·</span>Updated {displayTimestamp(todo.updatedAt)}</p>
            </div>
            <button type="button" aria-expanded={expandedHistoryId === todo.id} onClick={() => setExpandedHistoryId((current) => current === todo.id ? "" : todo.id)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#dce4ef] bg-white px-3 text-xs font-semibold text-[#52627a] transition hover:bg-[#f7f9fc]"><Clock3 size={13}/>{expandedHistoryId === todo.id ? "Hide activity" : `View activity · ${todo.history.length}`}</button>
          </div>
          {expandedHistoryId === todo.id ? <ol className="mt-4 space-y-0 border-l border-[#dce5f1] pl-4">
            {[...todo.history].reverse().map((event, index) => <HistoryEvent key={`${event.action}-${event.createdAt}-${index}`} event={event}/>)}
          </ol> : null}
        </li>)}</ul>
        : <div className="rounded-2xl border border-dashed border-[#d5dfed] bg-[#fafbfe] px-5 py-12 text-center"><span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#eef3ff] text-[#5575b0]"><Clock3 size={20}/></span><p className="mt-3 text-sm font-semibold text-[#34445f]">No TODO history yet</p><p className="mt-1 text-xs leading-5 text-[#7183a0]">Created, edited, completed, and deleted TODOs will be recorded here.</p></div>}
      {!loading && totalPages > 1 ? <nav aria-label="TODO history pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf1f6] pt-4">
        <p className="text-xs text-[#7183a0]">Page {page} of {totalPages}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => changePage(Math.max(1, page - 1))} disabled={page <= 1} className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#dce4ef] px-3 text-xs font-semibold text-[#52627a] hover:bg-[#f7f9fc] disabled:cursor-not-allowed disabled:opacity-45"><ChevronLeft size={14}/>Previous</button>
          <button type="button" onClick={() => changePage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#dce4ef] px-3 text-xs font-semibold text-[#52627a] hover:bg-[#f7f9fc] disabled:cursor-not-allowed disabled:opacity-45">Next<ChevronRight size={14}/></button>
        </div>
      </nav> : null}
    </section>}
  </section>;
}

function HistoryEvent({ event }: { event: PersonalTodoHistoryEvent }) {
  return <li className="relative border-b border-[#edf1f6] pb-4 pl-2 pt-1 last:border-0 last:pb-0">
    <span className="absolute -left-[21px] top-2 size-2.5 rounded-full border-2 border-white bg-[#5578ba] ring-1 ring-[#c8d6e9]"/>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs font-bold text-[#34445f]">{actionLabels[event.action]}</p>
      <time className="text-[10px] text-[#8290a5]">{displayTimestamp(event.createdAt)}</time>
    </div>
    {event.action === "EDITED" ? <div className="mt-2 rounded-lg bg-[#f7f9fc] p-3">
      <p className="text-[11px] font-semibold text-[#52627a]">Saved version · Due {displayDate(event.deadline)}</p>
      <MarkdownContent className="mt-1 text-xs leading-5 text-[#657795]">{event.description}</MarkdownContent>
    </div> : null}
  </li>;
}
