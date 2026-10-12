import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const attachment = z.object({ url: z.url(), name: z.string().min(1).max(255), mimeType: z.string().min(1).max(120), size: z.number().nonnegative().max(50 * 1024 * 1024), duration: z.number().nonnegative().optional() });
const location = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), label: z.string().max(255).optional() });

export const createDirectChatSchema = z.object({ body: z.object({ userId: objectId }) });
export const createConversationSchema = z.object({ body: z.object({ type: z.enum(["GROUP", "COMMUNITY"]), name: z.string().min(2).max(120), description: z.string().max(500).optional(), memberIds: z.array(objectId).max(1024).default([]) }) });
export const createCommunityGroupSchema = z.object({ body: z.object({ name: z.string().min(2).max(120), description: z.string().max(500).optional(), memberIds: z.array(objectId).max(1024).default([]) }) });
export const conversationMemberSchema = z.object({ body: z.object({ userIds: z.array(objectId).min(1).max(256) }) });
export const conversationSettingsSchema = z.object({ body: z.object({ archived: z.boolean().optional(), pinned: z.boolean().optional(), mutedUntil: z.iso.datetime().nullable().optional() }) });
export const sendMessageSchema = z.object({ body: z.object({ clientId: z.string().min(1).max(100), type: z.enum(["TEXT", "IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "LOCATION"]).default("TEXT"), text: z.string().max(10000).default(""), attachments: z.array(attachment).max(10).default([]), location: location.nullable().optional(), replyTo: objectId.nullable().optional() }).refine((body) => body.text.trim() || body.attachments.length || body.location, "Message cannot be empty") });
export const editMessageSchema = z.object({ body: z.object({ text: z.string().min(1).max(10000) }) });
export const deleteMessageSchema = z.object({ query: z.object({ scope: z.enum(["me", "everyone"]).default("everyone") }) });
export const messageEditWindowMs = 60 * 60 * 1000;
export const reactionSchema = z.object({ body: z.object({ emoji: z.string().min(1).max(16) }) });
export const readMessageSchema = z.object({ body: z.object({ messageId: objectId }) });
export const startGroupCallSchema = z.object({ body: z.object({ type: z.enum(["audio", "video"]).default("video") }) });

export const storyInputSchema = z.object({
	text: z.string().trim().max(700).default(""),
	background: z.enum(["#254d43", "#51436b", "#755149", "#284b63", "#333333"]).default("#254d43"),
});
export const activityPageSchema = z.object({
	cursor: objectId.optional(),
	limit: z.coerce.number().int().min(1).max(50).default(30),
});

export function finishedCallState(answered: boolean, caller: boolean, reason?: string) {
	if (answered) return "ENDED";
	if (reason === "busy") return "BUSY";
	if (reason === "declined") return "DECLINED";
	if (reason === "timeout" || reason === "unanswered") return "MISSED";
	if (reason === "failed" || reason === "connection-failed") return "FAILED";
	return caller ? "CANCELLED" : "MISSED";
}