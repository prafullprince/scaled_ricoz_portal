import { Redis } from "ioredis";
import { Queue, Worker, type Job } from "bullmq";
import { ChatMessage, Conversation } from "../../models/index.js";
import { runWithCompany, scopeFor } from "../company/company.context.js";

export type QueuedChatMessage = {
  conversationId: string;
  senderId: string;
  clientId: string;
  type: string;
  text: string;
  attachments: Array<{ url: string; name: string; mimeType: string; size: number; duration?: number | undefined }>;
  location?: { latitude: number; longitude: number; label?: string | undefined } | null;
  replyTo?: string | null;
  companyId?: string | null;
};

const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
// BullMQ uses multi-key Lua scripts. The hash tag keeps every queue key in one Valkey Cluster slot.
const bullmqPrefix = process.env.BULLMQ_PREFIX ?? "{bull}";
const queueConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
export const chatQueue = new Queue<QueuedChatMessage>("chat-message-persistence", {
  connection: queueConnection,
  prefix: bullmqPrefix,
  defaultJobOptions: { attempts: 5, backoff: { type: "exponential", delay: 500 }, removeOnComplete: 1000, removeOnFail: 5000 },
});

export function createRedisConnection() {
  return new Redis(redisUrl, { maxRetriesPerRequest: null });
}

export async function publishChatEvent(event: object, recipients: string[], timeoutMs?: number) {
  const publisher = createRedisConnection();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const publication = publisher.publish("chat:events", JSON.stringify({ event, recipients }));
    if (timeoutMs) await Promise.race([publication, new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("Notification publish timed out")), timeoutMs); })]);
    else await publication;
  } finally {
    if (timer) clearTimeout(timer);
    publisher.disconnect();
  }
}

export type ActiveGroupCall = {
  roomName: string;
  type: "audio" | "video";
  startedBy: string;
  startedByName: string;
  conversationName: string;
  startedAt: number;
};

const stateConnection = createRedisConnection();
const activeCallKey = (conversationId: string) => `chat:call:${conversationId}`;
// Safety net in case a crashed process never clears the key.
const activeCallTtlSeconds = 6 * 60 * 60;

export async function setActiveGroupCall(conversationId: string, call: ActiveGroupCall) {
  await stateConnection.set(activeCallKey(conversationId), JSON.stringify(call), "EX", activeCallTtlSeconds);
}

export async function getActiveGroupCall(conversationId: string): Promise<ActiveGroupCall | null> {
  const raw = await stateConnection.get(activeCallKey(conversationId));
  return raw ? (JSON.parse(raw) as ActiveGroupCall) : null;
}

export async function clearActiveGroupCall(conversationId: string) {
  await stateConnection.del(activeCallKey(conversationId));
}

async function persistMessage(job: Job<QueuedChatMessage>) {
  const { companyId, ...payload } = job.data;
  // Jobs queued before multi-company support have no companyId and belong to the default company.
  return runWithCompany(scopeFor(companyId ?? null), async () => {
    const conversation = await Conversation.findOne({ _id: payload.conversationId, "members.userId": payload.senderId }).lean();
    if (!conversation) throw new Error("Sender is not a conversation member");
    const message = await ChatMessage.findOneAndUpdate(
      { senderId: payload.senderId, clientId: payload.clientId },
      { $setOnInsert: { ...payload, readBy: [payload.senderId], deliveredTo: [payload.senderId] } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    ).populate("senderId", "name email profile_pic").populate("replyTo").lean();
    await Conversation.updateOne({ _id: payload.conversationId }, { $set: { lastMessageAt: message!.createdAt } });
    await publishChatEvent({ type: "message.created", message }, conversation.members.map((member) => String(member.userId)));
    return message;
  });
}

export function startChatWorker() {
  const worker = new Worker<QueuedChatMessage>("chat-message-persistence", persistMessage, {
    connection: createRedisConnection(),
    prefix: bullmqPrefix,
    concurrency: Number(process.env.CHAT_WORKER_CONCURRENCY ?? 20),
  });
  worker.on("failed", (job, error) => console.error("Chat message job failed", job?.id, error));
  return worker;
}
