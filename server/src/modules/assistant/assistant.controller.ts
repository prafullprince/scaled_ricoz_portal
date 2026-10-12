import type { NextFunction, Request, Response } from "express";
import { assistantChatSchema } from "./assistant.validation.js";
import { streamAssistant } from "./assistant.service.js";
import { resolveMarketingAccess } from "../marketing/marketing.authorization.js";
import { managedUserIds } from "../organization/organization.controller.js";
import { resolveOrganizationAccess } from "../organization/organization.access.js";
import { requestRoles } from "../organization/organization.roles.js";

export async function chatAssistant(req: Request, res: Response, next: NextFunction) {
  try {
    const input = assistantChatSchema.parse(req.body);
    res.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
    res.flushHeaders();
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send("session", { sessionId: input.sessionId ?? "default" });
    const roles = requestRoles(req).map(String);
    const canReadHr = roles.some((role) => ["ADMIN", "CEO", "HR_HEAD", "HR_MANAGER"].includes(role));
    const hrAccess = canReadHr ? await resolveOrganizationAccess(req.authUser!._id, roles) : null;
    const hrVisibleUserIds = hrAccess?.executive ? null : hrAccess?.assignment.department === "HR" ? hrAccess.userIds.map(String) : [];
    const marketingAccess = await resolveMarketingAccess(String(req.authUser!._id), requestRoles(req), req.companyPermissions);
    const marketingVisibleUserIds = marketingAccess?.scope === "DEPARTMENT" ? null : marketingAccess ? (await managedUserIds(req.authUser!._id, false))?.map(String) ?? [String(req.authUser!._id)] : [];
    await streamAssistant({ userId: String(req.authUser!._id), email: req.authUser!.email, roles, canReadHr, hrVisibleUserIds, marketingScope: marketingAccess?.scope ?? "NONE", marketingVisibleUserIds }, input, (text) => send("delta", { text }));
    send("done", { sessionId: input.sessionId ?? "default" });
    return res.end();
  } catch (error) {
    if (res.headersSent) {
      res.write(`event: done\ndata: ${JSON.stringify({ sessionId: "default" })}\n\n`);
      return res.end();
    }
    next(error);
  }
}
