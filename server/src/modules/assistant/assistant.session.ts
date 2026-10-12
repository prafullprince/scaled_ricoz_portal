import type { AgentInputItem, Session } from "@openai/agents";
import { Types } from "mongoose";
import { AssistantSession } from "../../models/index.js";

export class MongoAssistantSession implements Session {
  constructor(private readonly userId: string, private readonly sessionId: string) {}

  async getSessionId() {
    return `${this.userId}:${this.sessionId}`;
  }

  async getItems(limit?: number) {
    const session = await AssistantSession.findOne({ userId: this.userId, sessionId: this.sessionId }).select("items").lean();
    const items = (session?.items ?? []) as AgentInputItem[];
    return limit ? items.slice(-limit) : items;
  }

  async addItems(items: AgentInputItem[]) {
    if (!items.length) return;
    await AssistantSession.updateOne(
      { userId: new Types.ObjectId(this.userId), sessionId: this.sessionId },
      { $push: { items: { $each: items, $slice: -100 } } },
      { upsert: true },
    );
  }

  async popItem() {
    const session = await AssistantSession.findOneAndUpdate(
      { userId: this.userId, sessionId: this.sessionId },
      { $pop: { items: 1 } },
      { returnDocument: "before" },
    ).select("items").lean();
    return (session?.items.at(-1) as AgentInputItem | undefined) ?? undefined;
  }

  async clearSession() {
    await AssistantSession.deleteOne({ userId: this.userId, sessionId: this.sessionId });
  }
}
