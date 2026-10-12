export interface ChatUser {
  _id: string;
  name: string;
  email: string;
  profile_pic?: string;
  roles?: string[];
}

export interface ChatStory {
  _id: string;
  authorId: ChatUser;
  text: string;
  background: string;
  media?: { url: string; mimeType: string; name: string };
  expiresAt: string;
  viewed: boolean;
  viewCount?: number;
}

export interface ChatCallRecord {
  _id: string;
  callerId: ChatUser | null;
  calleeId: ChatUser | null;
  conversationId: { _id: string; name?: string; type: string } | null;
  type: 'audio' | 'video';
  state: string;
  createdAt: string;
  answeredAt?: string;
  endedAt?: string;
}

export interface ChatContact extends ChatUser {
  about?: string;
  lastSeen?: string;
  roles?: string[];
}

export interface ChatMember {
  userId: ChatUser;
}

export interface ChatAttachment {
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface ChatMessage {
  _id: string;
  conversationId: string;
  clientId: string;
  senderId: ChatUser | string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'LOCATION' | 'SYSTEM';
  text: string;
  attachments: ChatAttachment[];
  location?: { latitude: number; longitude: number; label?: string } | null;
  deliveredTo?: (ChatUser | string)[];
  readBy?: (ChatUser | string)[];
  createdAt: string;
  pending?: boolean;
}

export interface Conversation {
  _id: string;
  type: 'DIRECT' | 'GROUP' | 'COMMUNITY' | 'ANNOUNCEMENT';
  name?: string;
  members: ChatMember[];
  lastMessage?: ChatMessage | null;
  lastMessageAt: string;
  unreadCount: number;
  communityId?: string | null;
  createdBy?: string;
  admins?: string[];
  mySettings?: { archived?: boolean; pinned?: boolean; mutedUntil?: string | null };
}