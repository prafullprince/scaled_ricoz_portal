"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { Camera, ChevronLeft, ChevronRight, CircleDashed, Eye, LoaderCircle, Pause, Pencil, Play, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { ChatService, type ChatStory, type StoryView } from "@/services/chat.service";
import { useAppSelector } from "@/redux/hooks";
import { Avatar } from "./Avatar";
import styles from "./ChatWorkspace.module.css";
import { ChatThemeToggle } from "./ChatThemeToggle";
import type { ChatTheme } from "@/lib/chat/theme";

const backgrounds = ["#254d43", "#51436b", "#755149", "#284b63", "#333333"];

export function StatusWorkspace({ theme, onThemeChange }: { theme: ChatTheme; onThemeChange: (theme: ChatTheme) => void }) {
  const user = useAppSelector((state) => state.auth.user);
  const [stories, setStories] = useState<ChatStory[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [composing, setComposing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const loadedOlder = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    ChatService.stories(undefined, controller.signal).then((data) => {
      setStories((current) => loadedOlder.current ? [...data.stories, ...current.filter((story) => +new Date(story.expiresAt) > Date.now() && !data.stories.some((item) => item._id === story._id))] : data.stories);
      if (!loadedOlder.current) setCursor(data.nextCursor);
      setError(false);
    }).catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    const timer = setInterval(() => setRefresh((value) => value + 1), 30_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [refresh]);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const data = await ChatService.stories(cursor);
      loadedOlder.current = true;
      setStories((current) => [...current, ...data.stories.filter((story) => !current.some((item) => item._id === story._id))]);
      setCursor(data.nextCursor);
    } catch { setError(true); } finally { setLoading(false); }
  }

  const grouped = new Map<string, ChatStory[]>();
  stories.forEach((story) => grouped.set(story.authorId._id, [...(grouped.get(story.authorId._id) ?? []), story]));
  const own = grouped.get(user?.user_id ?? "") ?? [];
  const selected = stories.find((story) => story._id === selectedId);
  const sequence = selected ? grouped.get(selected.authorId._id) ?? [] : [];
  const position = sequence.findIndex((story) => story._id === selectedId);
  const next = () => setSelectedId(sequence[position + 1]?._id ?? null);

  return <div className={styles.activity}>
    <aside className={styles.activityList} aria-label="Statuses">
      <header className={styles.activityHeader}><h1>Status</h1><div className="flex items-center gap-1"><ChatThemeToggle className={styles.activityThemeToggle} theme={theme} onChange={onThemeChange} /><button className={styles.iconButton} onClick={() => setComposing(true)} aria-label="Add status" title="Add status"><Plus size={22} /></button></div></header>
      <div className={styles.activityBody}>
        <div className="flex items-center">
          <button className={styles.activityRow} onClick={() => own.length ? setSelectedId(own[0]._id) : setComposing(true)}>
            <span className={`${styles.storyRing} ${own.length ? "" : styles.viewedRing}`}><Avatar name={user?.user_name ?? "My status"} /></span>
            <span className="min-w-0 flex-1"><p>My status</p><p className={styles.muted}>{own.length ? `${own.length} ${own.length === 1 ? "update" : "updates"}` : "No updates yet"}</p></span>
          </button>
          {own.length ? <button className={styles.iconButton} onClick={() => setComposing(true)} aria-label="Add another status" title="Add another status"><Plus size={20} /></button> : null}
        </div>
        <p className="px-3 pb-2 pt-7 text-xs text-[#a1a7a3]">Recent updates</p>
        {[...grouped.entries()].filter(([id]) => id !== user?.user_id).map(([id, updates]) => <button key={id} className={styles.activityRow} onClick={() => setSelectedId(updates.find((story) => !story.viewed)?._id ?? updates[0]._id)}>
          <span className={`${styles.storyRing} ${updates.every((story) => story.viewed) ? styles.viewedRing : ""}`}><Avatar name={updates[0].authorId.name} src={updates[0].authorId.profile_pic} /></span>
          <span className="min-w-0 flex-1"><p>{updates[0].authorId.name}</p><p className={styles.muted}>{new Date(updates[0].createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · {updates.length} updates</p></span>
        </button>)}
        {!loading && !error && grouped.size <= (own.length ? 1 : 0) ? <p className="px-3 py-8 text-sm text-[#a1a7a3]">No recent updates</p> : null}
        {loading ? <LoaderCircle className="mx-auto my-6 animate-spin" aria-label="Loading statuses" /> : null}
        {error ? <button className={styles.activityRow} onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={18} /> Could not load statuses. Retry</button> : null}
        {cursor ? <button disabled={loading} className={styles.activityRow} onClick={() => void loadMore()}>Load more updates</button> : null}
      </div>
    </aside>
    <section className={styles.activityEmpty}><CircleDashed size={56} className="text-[#626a65]" /><h2>Status</h2><div className="flex gap-6"><button className={styles.iconButton} onClick={() => setComposing(true)} title="Text status" aria-label="Text status"><Pencil size={22} /></button><button className={styles.iconButton} onClick={() => setComposing(true)} title="Photo or video status" aria-label="Photo or video status"><Camera size={22} /></button></div></section>
    {composing ? <StatusComposer onClose={() => setComposing(false)} onPublished={() => { setComposing(false); setRefresh((value) => value + 1); }} /> : null}
    {selected ? <StoryViewer key={selected._id} story={selected} own={selected.authorId._id === user?.user_id} count={sequence.length} position={position}
      onClose={() => { setSelectedId(null); setRefresh((value) => value + 1); }} onNext={next} onPrevious={() => setSelectedId(sequence[position - 1]?._id ?? selected._id)}
      onViewed={() => setStories((current) => current.map((story) => story._id === selected._id ? { ...story, viewed: true } : story))}
      onDeleted={() => { setStories((current) => current.filter((story) => story._id !== selected._id)); setSelectedId(null); }} /> : null}
  </div>;
}

function StatusComposer({ onClose, onPublished }: { onClose: () => void; onPublished: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [background, setBackground] = useState(backgrounds[0]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function publish(event: FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    try { await ChatService.publishStory({ text, background, file }, setProgress); onPublished(); }
    catch { setError("Status could not be published. Try again."); }
    finally { setPending(false); }
  }

  return <dialog ref={dialog} className={styles.dialog} aria-label="New status" onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}>
    <header><h2>New status</h2><button disabled={pending} onClick={onClose} className={styles.iconButton} aria-label="Close status composer"><X size={22} /></button></header>
    <form onSubmit={publish} className="space-y-4">
      <p className={styles.muted}>Visible to everyone on Ricoz for 24 hours.</p>
      {preview && file ? <div className="relative flex h-52 items-center justify-center overflow-hidden rounded bg-black">
        {file.type.startsWith("video/") ? <video src={preview} controls className="max-h-full max-w-full" /> : <Image src={preview} alt="Status preview" width={440} height={210} unoptimized className="max-h-full w-auto object-contain" />}
        <button type="button" disabled={pending} onClick={() => { setFile(null); setPreview(null); }} className="absolute right-2 top-2 rounded-full bg-black/70 p-2" aria-label="Remove status media"><X size={18} /></button>
      </div> : null}
      <textarea aria-label={file ? "Status caption" : "Status text"} maxLength={700} value={text} disabled={pending} onChange={(event) => setText(event.target.value)} rows={5} placeholder={file ? "Add a caption" : "Type a status"} style={{ backgroundColor: background }} className="w-full resize-none rounded-lg p-4 text-lg text-white outline-none" />
      <div className="flex items-center justify-between gap-2"><div role="group" aria-label="Status background" className="flex gap-2">{backgrounds.map((color, index) => <button type="button" key={color} disabled={pending} aria-label={`Background ${index + 1}`} aria-pressed={background === color} onClick={() => setBackground(color)} style={{ backgroundColor: color }} className={`size-7 rounded-full border-2 ${background === color ? "border-white" : "border-transparent"}`} />)}</div><span className={styles.muted}>{text.length}/700</span></div>
      <input ref={fileInput} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={(event) => {
        const selected = event.target.files?.[0]; event.target.value = "";
        if (!selected) return;
        if (selected.size > 20 * 1024 * 1024) { setError("Choose media smaller than 20 MB."); return; }
        setFile(selected); setPreview(URL.createObjectURL(selected)); setError("");
      }} />
      {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
      <div className="flex items-center justify-between"><button type="button" disabled={pending} onClick={() => fileInput.current?.click()} className={styles.iconButton} title="Add photo or video" aria-label="Add photo or video"><Camera size={22} /></button><button type="submit" disabled={pending || (!text.trim() && !file)} className={styles.primaryButton}>{pending ? <><LoaderCircle size={18} className="animate-spin" /> {progress === 100 ? "Publishing..." : `Uploading ${progress}%`}</> : "Publish status"}</button></div>
    </form>
  </dialog>;
}

function StoryViewer({ story, own, count, position, onClose, onNext, onPrevious, onViewed, onDeleted }: {
  story: ChatStory; own: boolean; count: number; position: number; onClose: () => void; onNext: () => void; onPrevious: () => void; onViewed: () => void; onDeleted: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const marked = useRef(false);
  const callbacks = useRef({ onNext, onViewed, onClose });
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(!story.media?.url);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [viewersOpen, setViewersOpen] = useState(false);
  const [views, setViews] = useState<StoryView[]>([]);
  const [total, setTotal] = useState(story.viewCount ?? 0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isVideo = story.media?.mimeType.startsWith("video/");
  useEffect(() => { callbacks.current = { onNext, onViewed, onClose }; });
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    if (!ready || marked.current || own) return;
    marked.current = true;
    ChatService.viewStory(story._id).then(() => callbacks.current.onViewed()).catch(() => setError("This status is no longer available. Close it and refresh."));
  }, [ready, own, story._id]);
  useEffect(() => {
    const expiry = setTimeout(() => callbacks.current.onClose(), Math.max(0, +new Date(story.expiresAt) - Date.now()));
    return () => clearTimeout(expiry);
  }, [story.expiresAt]);
  useEffect(() => {
    if (paused || viewersOpen || confirmDelete || !ready || error || isVideo) return;
    const timer = setInterval(() => setProgress((value) => Math.min(100, value + 1.25)), 100);
    return () => clearInterval(timer);
  }, [paused, viewersOpen, confirmDelete, ready, error, isVideo]);
  useEffect(() => { if (progress >= 100) callbacks.current.onNext(); }, [progress]);
  useEffect(() => {
    if (!video.current) return;
    if (paused || viewersOpen || confirmDelete) video.current.pause();
    else void video.current.play().catch(() => setPaused(true));
  }, [paused, viewersOpen, confirmDelete]);

  async function loadViews(more = false) {
    setPending(true); setViewersOpen(true); setError("");
    try {
      const data = await ChatService.storyViewers(story._id, more ? cursor ?? undefined : undefined);
      setViews((current) => more ? [...current, ...data.views] : data.views); setTotal(data.total); setCursor(data.nextCursor);
    } catch { setError("Could not load viewers. Try again."); } finally { setPending(false); }
  }

  return <dialog ref={dialog} className={`${styles.dialog} ${styles.storyViewer}`} aria-label={`${story.authorId.name}'s status`} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 gap-1" aria-label={`Status ${position + 1} of ${count}`}>
        {Array.from({ length: count }, (_, index) => <div key={index} className="h-0.5 flex-1 overflow-hidden bg-white/25"><div className="h-full bg-white transition-[width] duration-100" style={{ width: `${index < position ? 100 : index === position ? progress : 0}%` }} /></div>)}
      </div>
      <header className="my-2"><div className="min-w-0"><p className="truncate">{story.authorId.name}</p><p className={styles.muted}>{new Date(story.createdAt).toLocaleString()}</p></div><div className="flex"><button className={styles.iconButton} onClick={() => setPaused((value) => !value)} aria-label={paused ? "Play status" : "Pause status"}>{paused ? <Play size={20} /> : <Pause size={20} />}</button><button className={styles.iconButton} onClick={onClose} aria-label="Close status"><X size={22} /></button></div></header>
      <div className={styles.storyStage} style={{ backgroundColor: story.media?.url ? "#080a09" : story.background }}>
        {story.media?.url ? isVideo ? <video ref={video} src={story.media.url} autoPlay muted playsInline controls onLoadedData={() => setReady(true)} onEnded={onNext} onTimeUpdate={(event) => { const media = event.currentTarget; if (media.duration) setProgress(media.currentTime / media.duration * 100); }} onError={() => setError("This video could not be loaded.")} /> : <Image src={story.media.url} alt={story.text || "Status photo"} width={720} height={900} unoptimized onLoad={() => setReady(true)} onError={() => setError("This photo could not be loaded.")} /> : <p className={styles.storyText}>{story.text}</p>}
        {story.media?.url && story.text ? <p className={styles.caption}>{story.text}</p> : null}
      </div>
      {error ? <p role="alert" className="py-2 text-sm text-red-300">{error}</p> : null}
      <footer className="flex shrink-0 items-center justify-between py-2"><button disabled={position === 0} onClick={onPrevious} className={styles.iconButton} aria-label="Previous status"><ChevronLeft size={22} /></button>{own ? <div className="flex items-center gap-3"><button className="flex items-center gap-2 text-sm" onClick={() => void loadViews()}><Eye size={19} />{total} views</button><button onClick={() => setConfirmDelete(true)} className={styles.iconButton} aria-label="Delete status" title="Delete status"><Trash2 size={18} /></button></div> : null}<button onClick={onNext} className={styles.iconButton} aria-label="Next status"><ChevronRight size={22} /></button></footer>
      {confirmDelete ? <div className="shrink-0 space-y-3 border-t border-white/15 p-3"><p>Delete this status?</p><div className="flex gap-3"><button disabled={pending} className={styles.primaryButton} onClick={async () => { setPending(true); try { await ChatService.deleteStory(story._id); onDeleted(); } catch { setError("Could not delete status."); } finally { setPending(false); } }}>Delete</button><button onClick={() => setConfirmDelete(false)}>Cancel</button></div></div> : null}
      {viewersOpen ? <section className="max-h-[35dvh] shrink-0 overflow-y-auto border-t border-white/15 p-2" aria-label="Status viewers"><div className="flex items-center justify-between"><h3>Viewed by {total}</h3><button className={styles.iconButton} onClick={() => setViewersOpen(false)} aria-label="Close viewers"><X size={18} /></button></div>{views.map((view) => <div key={view._id} className="flex items-center gap-3 py-2"><Avatar name={view.userId?.name ?? "Deleted account"} small /><div><p>{view.userId?.name ?? "Deleted account"}</p><p className={styles.muted}>{new Date(view.viewedAt).toLocaleString()}</p></div></div>)}{!views.length && !pending ? <p className={styles.muted}>No views yet</p> : null}{pending ? <LoaderCircle className="animate-spin" /> : null}{cursor ? <button disabled={pending} onClick={() => void loadViews(true)} className="py-2 text-sm text-[#21c063]">Load more viewers</button> : null}</section> : null}
    </div>
  </dialog>;
}