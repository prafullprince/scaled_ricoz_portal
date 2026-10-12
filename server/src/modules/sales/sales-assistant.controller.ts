import type { NextFunction, Request, Response } from "express";
import { assistantChatSchema } from "../assistant/assistant.validation.js";
import { visibleSalesUserIds, type SalesAccess } from "./sales.authorization.js";
import { getSalesAssistantOverview, streamSalesAssistant, type SalesAssistantContext } from "./sales-assistant.service.js";

function assistantContext(req: Request, res: Response): Promise<SalesAssistantContext> {
  const access = res.locals.salesAccess as SalesAccess;
  return visibleSalesUserIds(access, req.authUser!._id).then((visibleUserIds) => ({
    userId: String(req.authUser!._id),
    scope: access.scope,
    visibleUserIds: visibleUserIds?.map(String) ?? null,
  }));
}

export async function getSalesAssistantOverviewRoute(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json({ success: true, overview: await getSalesAssistantOverview(await assistantContext(req, res)) });
  } catch (error) {
    next(error);
  }
}

export async function chatSalesAssistant(req: Request, res: Response, next: NextFunction) {
  try {
    const input = assistantChatSchema.parse(req.body);
    const context = await assistantContext(req, res);
    res.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
    res.flushHeaders();
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send("session", { sessionId: input.sessionId ?? "default" });
    try {
      await streamSalesAssistant(context, input, (text) => send("delta", { text }));
      send("done", { sessionId: input.sessionId ?? "default" });
      return res.end();
    } catch (error) {
      console.error("Sales assistant failed:", error instanceof Error ? error.message : error);
      send("error", { message: "The Sales assistant could not complete this request. Please try again." });
      return res.end();
    }
  } catch (error) {
    if (res.headersSent) return res.end();
    next(error);
  }
}
