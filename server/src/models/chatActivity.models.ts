import { Schema, model } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

const storySchema = new Schema({
  authorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  text: { type: String, default: "", maxlength: 700 },
  background: { type: String, default: "#254d43" },
  media: { url: String, mimeType: String, name: String },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const storyViewSchema = new Schema({
  storyId: { type: Schema.Types.ObjectId, ref: "ChatStory", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  viewedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});
storyViewSchema.index({ storyId: 1, userId: 1 }, { unique: true });
storyViewSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const callSchema = new Schema({
  callId: { type: String, required: true, unique: true, maxlength: 100 },
  conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
  callerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  calleeId: { type: Schema.Types.ObjectId, ref: "User" },
  participantIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
  kind: { type: String, enum: ["DIRECT", "GROUP"], default: "DIRECT" },
  type: { type: String, enum: ["audio", "video"], required: true },
  state: { type: String, enum: ["RINGING", "ANSWERED", "ENDED", "MISSED", "DECLINED", "CANCELLED", "BUSY", "FAILED"], default: "RINGING" },
  answeredAt: Date,
  endedAt: Date,
}, { timestamps: true });
callSchema.index({ participantIds: 1, _id: -1 });

storySchema.plugin(companyScoped);
storyViewSchema.plugin(companyScoped);
callSchema.plugin(companyScoped);
export const ChatStory = model("ChatStory", storySchema);
export const ChatStoryView = model("ChatStoryView", storyViewSchema);
export const ChatCallRecord = model("ChatCallRecord", callSchema);