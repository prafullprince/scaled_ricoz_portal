"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { NotificationService } from "@/services/notification.service";

export function NotificationsView() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<typeof NotificationService.list>> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () => { void NotificationService.list(page).then((result) => { if (active) { setData(result); setError(""); } }).catch(() => { if (active) setError("Could not load notifications"); }); };
    refresh(); window.addEventListener("ricoz-notifications-changed", refresh);
    return () => { active = false; window.removeEventListener("ricoz-notifications-changed", refresh); };
  }, [page]);
  async function action(callback: () => Promise<void>) {
    setBusy(true); try { await callback(); } catch { toast.error("Could not update notifications"); } finally { setBusy(false); }
  }
  async function openNotification(item: NonNullable<typeof data>["notifications"][number]) {
    setBusy(true);
    try {
      await NotificationService.read(item._id);
      router.push(`/dashboard/tasks/${encodeURIComponent(item.taskId)}`);
    } catch {
      toast.error("Could not open this task. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return <section className="mx-auto max-w-4xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Notifications</h1><button disabled={busy || !data?.unread} onClick={() => void action(NotificationService.readAll)} className="flex items-center gap-2 rounded-md border border-(--brand-border) px-3 py-2 text-sm disabled:opacity-40"><CheckCheck size={17} />Mark All Read</button></header>
    {error ? <p role="alert" className="text-red-600">{error}</p> : !data ? <p role="status">Loading notifications...</p> : !data.notifications.length ? <div className="flex items-center gap-3 border-y border-(--brand-border) py-10 text-(--brand-text-secondary)"><Bell size={22} />No notifications yet.</div> : <ul className="divide-y divide-(--brand-border) border-y border-(--brand-border)">{data.notifications.map((item) => <li key={item._id} className={`flex items-start gap-3 p-4 ${!item.readAt ? "bg-emerald-500/5" : ""}`}><span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : "bg-emerald-600"}`} /><button type="button" disabled={busy} onClick={() => void openNotification(item)} className="min-w-0 flex-1 text-left disabled:opacity-50"><h2 className="break-words text-sm font-semibold">{item.title}</h2><p className="mt-1 text-sm text-(--brand-text-secondary)">{item.message}</p><time className="mt-2 block text-xs text-(--brand-text-secondary)">{new Date(item.createdAt).toLocaleString()}</time></button><button aria-label={`Delete notification for ${item.title}`} title="Delete notification" disabled={busy} onClick={() => void action(() => NotificationService.remove(item._id))} className="rounded-md p-2 hover:bg-(--brand-surface-hover)"><Trash2 size={16} /></button></li>)}</ul>}
    <footer className="flex items-center justify-end gap-3 text-sm"><button aria-label="Previous page" title="Previous page" disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded-md border border-(--brand-border) p-2 disabled:opacity-30"><ChevronLeft size={16} /></button><span>Page {page} of {Math.max(1, data?.pagination.totalPages ?? 1)}</span><button aria-label="Next page" title="Next page" disabled={!data || page >= data.pagination.totalPages} onClick={() => setPage(page + 1)} className="rounded-md border border-(--brand-border) p-2 disabled:opacity-30"><ChevronRight size={16} /></button></footer>
  </section>;
}