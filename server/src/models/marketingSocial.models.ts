import { Schema, model, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export const MarketingSocialProvider = {
  LINKEDIN: "LINKEDIN",
  FACEBOOK: "FACEBOOK",
  INSTAGRAM: "INSTAGRAM",
  WHATSAPP: "WHATSAPP",
} as const;
export type MarketingSocialProvider = keyof typeof MarketingSocialProvider;

export interface MarketingSocialAccountRecord {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  provider: MarketingSocialProvider;
  providerAccountId: string;
  name: string;
  avatarUrl: string;
  encryptedAccessToken: string;
  tokenExpiresAt: Date | null;
  scopes: string[];
  pageId: string;
  businessAccountId: string;
  connectedBy: Types.ObjectId;
  status: "CONNECTED" | "ERROR" | "DISCONNECTED";
  lastError: string;
  createdAt: Date;
  updatedAt: Date;
}

const socialAccountSchema = new Schema<MarketingSocialAccountRecord>({
  provider: { type: String, enum: Object.keys(MarketingSocialProvider), required: true },
  providerAccountId: { type: String, required: true, maxlength: 160 },
  name: { type: String, required: true, maxlength: 160 },
  avatarUrl: { type: String, default: "" },
  encryptedAccessToken: { type: String, default: "", select: false },
  tokenExpiresAt: { type: Date, default: null },
  scopes: { type: [String], default: [] },
  pageId: { type: String, default: "" },
  businessAccountId: { type: String, default: "" },
  connectedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["CONNECTED", "ERROR", "DISCONNECTED"], default: "CONNECTED" },
  lastError: { type: String, default: "" },
}, { timestamps: true });
socialAccountSchema.plugin(companyScoped);
socialAccountSchema.index({ companyId: 1, provider: 1, providerAccountId: 1 }, { unique: true });
export const MarketingSocialAccount = model<MarketingSocialAccountRecord>("MarketingSocialAccount", socialAccountSchema);

export interface MarketingSocialOAuthStateRecord {
  companyId: Types.ObjectId;
  stateHash: string;
  provider: "LINKEDIN" | "META" | "WHATSAPP";
  userId: Types.ObjectId;
  expiresAt: Date;
}
const socialOAuthStateSchema = new Schema<MarketingSocialOAuthStateRecord>({
  stateHash: { type: String, required: true, unique: true },
  provider: { type: String, enum: ["LINKEDIN", "META", "WHATSAPP"], required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true });
socialOAuthStateSchema.plugin(companyScoped);
export const MarketingSocialOAuthState = model<MarketingSocialOAuthStateRecord>("MarketingSocialOAuthState", socialOAuthStateSchema);

export interface MarketingSocialPostRecord {
  companyId: Types.ObjectId;
  accountId: Types.ObjectId;
  provider: MarketingSocialProvider;
  text: string;
  mediaUrl: string;
  postUrl: string;
  source: "RICOZ" | "PLATFORM";
  status: "DRAFT" | "PUBLISHED" | "FAILED";
  externalPostId: string;
  error: string;
  publishedAt: Date | null;
  createdBy: Types.ObjectId;
}
const socialPostSchema = new Schema<MarketingSocialPostRecord>({
  accountId: { type: Schema.Types.ObjectId, ref: "MarketingSocialAccount", required: true },
  provider: { type: String, enum: Object.keys(MarketingSocialProvider), required: true },
  text: { type: String, required: true, maxlength: 3000 },
  mediaUrl: { type: String, default: "" },
  postUrl: { type: String, default: "" },
  source: { type: String, enum: ["RICOZ", "PLATFORM"], default: "RICOZ" },
  status: { type: String, enum: ["DRAFT", "PUBLISHED", "FAILED"], default: "DRAFT" },
  externalPostId: { type: String, default: "" },
  error: { type: String, default: "" },
  publishedAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
socialPostSchema.plugin(companyScoped);
socialPostSchema.index({ companyId: 1, createdAt: -1 });
socialPostSchema.index({ companyId: 1, accountId: 1, externalPostId: 1 });
export const MarketingSocialPost = model<MarketingSocialPostRecord>("MarketingSocialPost", socialPostSchema);

export interface MarketingSocialConversationRecord {
  companyId: Types.ObjectId;
  accountId: Types.ObjectId;
  provider: MarketingSocialProvider;
  externalConversationId: string;
  participantId: string;
  participantName: string;
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: number;
}
const socialConversationSchema = new Schema<MarketingSocialConversationRecord>({
  accountId: { type: Schema.Types.ObjectId, ref: "MarketingSocialAccount", required: true },
  provider: { type: String, enum: Object.keys(MarketingSocialProvider), required: true },
  externalConversationId: { type: String, required: true, maxlength: 200 },
  participantId: { type: String, required: true, maxlength: 200 },
  participantName: { type: String, default: "Social contact", maxlength: 160 },
  lastMessage: { type: String, default: "", maxlength: 4000 },
  lastMessageAt: { type: Date, required: true },
  unreadCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true });
socialConversationSchema.plugin(companyScoped);
socialConversationSchema.index({ companyId: 1, accountId: 1, externalConversationId: 1 }, { unique: true });
export const MarketingSocialConversation = model<MarketingSocialConversationRecord>("MarketingSocialConversation", socialConversationSchema);

export interface MarketingSocialMessageRecord {
  companyId: Types.ObjectId;
  conversationId: Types.ObjectId;
  externalMessageId: string;
  direction: "INBOUND" | "OUTBOUND";
  body: string;
  sentAt: Date;
  deliveryStatus: "RECEIVED" | "SENT" | "FAILED";
}
const socialMessageSchema = new Schema<MarketingSocialMessageRecord>({
  conversationId: { type: Schema.Types.ObjectId, ref: "MarketingSocialConversation", required: true },
  externalMessageId: { type: String, required: true, maxlength: 200 },
  direction: { type: String, enum: ["INBOUND", "OUTBOUND"], required: true },
  body: { type: String, required: true, maxlength: 4000 },
  sentAt: { type: Date, required: true },
  deliveryStatus: { type: String, enum: ["RECEIVED", "SENT", "FAILED"], required: true },
}, { timestamps: true });
socialMessageSchema.plugin(companyScoped);
socialMessageSchema.index({ companyId: 1, conversationId: 1, sentAt: 1 });
socialMessageSchema.index({ companyId: 1, externalMessageId: 1 }, { unique: true, sparse: true });
export const MarketingSocialMessage = model<MarketingSocialMessageRecord>("MarketingSocialMessage", socialMessageSchema);
