"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  AtSign,
  BarChart3,
  Camera,
  Check,
  Globe2,
  ImagePlus,
  LoaderCircle,
  MessageCircle,
  Plus,
  RefreshCw,
  Share2,
  Send,
  Trash2,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { MarketingService } from "@/services/marketing.service";
import type {
  MarketingSocialAccount,
  MarketingSocialConversation,
  MarketingSocialMessage,
  MarketingSocialPost,
  MarketingSocialProvider,
} from "@/types/marketing";

type SocialTab = "OVERVIEW" | "PUBLISH" | "INBOX" | "LEADS" | "ACCOUNTS";
const tabs: Array<{ id: SocialTab; label: string; icon: typeof BarChart3 }> = [
  { id: "OVERVIEW", label: "Overview", icon: BarChart3 },
  { id: "PUBLISH", label: "Publishing", icon: Send },
  { id: "INBOX", label: "Inbox", icon: MessageCircle },
  { id: "LEADS", label: "Social leads", icon: Users },
  { id: "ACCOUNTS", label: "Channels", icon: WalletCards },
];
const providers: Array<{ id: "linkedin" | "meta" | "whatsapp"; label: string; copy: string; Icon: typeof Globe2 }> = [
  { id: "linkedin", label: "LinkedIn", copy: "Connect your member profile to publish organic posts.", Icon: AtSign },
  { id: "meta", label: "Facebook & Instagram", copy: "Connect a Facebook Page; linked professional Instagram accounts are added automatically.", Icon: Share2 },
  { id: "whatsapp", label: "WhatsApp Business", copy: "Connect an existing WhatsApp Business phone number through Meta.", Icon: MessageCircle },
];
const providerLabel: Record<MarketingSocialProvider, string> = {
  LINKEDIN: "LinkedIn",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp",
};
const providerStyle: Record<MarketingSocialProvider, string> = {
  LINKEDIN: "bg-sky-50 text-sky-700",
  FACEBOOK: "bg-blue-50 text-blue-700",
  INSTAGRAM: "bg-pink-50 text-pink-700",
  WHATSAPP: "bg-emerald-50 text-emerald-700",
};
const providerIcon: Record<MarketingSocialProvider, typeof Globe2> = {
  LINKEDIN: AtSign,
  FACEBOOK: Share2,
  INSTAGRAM: Camera,
  WHATSAPP: MessageCircle,
};
const card = "rounded-2xl border border-[#e3eaf3] bg-white shadow-[0_10px_30px_rgba(20,45,90,0.04)]";
const btnPrimary = "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1547a4] px-4 text-xs font-extrabold text-white transition hover:bg-[#103b8b] disabled:cursor-not-allowed disabled:opacity-50";
const btnSecondary = "inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#dfe7f1] bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50";
const field = "mt-1.5 w-full rounded-xl border border-[#dce5ef] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function fetchSocialData() {
  return Promise.allSettled([
    MarketingService.socialAccounts(),
    MarketingService.socialPosts(),
    MarketingService.socialInbox(),
    MarketingService.socialLeads(),
  ]);
}

export function MarketingSocialWorkspace() {
  const [tab, setTab] = useState<SocialTab>("OVERVIEW");
  const [accounts, setAccounts] = useState<MarketingSocialAccount[]>([]);
  const [posts, setPosts] = useState<MarketingSocialPost[]>([]);
  const [conversations, setConversations] = useState<MarketingSocialConversation[]>([]);
  const [messages, setMessages] = useState<MarketingSocialMessage[]>([]);
  const [leads, setLeads] = useState<Array<{ _id: string; name: string; company?: string; source: string; sourceDetail?: string; status: string; ownerId?: { name: string } | null; createdAt: string }>>([]);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [syncWarnings, setSyncWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState("");
  const [disconnecting, setDisconnecting] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [showComposer, setShowComposer] = useState(false);

  const applyResults = useCallback((results: Awaited<ReturnType<typeof fetchSocialData>>) => {
    const [accountResult, postResult, inboxResult, leadResult] = results;
    const errors: string[] = [];
    if (accountResult.status === "fulfilled") setAccounts(accountResult.value);
    else errors.push("Connected channels could not be loaded.");
    if (postResult.status === "fulfilled") {
      setPosts(postResult.value.posts);
      setSyncWarnings(postResult.value.syncWarnings);
    }
    else errors.push("Social posts could not be loaded.");
    if (inboxResult.status === "fulfilled") {
      setConversations(inboxResult.value.conversations);
      setMessages(inboxResult.value.messages);
    } else errors.push("Unified inbox could not be loaded.");
    if (leadResult.status === "fulfilled") setLeads(leadResult.value);
    else errors.push("Social-source CRM leads could not be loaded.");
    setLoadErrors(errors);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    applyResults(await fetchSocialData());
  }, [applyResults]);

  useEffect(() => {
    let active = true;
    fetchSocialData().then((results) => { if (active) applyResults(results); });
    return () => { active = false; };
  }, [applyResults]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("social") === "connected") toast.success(`${params.get("provider") || "Social"} channel connected.`);
    if (params.get("social") === "error") toast.error(params.get("reason") || "Social account could not be connected.");
    if (params.has("social")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const connected = accounts.filter((account) => account.status === "CONNECTED");
  const selected = conversations.find((conversation) => conversation._id === selectedConversation) ?? null;
  const unread = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);
  const published = posts.filter((post) => post.status === "PUBLISHED").length;

  const startConnection = async (provider: "linkedin" | "meta" | "whatsapp") => {
    setConnecting(provider);
    try {
      const url = await MarketingService.startSocialConnection(provider);
      window.location.assign(url);
    } catch {
      setConnecting("");
    }
  };
  const disconnect = async (account: MarketingSocialAccount) => {
    if (!window.confirm(`Disconnect ${account.name}? This removes the saved authorization token.`)) return;
    setDisconnecting(account._id);
    try {
      await MarketingService.disconnectSocialAccount(account._id);
      toast.success("Social channel disconnected.");
      await refresh();
    } catch {
      setDisconnecting("");
    }
  };
  const chooseConversation = async (conversation: MarketingSocialConversation) => {
    setSelectedConversation(conversation._id);
    if (!conversation.unreadCount) return;
    try {
      await MarketingService.markSocialRead(conversation._id);
      setConversations((current) => current.map((item) => item._id === conversation._id ? { ...item, unreadCount: 0 } : item));
    } catch { /* Request interceptor reports the failure; leave unread state unchanged. */ }
  };
  const sendReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !replyText.trim()) return;
    setReplyBusy(true);
    try {
      const sent = await MarketingService.replyToSocialConversation(selected._id, replyText.trim());
      setMessages((current) => [...current, sent]);
      setConversations((current) => current.map((conversation) => conversation._id === selected._id
        ? { ...conversation, lastMessage: sent.body, lastMessageAt: sent.sentAt }
        : conversation));
      setReplyText("");
    } catch { /* Request interceptor reports provider/API errors. */ }
    finally { setReplyBusy(false); }
  };

  return (
    <main className="space-y-5 pb-8">
      <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(125deg,#0b2456_0%,#1647a4_56%,#4f46b6_100%)] p-6 text-white shadow-[0_20px_50px_rgba(19,54,125,0.22)] sm:p-8">
        <div className="pointer-events-none absolute -right-14 -top-24 h-64 w-64 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-2 -top-12 h-48 w-48 rounded-full border border-white/10" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-100"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Marketing Social Hub</span>
            <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">One home for your social channels.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100/90">Connect approved business accounts, publish content, follow social-source sales leads, and reply to supported conversations from a shared inbox.</p>
          </div>
          <button type="button" onClick={() => setShowComposer(true)} disabled={!connected.some((account) => account.provider !== "WHATSAPP")} className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-xs font-extrabold text-[#173f91] shadow-lg transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={15} /> Create post</button>
        </div>
        <div className="relative mt-7 grid gap-3 sm:grid-cols-3">
          <HeroStat label="Connected channels" value={connected.length} detail="Pages and profiles" />
          <HeroStat label="Published posts" value={published} detail="Published from Ricoz" />
          <HeroStat label="Unread messages" value={unread} detail="Meta & WhatsApp inbox" />
        </div>
      </section>

      <nav aria-label="Social workspace sections" className="flex gap-1 overflow-x-auto rounded-2xl border border-[#e3eaf3] bg-white p-1.5 shadow-sm">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-extrabold transition ${tab === id ? "bg-[#eaf1ff] text-[#1647a4]" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}>
            <Icon size={14} />{label}{id === "INBOX" && unread > 0 ? <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] text-white">{unread}</span> : null}
          </button>
        ))}
        <button type="button" onClick={() => void refresh()} className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50" aria-label="Refresh social data"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>
      </nav>

      {loadErrors.length > 0 ? <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900"><AlertCircle size={15} className="mt-0.5 shrink-0" /><div>{loadErrors.map((error) => <p key={error}>{error}</p>)}</div></div> : null}
      {syncWarnings.length > 0 ? <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold text-amber-900"><p className="font-extrabold">Some platform posts could not be synchronized</p>{syncWarnings.map((warning) => <p key={warning} className="mt-1">{warning}</p>)}</div> : null}
      {loading && !accounts.length && !posts.length ? <div className={`${card} flex items-center justify-center gap-2 p-12 text-sm font-bold text-slate-500`}><LoaderCircle size={17} className="animate-spin" />Loading social workspace…</div> : null}

      {!loading || accounts.length || posts.length ? <>
        {tab === "OVERVIEW" ? <Overview accounts={connected} posts={posts} conversations={conversations} leads={leads} onTab={setTab} onConnect={startConnection} connecting={connecting} /> : null}
        {tab === "ACCOUNTS" ? <Accounts accounts={accounts} connecting={connecting} disconnecting={disconnecting} onConnect={startConnection} onDisconnect={disconnect} /> : null}
        {tab === "PUBLISH" ? <Publishing posts={posts} accounts={connected} onCreate={() => setShowComposer(true)} /> : null}
        {tab === "INBOX" ? <Inbox conversations={conversations} messages={messages} selected={selected} onSelect={chooseConversation} onReply={sendReply} reply={replyText} setReply={setReplyText} sending={replyBusy} onRefresh={() => void refresh()} /> : null}
        {tab === "LEADS" ? <Leads leads={leads} /> : null}
      </> : null}

      <section className={`${card} grid gap-4 p-5 lg:grid-cols-3`}>
        <div className="lg:col-span-1"><h3 className="text-sm font-extrabold text-slate-900">Provider access, clearly scoped</h3><p className="mt-1 text-xs leading-5 text-slate-500">Ricoz uses official authorization; account passwords are never requested or stored.</p></div>
        <div className="grid gap-3 text-xs leading-5 text-slate-600 sm:grid-cols-3 lg:col-span-2">
          <p className="rounded-xl bg-slate-50 p-3"><strong className="text-slate-800">LinkedIn:</strong> organic member posts published by Ricoz. LinkedIn does not expose DMs to standard third-party apps; reading the full existing post history requires restricted permissions.</p>
          <p className="rounded-xl bg-slate-50 p-3"><strong className="text-slate-800">Meta:</strong> Facebook/Instagram publishing and messaging need reviewed app permissions and webhook subscriptions.</p>
          <p className="rounded-xl bg-slate-50 p-3"><strong className="text-slate-800">WhatsApp:</strong> connect a WhatsApp Business phone. Replies must follow Meta messaging windows and template rules.</p>
        </div>
      </section>

      {showComposer ? <PostComposer accounts={connected.filter((account) => account.provider !== "WHATSAPP")} close={() => setShowComposer(false)} published={async () => { setShowComposer(false); await refresh(); }} /> : null}
    </main>
  );
}

function HeroStat({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.09] px-4 py-3 backdrop-blur"><p className="text-[10px] font-bold uppercase tracking-wider text-blue-100/80">{label}</p><div className="mt-1 flex items-baseline gap-2"><strong className="text-2xl font-black">{value}</strong><span className="text-[10px] font-medium text-blue-100/75">{detail}</span></div></div>;
}

function Overview({ accounts, posts, conversations, leads, onTab, onConnect, connecting }: {
  accounts: MarketingSocialAccount[];
  posts: MarketingSocialPost[];
  conversations: MarketingSocialConversation[];
  leads: Array<{ _id: string; name: string; source: string; status: string; createdAt: string }>;
  onTab: (tab: SocialTab) => void;
  onConnect: (provider: "linkedin" | "meta" | "whatsapp") => void;
  connecting: string;
}) {
  const recent = [...posts].slice(0, 4);
  return <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
    <section className={`${card} p-5`}>
      <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-extrabold text-slate-900">Your channels</h3><p className="mt-1 text-xs text-slate-500">A connected account is ready for its supported actions.</p></div><button type="button" onClick={() => onTab("ACCOUNTS")} className="text-xs font-extrabold text-blue-700">Manage channels</button></div>
      {accounts.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{accounts.slice(0, 6).map((account) => <AccountTile key={account._id} account={account} compact />)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center"><p className="text-sm font-extrabold text-slate-800">Connect your first channel</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">Link an official account to start publishing and receiving supported messages.</p><button type="button" disabled={Boolean(connecting)} onClick={() => onConnect("meta")} className={`${btnPrimary} mt-4`}>{connecting === "meta" ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />} Connect Meta Page</button></div>}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">{providers.map(({ id, label, Icon }) => <button type="button" key={id} disabled={Boolean(connecting)} onClick={() => onConnect(id)} className="flex items-center justify-between rounded-xl border border-[#e4ebf4] px-3 py-2.5 text-left text-[11px] font-extrabold text-slate-700 hover:border-blue-200 hover:bg-blue-50/40 disabled:opacity-60"><span className="flex items-center gap-2"><Icon size={14} className="text-blue-700" />{label}</span>{connecting === id ? <LoaderCircle size={13} className="animate-spin" /> : <ArrowUpRight size={13} className="text-slate-400" />}</button>)}</div>
    </section>
    <section className={`${card} p-5`}>
      <div className="flex items-start justify-between"><div><h3 className="text-sm font-extrabold text-slate-900">Activity snapshot</h3><p className="mt-1 text-xs text-slate-500">Recent publishing and incoming interest.</p></div><span className="rounded-xl bg-violet-50 p-2 text-violet-700"><BarChart3 size={16} /></span></div>
      <div className="mt-4 grid grid-cols-3 gap-2"><MiniCount label="Published" value={posts.filter((post) => post.status === "PUBLISHED").length} /><MiniCount label="Messages" value={conversations.length} /><MiniCount label="CRM leads" value={leads.length} /></div>
      <div className="mt-4 space-y-2">{recent.map((post) => <div key={post._id} className="flex items-start gap-2 rounded-xl bg-slate-50 p-3"><span className={`mt-0.5 rounded-lg p-1.5 ${providerStyle[post.provider]}`}><SocialIcon provider={post.provider} size={13} /></span><div className="min-w-0 flex-1"><p className="line-clamp-1 text-xs font-bold text-slate-800">{post.text}</p><p className="mt-1 text-[10px] text-slate-500">{providerLabel[post.provider]} · {post.status.toLowerCase()}</p></div></div>)}
        {!recent.length ? <p className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">Your posts will appear here.</p> : null}
      </div>
      <button type="button" onClick={() => onTab("INBOX")} className="mt-4 w-full rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-xs font-extrabold text-blue-800">Open shared inbox <span className="ml-1 text-blue-500">({conversations.length})</span></button>
    </section>
  </div>;
}

function MiniCount({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-lg font-black text-slate-900">{value}</p></div>;
}

function Accounts({ accounts, connecting, disconnecting, onConnect, onDisconnect }: {
  accounts: MarketingSocialAccount[];
  connecting: string;
  disconnecting: string;
  onConnect: (provider: "linkedin" | "meta" | "whatsapp") => void;
  onDisconnect: (account: MarketingSocialAccount) => void;
}) {
  return <div className="space-y-5">
    <section className={`${card} p-5`}>
      <h3 className="text-sm font-extrabold text-slate-900">Connect an official account</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">You’ll authorize Ricoz on the provider’s own login page. Only authorized tokens are saved, encrypted at rest.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">{providers.map(({ id, label, copy, Icon }) => <article key={id} className="rounded-2xl border border-[#e4ebf4] p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon size={19} /></div><h4 className="mt-3 text-sm font-extrabold text-slate-800">{label}</h4><p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">{copy}</p><button type="button" disabled={Boolean(connecting)} onClick={() => onConnect(id)} className={`${btnSecondary} mt-3 w-full`}>{connecting === id ? <LoaderCircle size={13} className="animate-spin" /> : <ArrowUpRight size={13} />}Continue with {id === "whatsapp" ? "Meta" : label}</button></article>)}</div>
    </section>
    <section className={`${card} p-5`}>
      <div className="flex items-center justify-between"><div><h3 className="text-sm font-extrabold text-slate-900">Connected accounts</h3><p className="mt-1 text-xs text-slate-500">Disconnect to revoke Ricoz’s saved token.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold text-slate-600">{accounts.filter((item) => item.status === "CONNECTED").length} active</span></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">{accounts.map((account) => <div key={account._id} className="flex items-center gap-3 rounded-2xl border border-[#e4ebf4] p-3.5"><AccountAvatar account={account} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold text-slate-800">{account.name}</p><p className="mt-0.5 text-[10px] font-semibold text-slate-500">{providerLabel[account.provider]} · {account.status.toLowerCase()}</p><p className="mt-1 truncate text-[9px] text-slate-400">ID {account.providerAccountId}</p></div>{account.status === "CONNECTED" ? <button type="button" title={`Disconnect ${account.name}`} disabled={disconnecting === account._id} onClick={() => onDisconnect(account)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">{disconnecting === account._id ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}</button> : <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">Not connected</span>}</div>)}
        {!accounts.length ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500 md:col-span-2">No social accounts connected yet.</div> : null}
      </div>
    </section>
    <WebhookSetup />
  </div>;
}

function AccountTile({ account, compact = false }: { account: MarketingSocialAccount; compact?: boolean }) {
  return <div className={`flex items-center gap-3 rounded-xl border border-[#e5ebf4] ${compact ? "p-3" : "p-4"}`}><AccountAvatar account={account} /><div className="min-w-0"><p className="truncate text-xs font-extrabold text-slate-800">{account.name}</p><p className="mt-0.5 text-[10px] font-semibold text-slate-500">{providerLabel[account.provider]} · <span className="text-emerald-600">Connected</span></p></div><Check size={14} className="ml-auto shrink-0 text-emerald-500" /></div>;
}
function AccountAvatar({ account }: { account: MarketingSocialAccount }) {
  return <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${providerStyle[account.provider]}`}><SocialIcon provider={account.provider} size={18} /></span>;
}
function SocialIcon({ provider, size = 15 }: { provider: MarketingSocialProvider; size?: number }) {
  const Icon = providerIcon[provider];
  return <Icon size={size} />;
}

function Publishing({ posts, accounts, onCreate }: { posts: MarketingSocialPost[]; accounts: MarketingSocialAccount[]; onCreate: () => void }) {
  return <section className={`${card} p-5`}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-extrabold text-slate-900">Publishing studio</h3><p className="mt-1 text-xs text-slate-500">Compose platform posts and keep a searchable publishing history.</p></div><button type="button" onClick={onCreate} disabled={!accounts.length} className={btnPrimary}><Plus size={14} /> New post</button></div>
    <div className="mt-4 flex flex-wrap gap-2">{accounts.map((account) => <span key={account._id} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${providerStyle[account.provider]}`}><SocialIcon provider={account.provider} size={12} />{account.name}</span>)}</div>
    <div className="mt-5 divide-y divide-slate-100">{posts.map((post) => {
      const account = typeof post.accountId === "object" ? post.accountId : null;
      return <article key={post._id} className="flex gap-3 py-4"><span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${providerStyle[post.provider]}`}><SocialIcon provider={post.provider} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-extrabold text-slate-800">{providerLabel[post.provider]}</p><span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${post.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-700" : post.status === "FAILED" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{post.status}</span>{post.source === "PLATFORM" ? <span className="text-[9px] font-bold text-slate-400">Synced from platform</span> : null}<span className="text-[10px] text-slate-400">{new Date(post.publishedAt || post.createdAt).toLocaleString()}</span></div><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{post.text}</p>{account ? <p className="mt-1 text-[10px] text-slate-400">Posted as {account.name}</p> : null}{post.error ? <p className="mt-1 text-[10px] font-semibold text-rose-600">{post.error}</p> : null}{post.externalPostId ? <p className="mt-1 break-all text-[9px] text-slate-400">Provider post ID · {post.externalPostId}</p> : null}{post.postUrl ? <a href={post.postUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-blue-700">View on platform <ArrowUpRight size={11} /></a> : null}</div></article>;
    })}{!posts.length ? <div className="py-12 text-center"><ImagePlus className="mx-auto text-slate-300" size={25} /><p className="mt-2 text-xs font-bold text-slate-700">No posts yet</p><p className="mt-1 text-[11px] text-slate-500">Create a draft or publish to a connected channel.</p></div> : null}</div>
  </section>;
}

function PostComposer({ accounts, close, published }: { accounts: MarketingSocialAccount[]; close: () => void; published: () => Promise<void> }) {
  const [accountId, setAccountId] = useState(accounts[0]?._id ?? "");
  const [copy, setCopy] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const account = accounts.find((item) => item._id === accountId);
  const submit = async (publishNow: boolean) => {
    setBusy(true);
    setError("");
    try {
      await MarketingService.createSocialPost({ accountId, text: copy, mediaUrl, publishNow });
      toast.success(publishNow ? "Post sent to the provider." : "Draft saved.");
      await published();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Post could not be saved.");
    } finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="social-post-title">
    <form onSubmit={(event) => { event.preventDefault(); void submit(true); }} className="my-auto w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-700">Compose</p><h2 id="social-post-title" className="mt-1 text-lg font-black text-slate-900">Create social post</h2></div><button type="button" onClick={close} aria-label="Close composer" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={17} /></button></div>
      <label className="mt-5 block text-xs font-extrabold text-slate-700">Publish to<select value={accountId} required onChange={(event) => setAccountId(event.target.value)} className={field}>{accounts.map((item) => <option key={item._id} value={item._id}>{providerLabel[item.provider]} · {item.name}</option>)}</select></label>
      <label className="mt-4 block text-xs font-extrabold text-slate-700">Post copy<textarea value={copy} onChange={(event) => setCopy(event.target.value)} rows={6} maxLength={3000} required placeholder="What would you like to share?" className={`${field} resize-y`} /><span className="mt-1 block text-right text-[10px] font-medium text-slate-400">{copy.length}/3000</span></label>
      {account?.provider !== "LINKEDIN" ? <label className="mt-3 block text-xs font-extrabold text-slate-700">{account?.provider === "INSTAGRAM" ? "Public image URL (required)" : "Link URL (optional)"}<input type="url" required={account?.provider === "INSTAGRAM"} value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="https://…" className={field} /><span className="mt-1 block text-[10px] font-medium text-slate-400">{account?.provider === "INSTAGRAM" ? "Instagram needs a publicly accessible HTTPS image URL. Video and carousel publishing are not enabled." : "Facebook will attach this as a link preview."}</span></label> : <p className="mt-3 rounded-xl bg-sky-50 p-3 text-[11px] leading-5 text-sky-800">LinkedIn organic text posts are enabled. Image and video upload workflows are not enabled yet.</p>}
      {account?.provider === "WHATSAPP" ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-[11px] text-amber-900">WhatsApp is for customer conversations; send replies from Inbox instead of publishing a feed post.</p> : null}
      {error ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</p> : null}
      <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={close} className={btnSecondary}>Cancel</button><button type="button" disabled={busy || !copy.trim() || !accountId} onClick={() => void submit(false)} className={btnSecondary}>{busy ? <LoaderCircle size={13} className="animate-spin" /> : null}Save draft</button><button type="submit" disabled={busy || !copy.trim() || !accountId || (account?.provider === "INSTAGRAM" && !mediaUrl)} className={btnPrimary}>{busy ? <LoaderCircle size={13} className="animate-spin" /> : <Send size={13} />}Publish now</button></div>
    </form>
  </div>;
}

function Inbox({ conversations, messages, selected, onSelect, onReply, reply, setReply, sending, onRefresh }: {
  conversations: MarketingSocialConversation[];
  messages: MarketingSocialMessage[];
  selected: MarketingSocialConversation | null;
  onSelect: (conversation: MarketingSocialConversation) => void;
  onReply: (event: FormEvent) => void;
  reply: string;
  setReply: (text: string) => void;
  sending: boolean;
  onRefresh: () => void;
}) {
  const selectedMessages = useMemo(() => selected ? messages.filter((message) => message.conversationId === selected._id) : [], [messages, selected]);
  const account = selected && typeof selected.accountId === "object" ? selected.accountId : null;
  const allowedToReply = selected?.provider !== "LINKEDIN";
  return <section className={`${card} overflow-hidden`}>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5"><div><h3 className="text-sm font-extrabold text-slate-900">Unified inbox</h3><p className="mt-1 text-xs text-slate-500">Meta and WhatsApp conversations received through subscribed webhooks.</p></div><button type="button" onClick={onRefresh} className={btnSecondary}><RefreshCw size={13} />Refresh</button></div>
    <div className="grid min-h-[460px] lg:grid-cols-[300px_1fr]">
      <aside className="border-b border-slate-100 lg:border-b-0 lg:border-r"><div className="max-h-[560px] overflow-y-auto">{conversations.map((conversation) => {
        const itemAccount = typeof conversation.accountId === "object" ? conversation.accountId : null;
        const active = selected?._id === conversation._id;
        return <button type="button" key={conversation._id} onClick={() => onSelect(conversation)} className={`w-full border-b border-slate-50 p-4 text-left transition ${active ? "bg-blue-50/80" : "hover:bg-slate-50"}`}><div className="flex items-center gap-2"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${providerStyle[conversation.provider]}`}><SocialIcon provider={conversation.provider} size={14} /></span><span className="min-w-0 flex-1 truncate text-xs font-extrabold text-slate-800">{conversation.participantName}</span>{conversation.unreadCount ? <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white">{conversation.unreadCount}</span> : null}</div><p className="mt-2 line-clamp-1 text-[11px] text-slate-600">{conversation.lastMessage || "Incoming message"}</p><div className="mt-1 flex items-center justify-between text-[9px] text-slate-400"><span>{itemAccount?.name || providerLabel[conversation.provider]}</span><span>{new Date(conversation.lastMessageAt).toLocaleString()}</span></div></button>;
      })}{!conversations.length ? <div className="p-6 text-center"><MessageCircle size={22} className="mx-auto text-slate-300" /><p className="mt-2 text-xs font-bold text-slate-700">Inbox is waiting for messages</p><p className="mt-1 text-[10px] leading-5 text-slate-500">Connect Meta/WhatsApp, configure the Meta webhook, and subscribe the app to messaging events.</p><Link href="/dashboard/marketing/social#channels" className="mt-2 inline-block text-[10px] font-extrabold text-blue-700">Configure channels</Link></div> : null}</div></aside>
      <div className="flex min-h-[460px] flex-col">
        {selected ? <>
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${providerStyle[selected.provider]}`}><SocialIcon provider={selected.provider} /></span><div className="min-w-0"><p className="truncate text-xs font-extrabold text-slate-800">{selected.participantName}</p><p className="text-[10px] text-slate-500">{providerLabel[selected.provider]} · {account?.name || "Connected account"}</p></div></div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-[#f8fafd] p-4">{selectedMessages.map((message) => <div key={message._id} className={`flex ${message.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-5 ${message.direction === "OUTBOUND" ? "rounded-br-sm bg-blue-700 text-white" : "rounded-bl-sm border border-slate-100 bg-white text-slate-700"}`}><p className="whitespace-pre-wrap">{message.body}</p><p className={`mt-1 text-right text-[9px] ${message.direction === "OUTBOUND" ? "text-blue-100" : "text-slate-400"}`}>{new Date(message.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></div></div>)}</div>
          {allowedToReply ? <form onSubmit={onReply} className="flex items-end gap-2 border-t border-slate-100 p-3"><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={2} maxLength={4000} required placeholder="Write a reply…" className="max-h-28 min-h-10 flex-1 resize-y rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500" /><button type="submit" disabled={sending || !reply.trim()} aria-label="Send reply" className={`${btnPrimary} h-10 w-10 px-0`}><Send size={14} /></button></form> : <p className="border-t border-amber-100 bg-amber-50 p-3 text-[10px] font-semibold text-amber-900">LinkedIn messaging is not available through standard third-party API access.</p>}
        </> : <div className="m-auto max-w-sm px-6 text-center"><MessageCircle size={25} className="mx-auto text-slate-300" /><p className="mt-2 text-xs font-bold text-slate-700">Select a conversation</p><p className="mt-1 text-[10px] leading-5 text-slate-500">Incoming messages will appear here after provider webhooks are enabled.</p></div>}
      </div>
    </div>
  </section>;
}

function Leads({ leads }: { leads: Array<{ _id: string; name: string; company?: string; source: string; sourceDetail?: string; status: string; ownerId?: { name: string } | null; createdAt: string }> }) {
  return <section className={`${card} p-5`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-extrabold text-slate-900">Social-source leads in Sales CRM</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">These are CRM records attributed to Facebook, Instagram, or LinkedIn. Ad lead forms require separate Meta/LinkedIn lead-generation permissions and are not ingested by this connection.</p></div><Link href="/dashboard/marketing/leads" className={btnSecondary}>Add / hand off a lead <ArrowUpRight size={13} /></Link></div>
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[600px] text-left"><thead><tr className="border-b border-slate-100 text-[9px] font-extrabold uppercase tracking-wider text-slate-400"><th className="px-3 py-2">Lead</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Stage</th><th className="px-3 py-2">Owner</th><th className="px-3 py-2">Added</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead._id} className="border-b border-slate-50 text-xs"><td className="px-3 py-3"><span className="font-extrabold text-slate-800">{lead.name}</span>{lead.company ? <span className="ml-1 text-slate-400">· {lead.company}</span> : null}</td><td className="px-3 py-3 font-semibold text-slate-600">{lead.sourceDetail || lead.source}</td><td className="px-3 py-3"><span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-extrabold text-blue-700">{lead.status}</span></td><td className="px-3 py-3 text-slate-600">{lead.ownerId?.name || "—"}</td><td className="px-3 py-3 text-slate-500">{new Date(lead.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table>{!leads.length ? <div className="p-10 text-center text-xs text-slate-500">No CRM leads currently have a social source.</div> : null}</div>
  </section>;
}

function WebhookSetup() {
  return     <details id="channels" className={`${card} p-5`}><summary className="flex cursor-pointer list-none items-center justify-between text-xs font-extrabold text-slate-800">Inbox webhook setup <span className="text-slate-400">Show details</span></summary><div className="mt-4 grid gap-3 text-[11px] leading-5 text-slate-600 sm:grid-cols-2"><p className="rounded-xl bg-slate-50 p-3"><strong className="text-slate-800">Callback URL</strong><br />Use your API host plus <code className="break-all">/api/v1/marketing/social/webhook/meta</code> in the Meta Developer app. Subscribe to Facebook Page/Instagram messaging and WhatsApp messages.</p><p className="rounded-xl bg-slate-50 p-3"><strong className="text-slate-800">Server settings</strong><br />Configure <code>META_APP_ID</code>, <code>META_APP_SECRET</code>, <code>META_REDIRECT_URI</code>, <code>WHATSAPP_REDIRECT_URI</code>, <code>META_WEBHOOK_VERIFY_TOKEN</code>, and <code>INTEGRATIONS_ENCRYPTION_KEY</code>. Add LinkedIn app credentials for LinkedIn publishing.</p><p className="rounded-xl bg-slate-50 p-3 sm:col-span-2"><strong className="text-slate-800">Access review</strong><br />Meta scopes for publishing, Instagram account access, Pages messages and WhatsApp must be enabled and approved for the Meta app. Add these exact callback URLs to the provider app allowlist. Webhook HTTPS is required.</p></div></details>;
}
