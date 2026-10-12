import { Document, Schema, Types, model } from "mongoose";

export enum ConversationType {
  DIRECT = "DIRECT",
  GROUP = "GROUP",
  COMMUNITY = "COMMUNITY",
  ANNOUNCEMENT = "ANNOUNCEMENT",
}

export enum ChatMessageType {
  TEXT = "TEXT",
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  AUDIO = "AUDIO",
  DOCUMENT = "DOCUMENT",
  LOCATION = "LOCATION",
  SYSTEM = "SYSTEM",
}

export interface IConversation extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId | null;
  type: ConversationType;
  name?: string;
  description?: string;
  avatarUrl?: string;
  directKey?: string;
  communityId?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  admins: Types.ObjectId[];
  members: Array<{
    userId: Types.ObjectId;
    joinedAt: Date;
    lastReadAt: Date;
    mutedUntil?: Date | null;
    archived: boolean;
    pinned: boolean;
  }>;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const conversationMemberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    joinedAt: { type: Date, default: Date.now },
    lastReadAt: { type: Date, default: Date.now },
    mutedUntil: { type: Date, default: null },
    archived: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },
  },
  { _id: false },
);

const conversationSchema = new Schema<IConversation>(
  {
    type: { type: String, enum: Object.values(ConversationType), required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", default: null, index: true },
    name: { type: String, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500 },
    avatarUrl: { type: String, trim: true },
    directKey: { type: String },
    communityId: { type: Schema.Types.ObjectId, ref: "Conversation", default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    admins: [{ type: Schema.Types.ObjectId, ref: "User" }],
    members: { type: [conversationMemberSchema], required: true },
    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);
conversationSchema.index({ "members.userId": 1, lastMessageAt: -1 });

export interface IChatMessage extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId | null;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  clientId: string;
  type: ChatMessageType;
  text: string;
  attachments: Array<{ url: string; name: string; mimeType: string; size: number; duration?: number }>;
  location?: { latitude: number; longitude: number; label?: string } | null;
  replyTo?: Types.ObjectId | null;
  reactions: Array<{ emoji: string; userIds: Types.ObjectId[] }>;
  editedAt?: Date | null;
  deletedForEveryoneAt?: Date | null;
  hiddenFor: Types.ObjectId[];
  deliveredTo: Types.ObjectId[];
  readBy: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    name: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true, maxlength: 120 },
    size: { type: Number, required: true, min: 0 },
    duration: { type: Number, min: 0 },
  },
  { _id: false },
);

const locationSchema = new Schema(
  {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    label: { type: String, maxlength: 255 },
  },
  { _id: false },
);

const chatMessageSchema = new Schema<IChatMessage>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", default: null, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clientId: { type: String, required: true, maxlength: 100 },
    type: { type: String, enum: Object.values(ChatMessageType), default: ChatMessageType.TEXT },
    text: { type: String, default: "", maxlength: 10000 },
    attachments: { type: [attachmentSchema], default: [] },
    location: { type: locationSchema, default: null },
    replyTo: { type: Schema.Types.ObjectId, ref: "ChatMessage", default: null },
    reactions: { type: [{ emoji: String, userIds: [{ type: Schema.Types.ObjectId, ref: "User" }] }], default: [] },
    editedAt: { type: Date, default: null },
    deletedForEveryoneAt: { type: Date, default: null },
    hiddenFor: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
    deliveredTo: [{ type: Schema.Types.ObjectId, ref: "User" }],
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true },
);
chatMessageSchema.index({ conversationId: 1, createdAt: -1, _id: -1 });
chatMessageSchema.index({ senderId: 1, clientId: 1 }, { unique: true });

conversationSchema.index({ companyId: 1, directKey: 1 }, { unique: true, partialFilterExpression: { directKey: { $type: "string" } } });
export const Conversation = model<IConversation>("Conversation", conversationSchema);
export const ChatMessage = model<IChatMessage>("ChatMessage", chatMessageSchema);