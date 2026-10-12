"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { LoaderCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useAppSelector } from "@/redux/hooks";
import { toast } from "sonner";
import {
  ChatService,
  chatWebSocketUrl,
  MESSAGE_EDIT_WINDOW_MS,
  type ChatAttachment,
  type ChatLocation,
  type ChatMessage,
  type Conversation,
} from "@/services/chat.service";
import { USER_ROLES } from "@/lib/auth/roles";
import { useChatCall } from "@/components/dashboard/ChatCallProvider";
import { useGroupCall } from "@/components/dashboard/GroupCallProvider";
import {
  enableChatNotificationSound,
  isChatActive,
  isChatMuted,
  playIncomingMessageSound,
  setActiveChat,
  setMutedChats,
} from "@/lib/chat/notificationSound";
import { NewConversationDialog } from "./chat/NewConversationDialog";
import { DetailsPanel } from "./chat/DetailsPanel";
import {
  ConversationSidebar,
  type ConversationTab,
} from "./chat/ConversationSidebar";
import { ChatHeader } from "./chat/ChatHeader";
import { MessageList } from "./chat/MessageList";
import { ReplyEditBanner } from "./chat/ReplyEditBanner";
import { AttachmentPreviewBar } from "./chat/AttachmentPreviewBar";
import { MessageComposer } from "./chat/MessageComposer";
import { EmptyChatPlaceholder } from "./chat/EmptyChatPlaceholder";
import { populatedMembers, senderId } from "./chat/chatHelpers";
import { UserProfileDialog } from "./UserProfileDialog";
import styles from "./chat/ChatWorkspace.module.css";
import { StatusWorkspace } from "./chat/StatusWorkspace";
import { CallsWorkspace } from "./chat/CallsWorkspace";
import { getChatTheme, setChatTheme, subscribeChatTheme, type ChatTheme } from "@/lib/chat/theme";

const collectiveCreatorRoles = new Set<string>([
  USER_ROLES.CEO,
  USER_ROLES.HEAD,
  USER_ROLES.MANAGER,
  USER_ROLES.PRODUCT_HEAD,
  USER_ROLES.MARKETING_HEAD,
  USER_ROLES.FINANCE_HEAD,
  USER_ROLES.SALES_HEAD,
  USER_ROLES.PROJECTS_HEAD,
  USER_ROLES.SUPPORT_HEAD,
  USER_ROLES.HR_HEAD,
  USER_ROLES.DESIGN_HEAD,
  USER_ROLES.ENGINEERING_HEAD,
  USER_ROLES.IT_HEAD,
  USER_ROLES.PRODUCT_MANAGER,
  USER_ROLES.MARKETING_MANAGER,
  USER_ROLES.FINANCE_MANAGER,
  USER_ROLES.SALES_MANAGER,
  USER_ROLES.PROJECTS_MANAGER,
  USER_ROLES.SUPPORT_MANAGER,
  USER_ROLES.HR_MANAGER,
  USER_ROLES.DESIGN_MANAGER,
  USER_ROLES.ENGINEERING_MANAGER,
  USER_ROLES.IT_MANAGER,
  USER_ROLES.ADMIN,
]);
const departmentChatRoles = collectiveCreatorRoles;
export function ChatWorkspace() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") ?? "chats";
  const requestedConversationId = searchParams.get("conversation");
  const contactsRequested = searchParams.get("contacts") === "1";
  const user = useAppSelector((state) => state.auth.user);
  const token = useAppSelector((state) => state.auth.access_token);
  const { canStartCall, startCall } = useChatCall();
  const { activeCalls, startGroupCall, joinGroupCall, syncActiveCall } = useGroupCall();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const chatTheme = useSyncExternalStore<ChatTheme>(subscribeChatTheme, getChatTheme, () => "dark");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ConversationTab>("all");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [composerPending, setComposerPending] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [sharedLocation, setSharedLocation] = useState<ChatLocation | null>(null);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(contactsRequested);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [socketState, setSocketState] = useState<
    "connecting" | "online" | "offline"
  >("connecting");
  const socketRef = useRef<WebSocket | null>(null);
  const selectedRef = useRef<string | null>(null);
  const readWatermarksRef = useRef<Map<string, Map<string, number>>>(new Map());
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingExpiryTimers = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const prependAnchorRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const canCreateCollective = Boolean(
    user && user.roles.some((role) => collectiveCreatorRoles.has(role)),
  );
  const canViewProfiles = canCreateCollective;
  const selected =
    conversations.find((conversation) => !["status", "calls"].includes(view) && conversation._id === selectedId && (view === "communities" ? conversation.type === "COMMUNITY" : view === "channels" ? conversation.type === "ANNOUNCEMENT" : true)) ??
    null;
  const activeConversationId = selected?._id ?? null;
  const isCollectiveAdmin = Boolean(
    selected &&
      selected.type !== "DIRECT" &&
      user &&
      selected.admins.some((adminId) => adminId === user.user_id),
  );
  const selectedActiveCall = selected ? activeCalls.get(selected._id) : undefined;

  useEffect(() => {
    setMutedChats(conversations);
    window.dispatchEvent(
      new CustomEvent("ricoz-chat-unread-count", {
        detail: conversations.reduce(
          (total, conversation) => total + conversation.unreadCount,
          0,
        ),
      }),
    );
  }, [conversations]);

  function openConversation(conversationId: string | null) {
    if (!conversationId) setMessages([]);
    else if (conversationId !== selectedRef.current) {
      setLoadingMessages(true);
      setReplyTo(null);
      setEditingMessage(null);
      setTypingUsers([]);
      setText("");
      setAttachments([]);
      setSharedLocation(null);
    }
    setSelectedId(conversationId);
  }

  function closeComposer() {
    setComposerOpen(false);
    if (!contactsRequested) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("contacts");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function applyReadWatermarks(message: ChatMessage) {
    const watermarks = readWatermarksRef.current.get(message.conversationId);
    if (!watermarks) return message;
    const createdAt = new Date(message.createdAt).getTime();
    const readers = [...watermarks.entries()]
      .filter(([, readThrough]) => createdAt <= readThrough)
      .map(([readerId]) => readerId);
    if (!readers.length) return message;
    return {
      ...message,
      deliveredTo: [...new Set([...message.deliveredTo, ...readers])],
      readBy: [...new Set([...message.readBy, ...readers])],
    };
  }

  useEffect(() => {
    selectedRef.current = activeConversationId;
  }, [activeConversationId]);
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const hideMessageLocally = useCallback((messageId: string, conversationId?: string) => {
    const remaining = messagesRef.current.filter((item) => item._id !== messageId);
    const replacement = remaining.filter((item) => item.conversationId === conversationId).at(-1) ?? null;
    setMessages((current) => current.filter((item) => item._id !== messageId));
    setConversations((current) =>
      current.map((item) =>
        item.lastMessage?._id === messageId ? { ...item, lastMessage: replacement } : item,
      ),
    );
  }, []);
  useEffect(() => enableChatNotificationSound(), []);
  useEffect(() => {
    const syncActiveChat = () =>
      setActiveChat(
        document.visibilityState === "visible" ? activeConversationId : null,
      );
    syncActiveChat();
    const heartbeat = window.setInterval(syncActiveChat, 5000);
    document.addEventListener("visibilitychange", syncActiveChat);
    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", syncActiveChat);
      setActiveChat(null);
    };
  }, [activeConversationId]);
  useEffect(() => {
    let active = true;
    ChatService.conversations()
      .then((result) => {
        if (!active) return;
        setConversations(result.conversations);
        const requestedConversation = requestedConversationId
          ? result.conversations.find((item) => item._id === requestedConversationId)
          : null;
        if (requestedConversation) {
          openConversation(requestedConversation._id);
        } else if (
          !selectedRef.current &&
          result.conversations[0] &&
          window.matchMedia("(min-width: 768px)").matches
        )
          openConversation(result.conversations[0]._id);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [requestedConversationId]);

  useEffect(() => {
    if (!activeConversationId) return;
    let active = true;
    ChatService.messages(activeConversationId, undefined, 15)
      .then((result) => {
        if (!active) return;
        setMessages(result.messages.map(applyReadWatermarks));
        setMessageCursor(result.nextCursor);
        setConversations((current) =>
          current.map((item) =>
            item._id === activeConversationId ? { ...item, unreadCount: 0 } : item,
          ),
        );
      })
      .finally(() => active && setLoadingMessages(false));
    return () => {
      active = false;
    };
  }, [activeConversationId]);

  useEffect(() => {
    if (!selected || selected.type === "DIRECT") return;
    let active = true;
    ChatService.groupCallStatus(selected._id)
      .then((activeCall) => {
        if (!active) return;
        syncActiveCall(
          selected._id,
          title(selected),
          activeCall
            ? { type: activeCall.type, startedByName: activeCall.startedByName }
            : null,
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (!token) return;
    let closed = false;
    let retry = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const typingTimers = typingExpiryTimers.current;
    const connect = () => {
      setSocketState("connecting");
      const socket = new WebSocket(chatWebSocketUrl(token));
      socketRef.current = socket;
      socket.onopen = () => {
        retry = 0;
      };
      socket.onclose = () => {
        setSocketState("offline");
        if (!closed)
          reconnectTimer = setTimeout(
            connect,
            Math.min(30000, 1000 * 2 ** retry++),
          );
      };
      socket.onmessage = (event) => {
        const packet = JSON.parse(event.data) as {
          type: string;
          message?: ChatMessage;
          messageId?: string;
          clientId?: string;
          conversationId?: string;
          userId?: string;
          receipt?: string;
          readThroughAt?: string;
          reactions?: ChatMessage["reactions"];
          conversation?: Conversation;
        };
        if (packet.type === "connection.ready") setSocketState("online");
        if (packet.type === "conversation.created") {
          ChatService.conversations()
            .then((result) => setConversations(result.conversations))
            .catch(() => undefined);
        }
        if (packet.type === "conversation.deleted" && packet.conversationId) {
          setConversations((current) => current.filter((item) => item._id !== packet.conversationId));
          if (selectedRef.current === packet.conversationId) {
            setSelectedId(null);
            setDetailsOpen(false);
          }
          return;
        }
        if (packet.type === "conversation.updated" && packet.conversation) {
          const stillMember = populatedMembers(packet.conversation.members).some(
            (member) => member.userId._id === user?.user_id,
          );
          if (!stillMember) {
            setConversations((current) =>
              current.filter((item) => item._id !== packet.conversation!._id),
            );
            if (selectedRef.current === packet.conversation._id) {
              setSelectedId(null);
              setDetailsOpen(false);
            }
            return;
          }
          setConversations((current) => {
            const existing = current.find(
              (item) => item._id === packet.conversation!._id,
            );
            if (!existing) return current;
            return current.map((item) =>
              item._id === packet.conversation!._id
                ? {
                    ...item,
                    ...packet.conversation!,
                    mySettings: item.mySettings,
                    lastMessage: item.lastMessage,
                    unreadCount: item.unreadCount,
                  }
                : item,
            );
          });
        }
        if (packet.type === "message.created" && packet.message) {
          const message = applyReadWatermarks(packet.message);
          if (
            senderId(message) !== user?.user_id &&
            !isChatActive(message.conversationId)
          )
            if (!isChatMuted(message.conversationId))
              playIncomingMessageSound(message._id);
          if (selectedRef.current === message.conversationId)
            setMessages((current) => [
              ...current.filter((item) => item.clientId !== message.clientId),
              message,
            ]);
          setConversations((current) =>
            current
              .map((item) =>
                item._id === message.conversationId
                  ? {
                      ...item,
                      lastMessage: message,
                      lastMessageAt: message.createdAt,
                      unreadCount:
                        selectedRef.current === item._id ||
                        senderId(message) === user?.user_id
                          ? 0
                          : item.unreadCount + 1,
                    }
                  : item,
              )
              .sort(
                (a, b) =>
                  +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt),
              ),
          );
          if (senderId(message) !== user?.user_id) {
            socket.send(
              JSON.stringify({
                type: "message.delivered",
                conversationId: message.conversationId,
                messageId: message._id,
              }),
            );
          }
        }
        if (packet.type === "message.updated" && packet.message)
          setMessages((current) =>
            current.map((item) =>
              item._id === packet.message!._id ? packet.message! : item,
            ),
          );
        if (packet.type === "message.hidden" && packet.messageId)
          hideMessageLocally(packet.messageId, packet.conversationId);
        if (packet.type === "message.deleted")
          setMessages((current) =>
            current.map((item) =>
              item._id === packet.messageId
                ? {
                    ...item,
                    text: "",
                    attachments: [],
                    deletedForEveryoneAt: new Date().toISOString(),
                  }
                : item,
            ),
          );
        if (packet.type === "message.reaction")
          setMessages((current) =>
            current.map((item) =>
              item._id === packet.messageId
                ? { ...item, reactions: packet.reactions ?? [] }
                : item,
            ),
          );
        if (
          packet.type === "message.receipt" &&
          packet.messageId &&
          packet.userId
        )
          setMessages((current) =>
            current.map((item) =>
              item._id === packet.messageId
                ? {
                    ...item,
                    deliveredTo: [
                      ...new Set([...item.deliveredTo, packet.userId!]),
                    ],
                  }
                : item,
            ),
          );
        if (
          packet.type === "conversation.read" &&
          packet.messageId &&
          packet.userId
        ) {
          const readThrough = packet.readThroughAt
            ? new Date(packet.readThroughAt).getTime()
            : null;
          if (packet.conversationId && readThrough !== null) {
            const conversationWatermarks =
              readWatermarksRef.current.get(packet.conversationId) ?? new Map();
            conversationWatermarks.set(
              packet.userId,
              Math.max(conversationWatermarks.get(packet.userId) ?? 0, readThrough),
            );
            readWatermarksRef.current.set(
              packet.conversationId,
              conversationWatermarks,
            );
          }
          setMessages((current) =>
            current.map((item) => {
              const isRead =
                item._id === packet.messageId ||
                (item.conversationId === packet.conversationId &&
                  readThrough !== null &&
                  new Date(item.createdAt).getTime() <= readThrough);
              if (!isRead || item.readBy.includes(packet.userId!)) return item;
              return {
                ...item,
                deliveredTo: [
                  ...new Set([...item.deliveredTo, packet.userId!]),
                ],
                readBy: [...item.readBy, packet.userId!],
              };
            }),
          );
        }
        if (
          packet.type === "typing.start" &&
          packet.conversationId === selectedRef.current &&
          packet.userId
        ) {
          const typingUserId = packet.userId;
          const existingTimer = typingTimers.get(typingUserId);
          if (existingTimer) clearTimeout(existingTimer);
          setTypingUsers((current) => [
            ...new Set([...current, typingUserId]),
          ]);
          typingTimers.set(
            typingUserId,
            setTimeout(() => {
              setTypingUsers((current) =>
                current.filter((id) => id !== typingUserId),
              );
              typingTimers.delete(typingUserId);
            }, 3000),
          );
        }
        if (
          packet.type === "typing.stop" &&
          packet.conversationId === selectedRef.current &&
          packet.userId
        ) {
          const existingTimer = typingTimers.get(packet.userId);
          if (existingTimer) clearTimeout(existingTimer);
          typingTimers.delete(packet.userId);
          setTypingUsers((current) =>
            current.filter((id) => id !== packet.userId),
          );
        }
      };
    };
    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      typingTimers.forEach(clearTimeout);
      typingTimers.clear();
      socketRef.current?.close();
    };
  }, [token, user?.user_id, hideMessageLocally]);

  useEffect(() => {
    if (!activeConversationId || !messages.length) return;
    const markVisibleMessagesRead = () => {
      if (document.visibilityState !== "visible") return;
      const last = messages.at(-1);
      if (
        last &&
        last.conversationId === activeConversationId &&
        !last.pending &&
        user?.user_id &&
        !last.readBy.includes(user.user_id)
      )
        void ChatService.markRead(activeConversationId, last._id);
    };
    markVisibleMessagesRead();
    document.addEventListener("visibilitychange", markVisibleMessagesRead);
    window.addEventListener("focus", markVisibleMessagesRead);
    return () => {
      document.removeEventListener("visibilitychange", markVisibleMessagesRead);
      window.removeEventListener("focus", markVisibleMessagesRead);
    };
  }, [messages, activeConversationId, user?.user_id]);

  useLayoutEffect(() => {
    const viewport = messageViewportRef.current;
    const anchor = prependAnchorRef.current;
    if (viewport && anchor) {
      viewport.scrollTop =
        viewport.scrollHeight - anchor.scrollHeight + anchor.scrollTop;
      prependAnchorRef.current = null;
      return;
    }
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function title(conversation: Conversation) {
    if (conversation.type !== "DIRECT")
      return conversation.name ?? "Untitled chat";
    return (
      populatedMembers(conversation.members).find((member) => member.userId._id !== user?.user_id)
        ?.userId.name ?? "Direct chat"
    );
  }
  function subtitle(conversation: Conversation) {
    if (conversation.lastMessage?.deletedForEveryoneAt)
      return "This message was deleted";
    if (conversation.lastMessage?.text) return conversation.lastMessage.text;
    if (conversation.lastMessage?.attachments.length)
      return `Attachment · ${conversation.lastMessage.attachments[0]?.name}`;
    if (conversation.lastMessage?.location) return "Location";
    return conversation.type === "COMMUNITY"
      ? `${populatedMembers(conversation.members).length} community members`
      : "Start a conversation";
  }
  const visibleConversations = conversations.filter((conversation) => {
    const archived = Boolean(conversation.mySettings?.archived);
    const hasDepartmentLeader = populatedMembers(conversation.members).some(
      (member) =>
        member.userId._id !== user?.user_id &&
        member.userId.roles.some((role) => departmentChatRoles.has(role)),
    );
    const matchesTab =
      (tab === "archived" ? archived : !archived) &&
      (tab === "all" ||
      (tab === "unread"
        ? conversation.unreadCount > 0
        : tab === "favourites"
          ? Boolean(conversation.mySettings?.pinned)
        : tab === "communities"
          ? conversation.type === "GROUP" || conversation.type === "COMMUNITY" || Boolean(conversation.communityId)
          : tab === "dept"
            ? hasDepartmentLeader
          : true));
    return (
      (view === "communities" ? conversation.type === "COMMUNITY" : view === "channels" ? conversation.type === "ANNOUNCEMENT" : true) &&
      ((view === "communities" || view === "channels") ? !archived : matchesTab) &&
      `${title(conversation)} ${subtitle(conversation)}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }).sort((first, second) => {
    const pinnedDifference = Number(Boolean(second.mySettings?.pinned)) - Number(Boolean(first.mySettings?.pinned));
    return pinnedDifference || +new Date(second.lastMessageAt) - +new Date(first.lastMessageAt);
  });

  async function loadOlder() {
    if (!selectedId || !messageCursor || loadingOlder) return;
    const viewport = messageViewportRef.current;
    if (viewport)
      prependAnchorRef.current = {
        scrollHeight: viewport.scrollHeight,
        scrollTop: viewport.scrollTop,
      };
    setLoadingOlder(true);
    try {
      const result = await ChatService.messages(selectedId, messageCursor);
      setMessages((current) => {
        const existingIds = new Set(current.map((message) => message._id));
        const older = result.messages
          .filter((message) => !existingIds.has(message._id))
          .map(applyReadWatermarks);
        return [...older, ...current];
      });
      setMessageCursor(result.nextCursor);
    } finally {
      setLoadingOlder(false);
    }
  }
  function signalTyping(value: string) {
    setText(value);
    if (editingMessage) return;
    if (!selectedId || socketRef.current?.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({ type: "typing.start", conversationId: selectedId }),
    );
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(
      () =>
        socketRef.current?.send(
          JSON.stringify({ type: "typing.stop", conversationId: selectedId }),
        ),
      1200,
    );
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!selectedId || (!body && !attachments.length && !sharedLocation) || !user) return;
    if (editingMessage) {
      if (body === editingMessage.text.trim()) {
        setEditingMessage(null);
        setText("");
        return;
      }
      setComposerPending(true);
      try {
        const updated = await ChatService.edit(editingMessage._id, body);
        setMessages((current) =>
          current.map((message) =>
            message._id === updated._id ? updated : message,
          ),
        );
        setEditingMessage(null);
        setText("");
      } catch {
        const expired = Date.now() - new Date(editingMessage.createdAt).getTime() > MESSAGE_EDIT_WINDOW_MS;
        toast.error(expired ? "Messages can only be edited within 1 hour of sending" : "Message could not be edited");
        if (expired) {
          setEditingMessage(null);
          setText("");
        }
      } finally {
        setComposerPending(false);
      }
      return;
    }
    const clientId = crypto.randomUUID();
    const messageType = sharedLocation
      ? "LOCATION"
      : attachments[0]?.mimeType.startsWith("image/")
        ? "IMAGE"
        : attachments[0]?.mimeType.startsWith("video/")
          ? "VIDEO"
          : attachments[0]?.mimeType.startsWith("audio/")
            ? "AUDIO"
          : attachments.length
            ? "DOCUMENT"
            : "TEXT";
    const optimistic: ChatMessage = {
      _id: clientId,
      conversationId: selectedId,
      senderId: {
        _id: user.user_id,
        name: user.user_name,
        email: user.user_email,
        roles: user.roles,
      },
      clientId,
      type: messageType,
      text: body,
      attachments,
      location: sharedLocation,
      replyTo,
      reactions: [],
      deliveredTo: [],
      readBy: [user.user_id],
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((current) => [...current, optimistic]);
    setText("");
    setAttachments([]);
    setSharedLocation(null);
    setReplyTo(null);
    const payload = {
      type: "message.send",
      conversationId: selectedId,
      clientId,
      text: body,
      messageType,
      attachments,
      location: sharedLocation,
      replyTo: replyTo?._id ?? null,
    };
    if (socketRef.current?.readyState === WebSocket.OPEN)
      socketRef.current.send(JSON.stringify(payload));
    else
      await ChatService.send(selectedId, {
        clientId,
        text: body,
        type: messageType,
        attachments,
        location: sharedLocation,
        replyTo: replyTo?._id ?? null,
      });
  }

  async function uploadFiles(files: FileList | File[] | null) {
    if (!files?.length || uploadProgress !== null) return;
    const available = 10 - attachments.length;
    const selectedFiles = [...files].slice(0, available);
    if (!selectedFiles.length) return;
    setAttachmentMenuOpen(false);
    setComposerPending(true);
    try {
      const uploaded: ChatAttachment[] = [];
      for (let index = 0; index < selectedFiles.length; index += 1) {
        const attachment = await ChatService.upload(selectedFiles[index], (progress) =>
          setUploadProgress(Math.round(((index + progress / 100) / selectedFiles.length) * 100)),
        );
        uploaded.push(attachment);
      }
      setAttachments((current) => [...current, ...uploaded]);
    } finally {
      setUploadProgress(null);
      setComposerPending(false);
    }
  }

  async function sendVoiceNote(file: File) {
    if (!selectedId || !user || composerPending) return;
    setComposerPending(true);
    try {
      const attachment = await ChatService.upload(file, setUploadProgress);
      const clientId = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const reply = replyTo;
      const optimistic: ChatMessage = {
        _id: clientId,
        conversationId: selectedId,
        senderId: {
          _id: user.user_id,
          name: user.user_name,
          email: user.user_email,
          roles: user.roles,
        },
        clientId,
        type: "AUDIO",
        text: "",
        attachments: [attachment],
        location: null,
        replyTo: reply,
        reactions: [],
        deliveredTo: [],
        readBy: [user.user_id],
        createdAt,
        pending: true,
      };
      setMessages((current) => [...current, optimistic]);
      setReplyTo(null);
      const payload = {
        type: "message.send",
        conversationId: selectedId,
        clientId,
        text: "",
        messageType: "AUDIO",
        attachments: [attachment],
        location: null,
        replyTo: reply?._id ?? null,
      };
      if (socketRef.current?.readyState === WebSocket.OPEN)
        socketRef.current.send(JSON.stringify(payload));
      else
        await ChatService.send(selectedId, {
          clientId,
          text: "",
          type: "AUDIO",
          attachments: [attachment],
          location: null,
          replyTo: reply?._id ?? null,
        });
    } catch {
      toast.error("Voice note could not be sent");
    } finally {
      setUploadProgress(null);
      setComposerPending(false);
    }
  }

  function shareLocation() {
    setAttachmentMenuOpen(false);
    if (!navigator.geolocation) {
      toast.error("Location sharing is not supported by this browser");
      return;
    }
    setComposerPending(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setSharedLocation({ latitude: coords.latitude, longitude: coords.longitude, label: "Current location" });
        setComposerPending(false);
      },
      () => {
        toast.error("Allow location access to share your current location");
        setComposerPending(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }
  async function updateSettings(input: {
    archived?: boolean;
    pinned?: boolean;
    mutedUntil?: string | null;
  }) {
    if (!selected) return;
    const conversation = await ChatService.settings(selected._id, input);
    const mySettings = populatedMembers(conversation.members).find(
      (member) => member.userId._id === user?.user_id,
    );
    setConversations((current) =>
      current.map((item) =>
        item._id === conversation._id
          ? { ...item, ...conversation, mySettings: mySettings ?? item.mySettings }
          : item,
      ),
    );
    if (input.archived !== undefined) {
      setDetailsOpen(false);
      if (input.archived) {
        openConversation(null);
        setTab("archived");
      } else setTab("all");
    }
  }
  function beginCall(type: "audio" | "video") {
    if (!selected || selected.type !== "DIRECT" || !canStartCall) return;
    const peer = populatedMembers(selected.members).find(
      (member) => member.userId._id !== user?.user_id,
    )?.userId;
    if (!peer) return;
    void startCall({
      conversationId: selected._id,
      peerUserId: peer._id,
      peerName: peer.name,
      type,
    });
  }

  if (view === "status" || view === "calls") return <div className={`${styles.workspace} h-full min-h-0 w-full`} data-theme={chatTheme}>
    {view === "status" ? <StatusWorkspace theme={chatTheme} onThemeChange={setChatTheme} /> : <CallsWorkspace theme={chatTheme} onThemeChange={setChatTheme} />}
  </div>;

  if (loading)
    return (
      <div className="flex h-full items-center justify-center" role="status" aria-label="Loading chats">
        <LoaderCircle className="animate-spin text-[#008069]" />
      </div>
    );
  return (
    <div className={`${styles.workspace} flex h-full min-h-0 w-full overflow-hidden`} data-theme={chatTheme}>
      <ConversationSidebar
        currentUserId={user?.user_id}
        theme={chatTheme}
        onThemeChange={setChatTheme}
        workspaceTitle={view === "communities" ? "Communities" : view === "channels" ? "Channels" : "First Chat"}
        hideFilters={view === "communities" || view === "channels"}
        canCreate={view !== "channels" && (view !== "communities" || canCreateCollective)}
        hidden={Boolean(selected)}
        socketState={socketState}
        search={search}
        onSearchChange={setSearch}
        tab={tab}
        onTabChange={setTab}
        conversations={visibleConversations}
        selectedId={selectedId}
        onSelectConversation={openConversation}
        onNewConversation={() => setComposerOpen(true)}
        title={title}
        subtitle={subtitle}
        showDepartmentTab={Boolean(
          user?.roles.some((role) => departmentChatRoles.has(role)),
        )}
      />

      {selected ? (
        <section aria-label={title(selected)} key={selected._id} data-conversation className="chat-conversation-enter flex min-h-0 min-w-0 flex-1 flex-col">
          <ChatHeader
            currentUserId={user?.user_id}
            conversation={selected}
            title={title(selected)}
            isTyping={typingUsers.length > 0}
            canStartCall={canStartCall}
            isCollectiveAdmin={isCollectiveAdmin}
            activeCallType={selectedActiveCall?.type ?? null}
            onBack={() => openConversation(null)}
            onOpenDetails={() => setDetailsOpen(true)}
            onStartCall={beginCall}
            onStartGroupCall={(type) =>
              isCollectiveAdmin && void startGroupCall({ conversationId: selected._id, conversationName: title(selected), type })
            }
            onJoinGroupCall={() =>
              void joinGroupCall({ conversationId: selected._id, conversationName: title(selected) })
            }
          />
          <MessageList
            viewportRef={messageViewportRef}
            endRef={endRef}
            messageCursor={messageCursor}
            loadingOlder={loadingOlder}
            onLoadOlder={() => void loadOlder()}
            loadingMessages={loadingMessages}
            messages={messages}
            currentUserId={user?.user_id}
            onReply={(message) => {
              setEditingMessage(null);
              setReplyTo(message);
              setText("");
              requestAnimationFrame(() => composerRef.current?.focus());
            }}
            onReact={(message, emoji) => void ChatService.react(message._id, emoji)}
            onEdit={(message) => {
              setReplyTo(null);
              setEditingMessage(message);
              setText(message.text);
              requestAnimationFrame(() => {
                composerRef.current?.focus();
                composerRef.current?.setSelectionRange(
                  message.text.length,
                  message.text.length,
                );
              });
            }}
            onDelete={(message, scope) => {
              if (scope === "me") hideMessageLocally(message._id, message.conversationId);
              if (editingMessage?._id === message._id) {
                setEditingMessage(null);
                setText("");
              }
              void ChatService.remove(message._id, scope).catch(() => {
                toast.error(scope === "me" ? "Message could not be deleted for you" : "Message could not be deleted for everyone");
                if (scope === "me" && selectedRef.current) void ChatService.messages(selectedRef.current).then((result) => setMessages(result.messages));
              });
            }}
            typingNames={typingUsers
              .map(
                (typingUserId) =>
                  populatedMembers(selected.members).find(
                    (member) => member.userId._id === typingUserId,
                  )?.userId.name,
              )
              .filter((name): name is string => Boolean(name))}
            showTypingName={selected.type !== "DIRECT"}
          />
          <ReplyEditBanner
            replyTo={replyTo}
            editingMessage={editingMessage}
            onCancel={() => {
              if (editingMessage) setText("");
              setEditingMessage(null);
              setReplyTo(null);
            }}
          />
          <AttachmentPreviewBar
            attachments={attachments}
            sharedLocation={sharedLocation}
            uploadProgress={uploadProgress}
            onRemoveAttachment={(index) =>
              setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))
            }
            onRemoveLocation={() => setSharedLocation(null)}
          />
          <MessageComposer
            composerRef={composerRef}
            text={text}
            editingMessage={editingMessage}
            onTextChange={signalTyping}
            onSubmit={send}
            attachmentMenuOpen={attachmentMenuOpen}
            onToggleAttachmentMenu={() => setAttachmentMenuOpen((current) => !current)}
            imageInputRef={imageInputRef}
            videoInputRef={videoInputRef}
            documentInputRef={documentInputRef}
            onFilesSelected={(files) => void uploadFiles(files)}
            onShareLocation={shareLocation}
            onVoiceRecorded={(file) => void sendVoiceNote(file)}
            composerPending={composerPending}
            canSubmit={Boolean(text.trim() || attachments.length || sharedLocation)}
          />
        </section>
      ) : (
        <EmptyChatPlaceholder view={view} />
      )}
      {composerOpen || contactsRequested ? (
        <NewConversationDialog
          initialMode={view === "communities" ? "COMMUNITY" : "DIRECT"}
          canCreateCollective={canCreateCollective}
          onClose={closeComposer}
          onCreated={(conversation) => {
            setConversations((current) => [
              conversation,
              ...current.filter((item) => item._id !== conversation._id),
            ]);
            openConversation(conversation._id);
            closeComposer();
          }}
        />
      ) : null}
      {detailsOpen && selected ? (
        <DetailsPanel
          conversation={selected}
          title={title(selected)}
          theme={chatTheme}
          currentUserId={user?.user_id ?? ""}
          messages={messages}
          onClose={() => setDetailsOpen(false)}
          onConversationChange={(conversation) =>
            setConversations((current) =>
              current.map((item) =>
                item._id === conversation._id
                  ? {
                      ...item,
                      ...conversation,
                      mySettings: item.mySettings,
                      lastMessage: item.lastMessage,
                      unreadCount: item.unreadCount,
                    }
                  : item,
              ),
            )
          }
          onPin={() =>
            void updateSettings({ pinned: !selected.mySettings?.pinned })
          }
          onMute={() =>
            void updateSettings({
              mutedUntil: selected.mySettings?.mutedUntil
                ? null
                : new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
            })
          }
          onArchive={() =>
            void updateSettings({ archived: !selected.mySettings?.archived })
          }
          canViewProfiles={canViewProfiles}
          onOpenProfile={setProfileUserId}
        />
      ) : null}
      {canViewProfiles ? (
        <UserProfileDialog
          userId={profileUserId}
          onClose={() => setProfileUserId(null)}
        />
      ) : null}
    </div>
  );
}
