"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { CalendarDays, Check, CheckCircle2, Clock3, ListChecks, Plus, RotateCcw, Save, Search, Settings2, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { taskPriorityTier } from "@/lib/task-priority";
import { TaskService } from "@/services/task.service";
import { MarkdownContent } from "@/components/dashboard/MarkdownContent";
import styles from "./MyWorkInbox.module.css";

export type MyWorkKind = "TASK" | "APPROVAL" | "MEETING";

export type MyWorkItem = {
  id: string;
  title: string;
  description: string;
  kind: MyWorkKind;
  priority?: string;
  dueAt?: string | null;
  tags?: string[];
  actionLabel?: string;
  href?: string;
  onAction?: () => void;
  markDoneLabel?: string;
  onMarkDone?: () => Promise<void>;
};

type Filter = "ALL" | "APPROVALS" | "TASKS" | "MEETINGS" | `PRIORITY:${string}`;
type PriorityCategory = { key: string; label: string; enabled: boolean; builtIn: boolean };

const defaultPriorityCategories: PriorityCategory[] = [
  { key: "BUILTIN:P1", label: "P1 Urgent", enabled: true, builtIn: true },
  { key: "BUILTIN:P2", label: "P2 High", enabled: true, builtIn: true },
  { key: "BUILTIN:P3", label: "P3 Normal", enabled: true, builtIn: true },
];

const workFilters: Array<{ id: Filter; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "APPROVALS", label: "Approvals" },
  { id: "TASKS", label: "Tasks" },
  { id: "MEETINGS", label: "Meetings" },
];
const workTimeZone = "Asia/Kolkata";
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: workTimeZone, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFormatter = new Intl.DateTimeFormat("en-IN", { timeZone: workTimeZone, hour: "numeric", minute: "2-digit" });
const timePartsFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: workTimeZone, hour: "2-digit", minute: "2-digit" });
const dateFormatter = new Intl.DateTimeFormat("en-IN", { timeZone: workTimeZone, day: "numeric", month: "short" });

const priorityKey = (item: MyWorkItem) => `${item.kind}:${item.id}:${(item.tags?.[0] ?? "").toLocaleLowerCase("en")}`;
function priorityForItem(item: MyWorkItem, categories: PriorityCategory[]) {
  const tier = taskPriorityTier(item.priority);
  if (tier) return `BUILTIN:${tier}`;
  const label = item.priority?.trim().toLocaleLowerCase("en");
  return label ? categories.find((category) => category.enabled && category.label.toLocaleLowerCase("en") === label)?.key ?? "" : "";
}

function effectivePriority(item: MyWorkItem, overrides: Record<string, string>, categories: PriorityCategory[]) {
  const selected = overrides[priorityKey(item)] ?? priorityForItem(item, categories);
  return categories.some((category) => category.key === selected && category.enabled) ? selected : "";
}

function dateLabel(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const now = new Date();
  const dayKey = (input: Date) => dayKeyFormatter.format(input);
  const [year, month, day] = dayKey(date).split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = dayKey(now).split("-").map(Number);
  const dayOffset = (Date.UTC(year!, month! - 1, day!) - Date.UTC(todayYear!, todayMonth! - 1, todayDay!)) / 86_400_000;
  const clock = timeFormatter.format(date);
  const timeParts = Object.fromEntries(timePartsFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  const hasTime = timeParts.hour !== "00" || timeParts.minute !== "00";
  const label = dayOffset === 0 ? "Today" : dayOffset === 1 ? "Tomorrow" : dateFormatter.format(date);
  return { text: `${label}${hasTime ? ` ${clock}` : ""}`, overdue: dayOffset < 0 };
}

export function MyWorkInbox({ items, loading = false, error }: { items: MyWorkItem[]; loading?: boolean; error?: string }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<PriorityCategory[]>(defaultPriorityCategories);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [managePriorities, setManagePriorities] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({});
  const uniqueItems = useMemo(() => [...new Map(items.map((item) => [`${item.kind}:${item.id}:${(item.tags?.[0] ?? "").toLocaleLowerCase("en")}`, item])).values()], [items]);
  const activeCategories = useMemo(() => categories.filter((category) => category.enabled), [categories]);

  useEffect(() => {
    let active = true;
    TaskService.myWorkPriorities()
      .then(({ categories: savedCategories, overrides: savedOverrides }) => {
        if (!active) return;
        setCategories(savedCategories);
        setOverrides(Object.fromEntries(savedOverrides.map(({ itemKey, priorityKey: selectedKey }) => [itemKey, selectedKey])));
      })
      .catch(() => {
        if (active) toast.error("Your personal priority settings could not be loaded.");
      });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return uniqueItems.filter((item) => {
      const priority = effectivePriority(item, overrides, categories);
      const matchesSearch = !query || `${item.title} ${item.description} ${(item.tags ?? []).join(" ")}`.toLowerCase().includes(query);
      const matchesFilter = filter === "ALL"
        || (filter.startsWith("PRIORITY:") && priority === filter.slice(9))
        || (filter === "APPROVALS" && item.kind === "APPROVAL")
        || (filter === "TASKS" && item.kind === "TASK")
        || (filter === "MEETINGS" && item.kind === "MEETING");
      return matchesSearch && matchesFilter;
    }).sort((left, right) => {
      const rank = (priority: string) => {
        const index = activeCategories.findIndex((category) => category.key === priority);
        return index < 0 ? Number.MAX_SAFE_INTEGER : index;
      };
      const priorityDifference = rank(effectivePriority(left, overrides, categories)) - rank(effectivePriority(right, overrides, categories));
      if (priorityDifference !== 0) return priorityDifference;
      return new Date(left.dueAt ?? "9999-12-31").getTime() - new Date(right.dueAt ?? "9999-12-31").getTime();
    });
  }, [activeCategories, categories, filter, overrides, search, uniqueItems]);

  async function changePriority(item: MyWorkItem, selectedKey: string) {
    const key = priorityKey(item);
    setBusyId(key);
    try {
      if (selectedKey) {
        await TaskService.setMyWorkPriority(key, selectedKey);
        setOverrides((current) => ({ ...current, [key]: selectedKey }));
      } else {
        await TaskService.resetMyWorkPriority(key);
        setOverrides((current) => { const next = { ...current }; delete next[key]; return next; });
      }
    } catch {
      toast.error("Could not update your personal priority. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = newCategory.trim();
    if (!label) return;
    try {
      const saved = await TaskService.addMyWorkPriorityCategory(label);
      const added: PriorityCategory = { ...saved, enabled: true, builtIn: saved.key.startsWith("BUILTIN:") };
      setCategories((current) => current.some((item) => item.key === saved.key)
        ? current.map((item) => item.key === saved.key ? added : item)
        : [...current, added]);
      setNewCategory("");
      toast.success("Personal priority added");
    } catch {
      toast.error("Could not add that priority. It may already exist or use a reserved name.");
    }
  }

  async function editCategory(category: PriorityCategory) {
    const label = (categoryDrafts[category.key] ?? category.label).trim();
    if (!label || label === category.label) return;
    try {
      const saved = await TaskService.editMyWorkPriorityCategory(category.key, label);
      setCategories((current) => current.map((item) => item.key === category.key ? { ...item, label: saved.label } : item));
      setCategoryDrafts((current) => { const next = { ...current }; delete next[category.key]; return next; });
      toast.success("Priority category updated");
    } catch {
      toast.error("Could not update the priority name. It may already be in use.");
    }
  }

  async function removeCategory(category: PriorityCategory) {
    try {
      await TaskService.deleteMyWorkPriorityCategory(category.key);
      setCategories((current) => category.builtIn
        ? current.map((item) => item.key === category.key ? { ...item, enabled: false } : item)
        : current.filter((item) => item.key !== category.key));
      setOverrides((current) => Object.fromEntries(Object.entries(current).filter(([, selectedKey]) => selectedKey !== category.key)));
      if (filter === `PRIORITY:${category.key}`) setFilter("ALL");
      toast.success("Priority category removed");
    } catch {
      toast.error("Could not remove this personal priority.");
    }
  }

  async function restoreCategory(category: PriorityCategory) {
    try {
      const restored = await TaskService.restoreMyWorkPriorityCategory(category.key);
      setCategories((current) => current.map((item) => item.key === category.key ? { ...item, label: restored.label, enabled: true } : item));
      toast.success("Built-in priority restored");
    } catch {
      toast.error("Could not restore this priority.");
    }
  }

  async function markDone(item: MyWorkItem) {
    if (!item.onMarkDone) return;
    setBusyId(item.id);
    try {
      await item.onMarkDone();
      toast.success("Work updated");
    } catch {
      toast.error("Could not update this item. Check its workflow and try again.");
    } finally {
      setBusyId(null);
    }
  }

  return <section className={styles.inbox} aria-labelledby="my-work-heading">
    <header className={styles.header}>
      <div><h2 id="my-work-heading">My Work <span>{uniqueItems.length}</span></h2><p>Your personal action list across tasks, reviews and scheduled work. Priority changes here are personal to you.</p></div>
      <label className={styles.search}><span className="sr-only">Search My Work</span><Search size={16} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks, approvals..." /></label>
    </header>
    <nav className={styles.tabs} aria-label="Filter My Work">
      {workFilters.flatMap(({ id, label }) => {
        const count = id === "ALL" ? uniqueItems.length
          : id === "APPROVALS" ? uniqueItems.filter((item) => item.kind === "APPROVAL").length
          : id === "TASKS" ? uniqueItems.filter((item) => item.kind === "TASK").length
          : uniqueItems.filter((item) => item.kind === "MEETING").length;
        const button = <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label} <span>{count}</span></button>;
        return id === "ALL" ? [button, ...activeCategories.filter((category) => category.builtIn).map((category) => <button key={`PRIORITY:${category.key}`} type="button" aria-pressed={filter === `PRIORITY:${category.key}`} onClick={() => setFilter(`PRIORITY:${category.key}`)}>{category.label} <span>{uniqueItems.filter((item) => effectivePriority(item, overrides, categories) === category.key).length}</span></button>)] : [button];
      })}
      {activeCategories.filter((category) => !category.builtIn).map((category) => <button key={`PRIORITY:${category.key}`} type="button" aria-pressed={filter === `PRIORITY:${category.key}`} onClick={() => setFilter(`PRIORITY:${category.key}`)}>{category.label} <span>{uniqueItems.filter((item) => effectivePriority(item, overrides, categories) === category.key).length}</span></button>)}
    </nav>
    <div className={styles.priorityTools}>
      <button type="button" className={styles.manageButton} aria-expanded={managePriorities} onClick={() => setManagePriorities((open) => !open)}><Settings2 size={14} />{managePriorities ? "Done" : "Manage personal priorities"}</button>
      {managePriorities && <div className={styles.priorityManager}>
        <header className={styles.priorityManagerHeader}>
          <div><h3>Priority categories</h3><p>Personal labels for organizing your My Work list. Shared task assignments are unchanged.</p></div>
          <span>{activeCategories.length} active</span>
        </header>
        <form onSubmit={(event) => void addCategory(event)} className={styles.categoryForm}>
          <label className="sr-only" htmlFor="my-work-priority-category">New personal priority</label>
          <input id="my-work-priority-category" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} maxLength={40} placeholder="Create a custom priority, e.g. Client blocker" />
          <button type="submit" disabled={!newCategory.trim()}><Plus size={14} />Add</button>
        </form>
        <div className={styles.categoryList}>
          {categories.map((category) => <div className={`${styles.categoryRow} ${!category.enabled ? styles.categoryDisabled : ""}`} key={category.key}>
            <span className={`${styles.categoryKind} ${category.builtIn ? styles.builtInKind : styles.customKind}`}>{category.builtIn ? "Built-in" : "Custom"}</span>
            {category.enabled
              ? <><label className="sr-only" htmlFor={`priority-category-${category.key}`}>Edit {category.label}</label><input id={`priority-category-${category.key}`} value={categoryDrafts[category.key] ?? category.label} onChange={(event) => setCategoryDrafts((current) => ({ ...current, [category.key]: event.target.value }))} maxLength={40} /><button type="button" className={styles.saveCategory} title="Save name" aria-label={`Save ${category.label} priority name`} onClick={() => void editCategory(category)} disabled={!((categoryDrafts[category.key] ?? category.label).trim()) || (categoryDrafts[category.key] ?? category.label).trim() === category.label}><Save size={14} />Save</button><button type="button" className={styles.removeCategory} title="Delete priority" aria-label={`Delete ${category.label} priority`} onClick={() => void removeCategory(category)}><Trash2 size={14} /></button></>
              : <><span className={styles.deletedCategory}>{category.label}<small>Removed from My Work</small></span><button type="button" className={styles.restoreCategory} onClick={() => void restoreCategory(category)}><RotateCcw size={14} />Restore</button></>}
          </div>)}
        </div>
      </div>}
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {loading && <p className={styles.empty} role="status">Loading your work…</p>}
    {!loading && visible.length > 0 && <div className={styles.items}>
      {visible.map((item) => {
        const Icon = item.kind === "MEETING" ? CalendarDays : item.kind === "APPROVAL" ? ShieldCheck : ListChecks;
        const due = dateLabel(item.dueAt);
        const priority = effectivePriority(item, overrides, categories);
        const category = categories.find((candidate) => candidate.key === priority);
        const tier = priority.startsWith("BUILTIN:") ? priority.slice(8) : null;
        const priorityClass = tier === "P1" ? styles.priorityP1 : tier === "P2" ? styles.priorityP2 : tier === "P3" ? styles.priorityP3 : styles.priorityCustom;
        const key = priorityKey(item);
        const selectedDefault = priorityForItem(item, categories);
        const selectedDefaultLabel = categories.find((candidate) => candidate.key === selectedDefault)?.label;
        const priorityOptions = activeCategories;
        return <article key={item.id} className={styles.card}>
          <div className={`${styles.itemIcon} ${item.kind === "MEETING" ? styles.meetingIcon : item.kind === "APPROVAL" ? styles.approvalIcon : styles.taskIcon}`}><Icon size={17} /></div>
          <div className={styles.content}>
            <div className={styles.titleLine}>
              <div className={styles.titleGroup}>
                {priority && <span className={`${styles.priority} ${priorityClass}`}>{category?.label}</span>}
                <h3>{item.title}</h3>
              </div>
              {due && <span className={`${styles.due} ${due.overdue ? styles.overdue : tier === "P1" ? styles.dueUrgent : ""}`}><Clock3 size={12} />{due.text}</span>}
            </div>
            {item.description && <MarkdownContent className={styles.description}>{item.description}</MarkdownContent>}
            {Boolean(item.tags?.length) && <div className={styles.tags}>{item.tags?.map((tag) => <span key={tag}>{tag}</span>)}</div>}
            <div className={styles.actions}>
              <label className={styles.priorityControl}><span>My priority</span><select aria-label={`Change your priority for ${item.title}`} value={overrides[key] ?? ""} disabled={busyId === key} onChange={(event) => void changePriority(item, event.target.value)}><option value="">Use assigned default{selectedDefaultLabel ? ` (${selectedDefaultLabel})` : ""}</option>{priorityOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
              {item.href
                ? <Link className={styles.primaryButton} href={item.href}>{item.actionLabel ?? "Take Action"} <span aria-hidden="true">→</span></Link>
                : <button type="button" className={styles.primaryButton} onClick={item.onAction}>{item.actionLabel ?? "Take Action"} <span aria-hidden="true">→</span></button>}
              {item.onMarkDone && <button type="button" className={styles.secondaryButton} disabled={busyId === item.id} onClick={() => void markDone(item)}><CheckCircle2 size={13} />{busyId === item.id ? "Saving..." : item.markDoneLabel ?? "Mark Done"}</button>}
            </div>
          </div>
        </article>;
      })}
    </div>}
    {!loading && !visible.length && <div className={styles.empty}><Check size={17} /><p>{uniqueItems.length ? "No work matches this filter." : "You’re all caught up. New tasks and meetings will show up here."}</p></div>}
  </section>;
}
