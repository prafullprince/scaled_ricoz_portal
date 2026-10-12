import api from "./axios";
import { getActiveCompanyId } from "@/lib/company";

export type ChatUser = { _id: string; name: string; email: string; profile_pic?: string; about?: string; lastSeen?: string; roles: string[] };
export type ChatMember = { userId: ChatUser | null; joinedAt: string; lastReadAt: string; mutedUntil?: string | null; archived: boolean; pinned: boolean };
export type ChatReaction = { emoji: string; userIds: string[] };
export type ChatAttachment = { url: string; name: string; mimeType: string; size: number; duration?: number };
export type ChatLocation = { latitude: number; longitude: number; label?: string };
export type ChatMessage = { _id: string; conversationId: string; senderId: ChatUser | string | null; clientId: string; type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "LOCATION" | "SYSTEM"; text: string; attachments: ChatAttachment[]; location?: ChatLocation | null; replyTo?: ChatMessage | string | null; reactions: ChatReaction[]; editedAt?: string | null; deletedForEveryoneAt?: string | null; deliveredTo: string[]; readBy: string[]; createdAt: string; pending?: boolean };
export type Conversation = { _id: string; type: "DIRECT" | "GROUP" | "COMMUNITY" | "ANNOUNCEMENT"; name?: string; description?: string; avatarUrl?: string; communityId?: string | null; createdBy: string; admins: string[]; members: ChatMember[]; lastMessageAt: string; lastMessage?: ChatMessage | null; unreadCount: number; mySettings?: ChatMember };
export type GroupCallInfo = { token: string; url: string; roomName: string; type: "audio" | "video"; isAdmin: boolean };
export type ActiveGroupCall = { roomName: string; type: "audio" | "video"; startedBy: string; startedByName: string; conversationName: string; startedAt: number };

export type ChatStory = { _id: string; authorId: Pick<ChatUser, "_id" | "name" | "profile_pic">; text: string; background: string; media?: { url: string; mimeType: string; name: string }; createdAt: string; expiresAt: string; viewed: boolean; viewCount?: number };
export type StoryView = { _id: string; userId: Pick<ChatUser, "_id" | "name" | "profile_pic"> | null; viewedAt: string };
export type CallHistoryEntry = { _id: string; callId: string; callerId: ChatUser | null; calleeId?: ChatUser | null; conversationId: { _id: string; name?: string; type: string; admins: string[]; members: { userId: string }[] } | null; kind: "DIRECT" | "GROUP"; type: "audio" | "video"; state: "RINGING" | "ANSWERED" | "ENDED" | "MISSED" | "DECLINED" | "CANCELLED" | "BUSY" | "FAILED"; createdAt: string; answeredAt?: string; endedAt?: string };

export const MESSAGE_EDIT_WINDOW_MS = 60 * 60 * 1000;

export const ChatService = {
  async stories(cursor?: string, signal?: AbortSignal) { const response = await api.get<{ stories: ChatStory[]; nextCursor: string | null }>("/chat/statuses", { params: { cursor }, signal }); return response.data; },
  async publishStory(input: { text: string; background: string; file: File | null }, onProgress: (progress: number) => void) {
    const data = new FormData();
    data.append("text", input.text);
    data.append("background", input.background);
    if (input.file) data.append("file", input.file);
    await api.post("/chat/statuses", data, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000, onUploadProgress: (event) => { if (event.total) onProgress(Math.round(event.loaded / event.total * 100)); } });
  },
  async viewStory(id: string) { await api.post(`/chat/statuses/${id}/views`); },
  async storyViewers(id: string, cursor?: string) { const response = await api.get<{ views: StoryView[]; total: number; nextCursor: string | null }>(`/chat/statuses/${id}/views`, { params: { cursor } }); return response.data; },
  async deleteStory(id: string) { await api.delete(`/chat/statuses/${id}`); },
  async callHistory(cursor?: string, signal?: AbortSignal) { const response = await api.get<{ calls: CallHistoryEntry[]; nextCursor: string | null }>("/chat/calls", { params: { cursor }, signal }); return response.data; },
  async unreadCount() { const response = await api.get<{ unreadCount: number }>("/chat/unread-count"); return response.data.unreadCount; },
  async conversations(cursor?: string) { const response = await api.get<{ conversations: Conversation[]; nextCursor: string | null }>("/chat/conversations", { params: { cursor, limit: 30 } }); return response.data; },
  async messages(conversationId: string, before?: string, limit = 40) { const response = await api.get<{ messages: ChatMessage[]; nextCursor: string | null }>(`/chat/conversations/${conversationId}/messages`, { params: { before, limit } }); return response.data; },
  async contacts(search = "") { const response = await api.get<{ users: ChatUser[] }>("/chat/contacts", { params: { search } }); return response.data.users; },
  async direct(userId: string) { const response = await api.post<{ conversation: Conversation }>("/chat/conversations/direct", { userId }); return response.data.conversation; },
  async create(input: { type: "GROUP" | "COMMUNITY"; name: string; description?: string; memberIds: string[] }) { const response = await api.post<{ conversation: Conversation }>("/chat/conversations", input); return response.data.conversation; },
  async createCommunityGroup(communityId: string, input: { name: string; description?: string; memberIds: string[] }) { const response = await api.post<{ conversation: Conversation }>(`/chat/communities/${communityId}/groups`, input); return response.data.conversation; },
  async addMembers(conversationId: string, userIds: string[]) { const response = await api.post<{ conversation: Conversation }>(`/chat/conversations/${conversationId}/members`, { userIds }); return response.data.conversation; },
  async removeMember(conversationId: string, userId: string) { const response = await api.delete<{ conversation: Conversation }>(`/chat/conversations/${conversationId}/members/${userId}`); return response.data.conversation; },
  async promoteAdmin(conversationId: string, userId: string) { const response = await api.post<{ conversation: Conversation }>(`/chat/conversations/${conversationId}/admins/${userId}`); return response.data.conversation; },
  async demoteAdmin(conversationId: string, userId: string) { const response = await api.delete<{ conversation: Conversation }>(`/chat/conversations/${conversationId}/admins/${userId}`); return response.data.conversation; },
  async groupCallStatus(conversationId: string) { const response = await api.get<{ activeCall: ActiveGroupCall | null }>(`/chat/conversations/${conversationId}/call`); return response.data.activeCall; },
  async startGroupCall(conversationId: string, type: "audio" | "video") { const response = await api.post<GroupCallInfo>(`/chat/conversations/${conversationId}/call`, { type }); return response.data; },
  async joinGroupCall(conversationId: string) { const response = await api.post<GroupCallInfo>(`/chat/conversations/${conversationId}/call/join`); return response.data; },
  async endGroupCall(conversationId: string) { await api.delete(`/chat/conversations/${conversationId}/call`); },
  async send(conversationId: string, input: { clientId: string; text: string; type?: string; attachments?: ChatAttachment[]; location?: ChatLocation | null; replyTo?: string | null }) { await api.post(`/chat/conversations/${conversationId}/messages`, input); },
  async upload(file: File, onProgress?: (progress: number) => void) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<{ attachment: ChatAttachment }>("/chat/attachments", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000,
      onUploadProgress: (event) => {
        if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100));
      },
    });
    return response.data.attachment;
  },
  async markRead(conversationId: string, messageId: string) { await api.post(`/chat/conversations/${conversationId}/read`, { messageId }); },
  async settings(conversationId: string, input: { archived?: boolean; pinned?: boolean; mutedUntil?: string | null }) { const response = await api.patch<{ conversation: Conversation }>(`/chat/conversations/${conversationId}/settings`, input); return response.data.conversation; },
  async edit(messageId: string, text: string) { const response = await api.patch<{ message: ChatMessage }>(`/chat/messages/${messageId}`, { text }); return response.data.message; },
  async remove(messageId: string, scope: "me" | "everyone" = "everyone") { await api.delete(`/chat/messages/${messageId}`, { params: { scope } }); },
  async react(messageId: string, emoji: string) { const response = await api.post<{ reactions: ChatReaction[] }>(`/chat/messages/${messageId}/reactions`, { emoji }); return response.data.reactions; },
};

export function chatWebSocketUrl(token: string) {
  const companyId = getActiveCompanyId();
  const query = `token=${encodeURIComponent(token)}${companyId ? `&companyId=${encodeURIComponent(companyId)}` : ""}`;
  if (process.env.NEXT_PUBLIC_CHAT_WS_URL) return `${process.env.NEXT_PUBLIC_CHAT_WS_URL}?${query}`;
  const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001/api/v1");
  apiUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  apiUrl.pathname = "/ws/chat";
  apiUrl.search = query;
  return apiUrl.toString();
}