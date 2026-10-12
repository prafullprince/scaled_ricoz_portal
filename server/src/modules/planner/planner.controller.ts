import type { NextFunction, Request, Response } from "express";
import { generatePlannerSchema, plannerChatSchema } from "./planner.validation.js";
import { generatePlanner, streamPlanner, streamPlannerReply, forgetPlannerContext, replyToPlanner, plannerTaskContext, plannerSuggestions } from "./planner.service.js";
import { PlannerHistory } from "../../models/planner.models.js";
import { Types } from "mongoose";
import { ApiError } from "../../utils/apiError.utils.js";

export async function listPlannerHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const history = await PlannerHistory.find({ userId: req.authUser!._id, kind: { $ne: "chat" }, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ success: true, history });
  } catch (error) { next(error); }
}

export async function deletePlannerHistory(req: Request, res: Response, next: NextFunction) {
  try {
    if (!Types.ObjectId.isValid(String(req.params.id))) throw new ApiError(400, "Invalid plan id");
    const result = await PlannerHistory.deleteOne({ _id: req.params.id, userId: req.authUser!._id });
    if (!result.deletedCount) throw new ApiError(404, "Plan not found");
    forgetPlannerContext(String(req.authUser!._id));
    return res.json({ success: true });
  } catch (error) { next(error); }
}

export async function plannerChat(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.files && Object.keys(req.files).length) throw new ApiError(400, "The planner accepts text only; files and images are not supported");
    const input = plannerChatSchema.parse(req.body);
    return res.json({ success: true, ...await replyToPlanner(String(req.authUser!._id), input) });
  } catch (error) { next(error); }
}

export async function streamPlannerChat(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.files && Object.keys(req.files).length) throw new ApiError(400, "The planner accepts text only; files and images are not supported");
    const input = plannerChatSchema.parse(req.body);
    res.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
    res.flushHeaders();
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send("session", { sessionId: input.sessionId });
    const result = await streamPlannerReply(String(req.authUser!._id), input, (text) => send("delta", { text }));
    send("done", { id: result.id, sessionId: input.sessionId, suggestions: result.suggestions, unavailable: result.unavailable });
    return res.end();
  } catch (error) {
    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: "Planner conversation failed" })}\n\n`);
      return res.end();
    }
    next(error);
  }
}

export async function plannerConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const [history, tasks] = await Promise.all([
      PlannerHistory.find({ userId: req.authUser!._id, kind: "chat", expiresAt: { $gt: new Date() } }).select("sessionId workDescription answer createdAt").sort({ createdAt: -1, _id: -1 }).limit(100).lean(),
      plannerTaskContext(String(req.authUser!._id)),
    ]);
    return res.json({ success: true, history: history.reverse(), suggestions: plannerSuggestions(tasks) });
  } catch (error) { next(error); }
}

export async function deletePlannerConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = plannerChatSchema.shape.sessionId.parse(req.params.sessionId);
    await PlannerHistory.deleteMany({ userId: req.authUser!._id, kind: "chat", sessionId });
    return res.json({ success: true });
  } catch (error) { next(error); }
}

export async function createPlanner(req: Request, res: Response, next: NextFunction) {
  try {
    const input = generatePlannerSchema.parse(req.body);
    const plan = await generatePlanner(String(req.authUser!._id), input);
    await PlannerHistory.create({ userId: req.authUser!._id, workDescription: input.workDescription, plan });
    return res.json({ success: true, plan });
  } catch (error) {
    next(error);
  }
}

export async function streamPlannerResponse(req: Request, res: Response, next: NextFunction) {
  try {
    const input = generatePlannerSchema.parse(req.body);
    res.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
    res.flushHeaders();
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send("session", { sessionId: input.sessionId ?? "default" });
    let streamedText = "";
    const plan = await streamPlanner(String(req.authUser!._id), input, (text) => {
      streamedText += text;
      send("delta", { text });
    });
    await PlannerHistory.create({ userId: req.authUser!._id, workDescription: input.workDescription, plan });
    send("plan", { plan });
    send("done", { sessionId: input.sessionId ?? "default", streamedCharacters: streamedText.length });
    return res.end();
  } catch (error) {
    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: "Planner stream failed" })}\n\n`);
      return res.end();
    }
    next(error);
  }
}
