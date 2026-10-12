import type { AgentInputItem, Session } from "@openai/agents";
import { Types } from "mongoose";
import { InvestorForecastChatSession } from "../../models/index.js";

export class MongoInvestorForecastChatSession implements Session {
  constructor(
    private readonly userId: string,
    private readonly sessionId: string,
    private readonly fiscalYearStart: number,
  ) {}

  async getSessionId() {
    return `${this.userId}:${this.sessionId}`;
  }

  async getItems(limit?: number) {
    const session = await InvestorForecastChatSession.findOne({
      userId: this.userId,
      sessionId: this.sessionId,
    }).select("items").lean();
    const items = (session?.items ?? []) as AgentInputItem[];
    return limit ? items.slice(-limit) : items;
  }

  async addItems(items: AgentInputItem[]) {
    if (!items.length) return;
    await InvestorForecastChatSession.updateOne(
      { userId: new Types.ObjectId(this.userId), sessionId: this.sessionId },
      {
        $setOnInsert: {
          userId: new Types.ObjectId(this.userId),
          sessionId: this.sessionId,
          fiscalYearStart: this.fiscalYearStart,
          title: "Financial forecast chat",
        },
        $push: { items: { $each: items, $slice: -80 } },
      },
      { upsert: true },
    );
  }

  async popItem() {
    const session = await InvestorForecastChatSession.findOneAndUpdate(
      { userId: this.userId, sessionId: this.sessionId },
      { $pop: { items: 1 } },
      { returnDocument: "before" },
    ).select("items").lean();
    return (session?.items.at(-1) as AgentInputItem | undefined) ?? undefined;
  }

  async clearSession() {
    await InvestorForecastChatSession.updateOne(
      { userId: this.userId, sessionId: this.sessionId },
      { $set: { items: [] } },
    );
  }
}
