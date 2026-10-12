import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

import { env } from "@/config/env";
import { api } from "@/services/api";
import type {
  ChatAttachment,
  ChatContact,
  ChatMessage,
  ChatStory,
  ChatCallRecord,
  Conversation,
} from "@/types/chat";

type NativeUpload = { uri: string; name: string; mimeType: string };
export type CallCredentials = {
  token: string;
  url: string;
  roomName: string;
  type: "audio" | "video";
  isAdmin: boolean;
};
export type ActiveCall = {
  roomName: string;
  type: "audio" | "video";
  startedBy: string;
  startedByName: string;
  conversationName?: string;
  startedAt: number | string;
};

const upload = async (file: NativeUpload) => {
  const formData = new FormData();
  formData.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob);
  const response = await api.post<{ attachment: ChatAttachment }>(
    "/chat/attachments",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120_000,
    },
  );
  return response.data.attachment;
};

export const chatService = {
  async unreadCount() {
    const response = await api.get<{ unreadCount: number }>("/chat/unread-count");
    return response.data.unreadCount;
  },
  async stories(cursor?: string) {
    const response = await api.get<{ stories: ChatStory[]; nextCursor: string | null }>("/chat/statuses", { params: { cursor, limit: 30 } });
    return response.data;
  },
  async createStory(text: string, background: string) {
    await api.post("/chat/statuses", { text, background });
  },
  async viewStory(storyId: string) {
    await api.post(`/chat/statuses/${storyId}/views`);
  },
  async storyViewers(storyId: string, cursor?: string) {
    const response = await api.get<{ views: { _id: string; userId: { name: string } | null; viewedAt: string }[]; total: number; nextCursor: string | null }>(`/chat/statuses/${storyId}/views`, { params: { cursor, limit: 30 } });
    return response.data;
  },
  async deleteStory(storyId: string) {
    await api.delete(`/chat/statuses/${storyId}`);
  },
  async callHistory(cursor?: string) {
    const response = await api.get<{ calls: ChatCallRecord[]; nextCursor: string | null }>("/chat/calls", { params: { cursor, limit: 30 } });
    return response.data;
  },
  async iceServers() {
    const response = await api.get<{ iceServers: { urls: string[]; username?: string; credential?: string }[] }>("/chat/calls/ice-servers");
    return response.data.iceServers;
  },
  async contacts(search = "") {
    const response = await api.get<{ users: ChatContact[] }>("/chat/contacts", {
      params: search ? { search } : undefined,
    });
    return response.data.users;
  },
  async conversations() {
    const response = await api.get<{ conversations: Conversation[] }>(
      "/chat/conversations",
      { params: { limit: 30 } },
    );
    return response.data.conversations;
  },
  async messages(conversationId: string) {
    const response = await api.get<{ messages: ChatMessage[] }>(
      `/chat/conversations/${conversationId}/messages`,
      { params: { limit: 40 } },
    );
    return response.data.messages;
  },
  async createDirectConversation(userId: string) {
    const response = await api.post<{ conversation: Conversation }>(
      "/chat/conversations/direct",
      { userId },
    );
    return response.data.conversation;
  },
  async createConversation(input: { type: 'GROUP' | 'COMMUNITY'; name: string; memberIds: string[] }) {
    const response = await api.post<{ conversation: Conversation }>('/chat/conversations', input);
    return response.data.conversation;
  },
  async updateSettings(conversationId: string, input: { archived?: boolean; pinned?: boolean; mutedUntil?: string | null }) {
    const response = await api.patch<{ conversation: Conversation }>(`/chat/conversations/${conversationId}/settings`, input);
    return response.data.conversation;
  },
  async addMembers(conversationId: string, userIds: string[]) {
    const response = await api.post<{ conversation: Conversation }>(`/chat/conversations/${conversationId}/members`, { userIds });
    return response.data.conversation;
  },
  async removeMember(conversationId: string, userId: string) {
    const response = await api.delete<{ conversation: Conversation }>(`/chat/conversations/${conversationId}/members/${userId}`);
    return response.data.conversation;
  },
  async promoteAdmin(conversationId: string, userId: string) {
    const response = await api.post<{ conversation: Conversation }>(`/chat/conversations/${conversationId}/admins/${userId}`);
    return response.data.conversation;
  },
  async demoteAdmin(conversationId: string, userId: string) {
    const response = await api.delete<{ conversation: Conversation }>(`/chat/conversations/${conversationId}/admins/${userId}`);
    return response.data.conversation;
  },
  async send(
    conversationId: string,
    input: Omit<
      Partial<ChatMessage>,
      "_id" | "conversationId" | "senderId" | "createdAt"
    > & { clientId: string; text: string },
  ) {
    const response = await api.post<{
      success: boolean;
      queued: boolean;
      clientId: string;
    }>(`/chat/conversations/${conversationId}/messages`, input);
    return response.data;
  },
  async markRead(conversationId: string, messageId: string) {
    await api.post(`/chat/conversations/${conversationId}/read`, { messageId });
  },
  async pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    return upload({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? "application/octet-stream",
    });
  },
  async pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      throw new Error("Photo library permission is required.");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    return upload({
      uri: asset.uri,
      name: asset.fileName ?? "photo.jpg",
      mimeType: asset.mimeType ?? "image/jpeg",
    });
  },
  async currentLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted)
      throw new Error("Location permission is required.");
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  },
  async activeCall(conversationId: string) {
    const response = await api.get<{ activeCall: ActiveCall | null }>(
      `/chat/conversations/${conversationId}/call`,
    );
    return response.data.activeCall;
  },
  async startGroupCall(conversationId: string, type: "audio" | "video") {
    const response = await api.post<CallCredentials>(
      `/chat/conversations/${conversationId}/call`,
      { type },
    );
    return response.data;
  },
  async joinGroupCall(conversationId: string) {
    const response = await api.post<CallCredentials>(
      `/chat/conversations/${conversationId}/call/join`,
    );
    return response.data;
  },
  async endGroupCall(conversationId: string) {
    await api.delete(`/chat/conversations/${conversationId}/call`);
  },
  webSocketUrl(accessToken: string) {
    return `${env.chatWebSocketUrl}?token=${encodeURIComponent(accessToken)}`;
  },
};
