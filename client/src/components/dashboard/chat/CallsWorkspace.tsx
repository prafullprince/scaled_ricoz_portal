"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, LoaderCircle, Phone, PhoneIncoming, PhoneMissed, Plus, RefreshCw, Search, Video } from "lucide-react";
import { ChatService, type CallHistoryEntry, type Conversation } from "@/services/chat.service";
import { useAppSelector } from "@/redux/hooks";
import { useChatCall } from "../ChatCallProvider";
import { useGroupCall } from "../GroupCallProvider";
import { Avatar } from "./Avatar";
import { NewConversationDialog } from "./NewConversationDialog";
import styles from "./ChatWorkspace.module.css";
import { ChatThemeToggle } from "./ChatThemeToggle";
import type { ChatTheme } from "@/lib/chat/theme";
import { populatedMembers } from "./chatHelpers";

export function CallsWorkspace({ theme, onThemeChange }: { theme: ChatTheme; onThemeChange: (theme: ChatTheme) => void }) {
  const user = useAppSelector((state) => state.auth.user);
  const { startCall, canStartCall, call } = useChatCall();
  const { startGroupCall, joinGroupCall, joinedCall } = useGroupCall();
  const [calls, setCalls] = useState<CallHistoryEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState("");
  const [newCall, setNewCall] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = calls.find((entry) => entry._id === selectedId) ?? null;
  const [calling, setCalling] = useState(false);
  const loadedOlder = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    ChatService.callHistory(undefined, controller.signal).then((data) => {
      setCalls((current) => loadedOlder.current ? [...data.calls, ...current.filter((entry) => !data.calls.some((item) => item._id === entry._id))] : data.calls);
      if (!loadedOlder.current) setCursor(data.nextCursor);
      setError("");
    })
      .catch(() => { if (!controller.signal.aborted) setError("Could not load call history."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    const timer = setInterval(() => setRefresh((value) => value + 1), 15_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [refresh, call?.callId, call?.status, joinedCall]);

  function peerFor(entry: CallHistoryEntry) { return entry.callerId?._id === user?.user_id ? entry.calleeId : entry.callerId; }
  function nameFor(entry: CallHistoryEntry) { return entry.kind === "GROUP" ? entry.conversationId?.name ?? "Group call" : peerFor(entry)?.name ?? "Unavailable contact"; }
  function canCallback(entry: CallHistoryEntry) {
    const conversation = entry.conversationId;
    if (!conversation || call || joinedCall || calling || !conversation.members.some((member) => member.userId === user?.user_id)) return false;
    return entry.kind === "GROUP" ? conversation.admins.includes(user?.user_id ?? "") : canStartCall && Boolean(peerFor(entry));
  }
  async function callback(entry: CallHistoryEntry) {
    const conversation = entry.conversationId;
    if (!conversation || !canCallback(entry)) return;
    setCalling(true); setError("");
    try {
      if (entry.kind === "GROUP") {
        const active = await ChatService.groupCallStatus(conversation._id);
        if (active) await joinGroupCall({ conversationId: conversation._id, conversationName: nameFor(entry) });
        else await startGroupCall({ conversationId: conversation._id, conversationName: nameFor(entry), type: entry.type });
      } else {
        const peer = peerFor(entry);
        if (peer) await startCall({ conversationId: conversation._id, peerUserId: peer._id, peerName: peer.name, type: entry.type });
      }
    } catch { setError("The call could not be started. Check your connection and media permissions."); } finally { setCalling(false); }
  }
  async function startNew(conversation: Conversation) {
    setNewCall(false);
    const peer = populatedMembers(conversation.members).find((member) => member.userId._id !== user?.user_id)?.userId;
    if (!peer) return;
    try { await startCall({ conversationId: conversation._id, peerUserId: peer._id, peerName: peer.name, type: "audio" }); }
    catch { setError("The call could not be started."); }
  }
  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    try { const data = await ChatService.callHistory(cursor); loadedOlder.current = true; setCalls((current) => [...current, ...data.calls.filter((entry) => !current.some((item) => item._id === entry._id))]); setCursor(data.nextCursor); }
    catch { setError("Could not load more calls."); } finally { setLoading(false); }
  }
  const visible = calls.filter((entry) => nameFor(entry).toLowerCase().includes(search.toLowerCase()));
  const duration = selected?.answeredAt && selected.endedAt ? Math.max(0, Math.round((+new Date(selected.endedAt) - +new Date(selected.answeredAt)) / 1000)) : 0;

  return <div className={styles.activity}>
    <aside className={styles.activityList} aria-label="Call history">
      <header className={styles.activityHeader}><h1>Calls</h1><div className="flex items-center gap-1"><ChatThemeToggle className={styles.activityThemeToggle} theme={theme} onChange={onThemeChange} /><button disabled={!canStartCall || Boolean(call) || Boolean(joinedCall)} className={styles.iconButton} onClick={() => setNewCall(true)} aria-label="Start a new call" title={canStartCall ? "Start a new call" : "Your role can receive calls only"}><Plus size={22} /></button></div></header>
      <label className={styles.search}><Search size={17} /><input aria-label="Search call history" placeholder="Search name" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <div className={styles.activityBody}><p className="px-3 pb-3 pt-2 text-sm">Recent</p>
        {visible.map((entry) => {
          const incoming = entry.callerId?._id !== user?.user_id;
          const missed = incoming && entry.state === "MISSED";
          const Icon = missed ? PhoneMissed : incoming ? ArrowDownLeft : ArrowUpRight;
          return <div key={entry._id} className="flex items-center gap-1 rounded-lg hover:bg-[#252826]">
            <button onClick={() => setSelectedId(entry._id)} className={styles.activityRow}>
              <Avatar name={nameFor(entry)} src={entry.kind === "DIRECT" ? peerFor(entry)?.profile_pic : undefined} community={entry.kind === "GROUP"} />
              <span className="min-w-0 flex-1"><p className={missed ? "text-[#f16c76]" : ""}>{nameFor(entry)}</p><span className={`mt-1 flex items-center gap-1 text-xs ${missed ? "text-[#f16c76]" : "text-[#a1a7a3]"}`}><Icon size={14} />{entry.state === "MISSED" ? incoming ? "Missed" : "No answer" : entry.state === "ENDED" ? incoming ? "Incoming" : "Outgoing" : entry.state.toLowerCase()}</span></span>
              <time className="shrink-0 text-[11px] text-[#a1a7a3]">{new Date(entry.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}<br />{new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
            </button>
            <button disabled={!canCallback(entry)} onClick={() => void callback(entry)} className={styles.iconButton} aria-label={`Call back ${nameFor(entry)}`} title={canCallback(entry) ? `Call back (${entry.type})` : "Calling unavailable for this conversation or role"}>{entry.type === "video" ? <Video size={19} /> : <Phone size={18} />}</button>
          </div>;
        })}
        {!loading && !visible.length ? <p className="px-3 py-8 text-sm text-[#a1a7a3]">{search ? "No matching calls" : "No calls yet"}</p> : null}
        {loading ? <LoaderCircle className="mx-auto my-6 animate-spin" /> : null}
        {error ? <button onClick={() => setRefresh((value) => value + 1)} className={styles.activityRow}><RefreshCw size={18} />{error} Retry</button> : null}
        {cursor ? <button disabled={loading} onClick={() => void loadMore()} className={styles.activityRow}>Load earlier calls</button> : null}
      </div>
    </aside>
    <section className={styles.activityEmpty} aria-label="Call details">
      {selected ? <><Avatar name={nameFor(selected)} community={selected.kind === "GROUP"} /><h2>{nameFor(selected)}</h2><p className={styles.muted}>{selected.type === "video" ? "Video" : "Voice"} call · {selected.state.toLowerCase()}</p><p className={styles.muted}>{new Date(selected.createdAt).toLocaleString()}{duration ? ` · ${Math.floor(duration / 60)}m ${duration % 60}s` : ""}</p><button disabled={!canCallback(selected)} className={styles.primaryButton} onClick={() => void callback(selected)}><PhoneIncoming size={20} />Call back</button></> : <><Video size={56} className="text-[#626a65]" /><h2>Voice and video calling</h2><button disabled={!canStartCall || Boolean(call) || Boolean(joinedCall)} onClick={() => setNewCall(true)} className={styles.primaryButton}><Phone size={19} />Start call</button></>}
    </section>
    {newCall ? <NewConversationDialog forCall canCreateCollective={false} onClose={() => setNewCall(false)} onCreated={(conversation) => void startNew(conversation)} /> : null}
  </div>;
}