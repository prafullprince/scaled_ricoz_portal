import type { NextFunction, Request, Response } from "express";
import { Agent, run } from "@openai/agents";
import { Types } from "mongoose";
import { randomUUID } from "node:crypto";
import {
  CostPlan,
  InvestorCompanyAccess,
  InvestorForecastChatSession,
  ResourcePlan,
  RevenueForecast,
} from "../../models/index.js";
import { UserRole } from "../auth/authorization.js";
import { getOrCreateInvestorProfile } from "../verification/profile.service.js";
import { buildInvestorFinancialPlan } from "../finance/investor-financial-plan.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { MongoInvestorForecastChatSession } from "./investor-forecast-chat.session.js";
import type {
  IInvestorForecastChatMessage,
  IInvestorForecastChatSession,
} from "../../models/investor-forecast-chat.models.js";

const getActor = (req: Request) => {
  if (!req.authUser || !req.company || !req.authUser.roles.includes(UserRole.INVESTOR)) {
    throw new ApiError(403, "Investor access is required");
  }
  return { userId: String(req.authUser._id), companyId: String(req.company._id) };
};

export async function requireVerifiedInvestorCompanyAccess(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.authUser?.roles.includes(UserRole.INVESTOR) || !req.company) {
      return res.status(403).json({ success: false, message: "Investor access is required" });
    }
    const profile = await getOrCreateInvestorProfile(req.authUser._id);
    if (!profile.isVerified) {
      return res.status(403).json({ success: false, message: "Your investor account is not yet verified" });
    }
    const grant = await InvestorCompanyAccess.exists({
      investorId: req.authUser._id,
      companyId: req.company._id,
      active: true,
    });
    if (!grant) {
      return res.status(403).json({ success: false, message: "Your investor account does not have access to this company" });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

async function getCompanyPlan(fiscalYearStart: number) {
  const [revenue, resources, costs] = await Promise.all([
    RevenueForecast.findOne({ fiscalYearStart }).lean(),
    ResourcePlan.findOne({ fiscalYearStart }).lean(),
    CostPlan.findOne({ fiscalYearStart }).lean(),
  ]);
  const updatedAt = [revenue?.updatedAt, resources?.updatedAt, costs?.updatedAt]
    .filter((date): date is Date => Boolean(date))
    .reduce<Date | null>((latest, date) => !latest || date > latest ? date : latest, null);
  return buildInvestorFinancialPlan({
    fiscalYearStart,
    revenueStreams: revenue?.streams ?? [],
    resources: resources?.resources ?? [],
    costCategories: costs?.categories ?? [],
    updatedAt,
  });
}

const messageView = (message: IInvestorForecastChatMessage) => ({
  role: message.role,
  content: message.content,
  createdAt: message.createdAt,
});
const MAX_ASSISTANT_RESPONSE_CHARS = 24_000;
const RESPONSE_TRUNCATION_NOTICE = "\n\n_Response truncated to fit the display limit._";

export async function listInvestorForecastChatSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getActor(req);
    const sessions = await InvestorForecastChatSession.find()
      .where("userId").equals(new Types.ObjectId(userId))
      .select("sessionId fiscalYearStart title updatedAt")
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean<IInvestorForecastChatSession[]>();
    return res.json({
      success: true,
      sessions: sessions.map((session) => ({
        sessionId: session.sessionId,
        fiscalYearStart: session.fiscalYearStart,
        title: session.title,
        updatedAt: session.updatedAt,
        messages: [],
      })),
    });
  } catch (error) {
    return next(error);
  }
}

export async function getInvestorForecastChatSession(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getActor(req);
    const session = await InvestorForecastChatSession.findOne()
      .where("userId").equals(new Types.ObjectId(userId))
      .where("sessionId").equals(req.params.sessionId)
      .select("sessionId fiscalYearStart title updatedAt messages").lean<IInvestorForecastChatSession>();
    if (!session) throw new ApiError(404, "Forecast chat session not found");
    return res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        fiscalYearStart: session.fiscalYearStart,
        title: session.title,
        updatedAt: session.updatedAt,
        messages: session.messages.map(messageView),
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function createInvestorForecastChatSession(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getActor(req);
    const fiscalYearStart = Number(req.body.fiscalYearStart);
    const sessionId = randomUUID();
    const session = await InvestorForecastChatSession.create({
      userId: new Types.ObjectId(userId),
      sessionId,
      fiscalYearStart,
      title: "New forecast chat",
      items: [],
      messages: [],
    });
    return res.status(201).json({
      success: true,
      session: {
        sessionId: session.sessionId,
        fiscalYearStart: session.fiscalYearStart,
        title: session.title,
        updatedAt: session.updatedAt,
        messages: [],
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteInvestorForecastChatSession(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getActor(req);
    const result = await InvestorForecastChatSession.deleteOne()
      .where("userId").equals(new Types.ObjectId(userId))
      .where("sessionId").equals(req.params.sessionId);
    if (!result.deletedCount) throw new ApiError(404, "Forecast chat session not found");
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
}

export async function streamInvestorForecastChat(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getActor(req);
    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw new ApiError(503, "AI Forecast chat is not configured. Set OPENAI_API_KEY on this server.");
    }
    const session = await InvestorForecastChatSession.findOne()
      .where("userId").equals(new Types.ObjectId(userId))
      .where("sessionId").equals(req.params.sessionId);
    if (!session) throw new ApiError(404, "Forecast chat session not found");

    const message = String(req.body.message).trim();
    const plan = await getCompanyPlan(session.fiscalYearStart);
    const chatSession = new MongoInvestorForecastChatSession(userId, session.sessionId, session.fiscalYearStart);
    const agent = new Agent({
      name: "Investor Financial Forecast Analyst",
      model: process.env.OPENAI_MODEL ?? "gpt-6-luna",
      instructions: [
        "You are a careful financial-planning analyst assisting an authorized investor. Answer questions using only the supplied company plan data. The data is confidential and applies only to the currently selected company.",
        "Clearly distinguish saved plan assumptions from actual historical performance. Do not claim access to actuals, invoices, cash balances, market data, or information that is not present in the plan. State when data is missing. Never fabricate values, units, or dates.",
        "You may calculate totals, margins, differences, percentages, scenarios, and projections directly from the supplied plan. Show the calculation or assumptions for material estimates. Label hypothetical adjustments as scenarios, not saved plan changes. Do not execute or claim to execute changes.",
        "Markdown formatting is mandatory in every answer. Never return a wall of plain text, raw JSON, or a sequence of unformatted label: value lines. Make the response scannable like a polished ChatGPT answer: lead with a clear direct answer or bold takeaway; use meaningful headings, short paragraphs, bold emphasis for important values, and bullets or numbered steps for explanations.",
        "For a financial outlook or summary, use a level-two heading naming the fiscal year, a one-sentence bold takeaway (a Markdown blockquote is appropriate), a 'Key metrics' section with a GitHub-Flavored Markdown table, and a 'Monthly trend' table when monthly data is available. Add a short 'What stands out' list and a 'Data basis' note when relevant. Do not force irrelevant sections into simple answers.",
        "Use GitHub-Flavored Markdown pipe tables for comparisons and monthly figures. Include clear column headers and aligned numeric values; do not present rows as separate prose lines. Use INR and Indian number formatting in prose. Answer follow-up questions with the prior conversation in mind.",
        "When the investor asks how to increase revenue or requests revenue-growth strategy, begin with the exact heading '## Revenue Growth Tips' and give 3–5 practical, prioritized actions before other analysis. Tailor each tip to available saved plan details, explain briefly why it may help, and suggest a concrete next step. Pricing tests, retention, upsell, and channel experiments must be framed as recommendations—not facts about this company. Do not invent customer, conversion, lead, or channel data, promise growth, or claim a quantified impact without evidence; identify what actuals would be needed to measure it and label any estimates as hypothetical scenarios.",
        `The current fiscal plan is FY ${plan.fiscalYearStart}-${String(plan.fiscalYearStart + 1).slice(-2)}. Its structured plan data follows as JSON:\n${JSON.stringify(plan)}`,
      ].join("\n\n"),
    });

    session.messages.push({ role: "user", content: message, createdAt: new Date() });
    if (session.messages.length === 1) session.title = message.slice(0, 80);
    session.updatedAt = new Date();
    await session.save();

    res.status(200).set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send("session", { sessionId: session.sessionId });
    let answer = "";
    let truncated = false;
    try {
      const result = await run(agent, message, { context: {}, session: chatSession, maxTurns: 4, stream: true });
      for await (const chunk of result.toTextStream({ compatibleWithNodeStreams: true })) {
        if (truncated) continue;
        const text = String(chunk);
        const remaining = MAX_ASSISTANT_RESPONSE_CHARS - RESPONSE_TRUNCATION_NOTICE.length - answer.length;
        if (text.length > remaining) {
          const visibleText = text.slice(0, remaining) + RESPONSE_TRUNCATION_NOTICE;
          answer += visibleText;
          truncated = true;
          send("delta", { text: visibleText });
        } else {
          answer += text;
          send("delta", { text });
        }
      }
      await result.completed;
      if (!answer) {
        const finalOutput = typeof result.finalOutput === "string"
          ? result.finalOutput
          : result.finalOutput == null ? "" : JSON.stringify(result.finalOutput);
        answer = finalOutput.length > MAX_ASSISTANT_RESPONSE_CHARS
          ? `${finalOutput.slice(0, MAX_ASSISTANT_RESPONSE_CHARS - RESPONSE_TRUNCATION_NOTICE.length)}${RESPONSE_TRUNCATION_NOTICE}`
          : finalOutput;
        if (answer) send("delta", { text: answer });
      }
      if (!answer) {
        send("error", { message: "The forecast assistant returned an empty answer. Please try again." });
        return res.end();
      }
      if (!res.destroyed) {
        session.messages.push({ role: "assistant", content: answer, createdAt: new Date() });
        if (session.messages.length > 40) session.messages.splice(0, session.messages.length - 40);
        await session.save();
        send("done", { sessionId: session.sessionId });
      }
      return res.end();
    } catch (error) {
      console.error("Investor forecast chat failed:", error instanceof Error ? error.message : error);
      if (answer) {
        session.messages.push({ role: "assistant", content: answer, createdAt: new Date() });
        await session.save();
      }
      send("error", { message: "The forecast assistant could not complete this answer. Please try again." });
      return res.end();
    }
  } catch (error) {
    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: "The forecast assistant could not complete this answer. Please try again." })}\n\n`);
      return res.end();
    }
    return next(error);
  }
}
