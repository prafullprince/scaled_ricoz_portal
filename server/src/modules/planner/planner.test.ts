import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { PlannerHistory } from "../../models/planner.models.js";
import { deletePlannerConversation, deletePlannerHistory, listPlannerHistory, plannerChat } from "./planner.controller.js";
import { personalWorkspaceRoles } from "./planner.routes.js";
import { fallbackPlan, plannerModelName } from "./planner.service.js";
import { UserRole } from "../auth/authorization.js";
import { plannerChatSchema } from "./planner.validation.js";
import { plannerSuggestions, plannerTaskContext } from "./planner.service.js";
import { Task } from "../../models/index.js";

afterEach(() => mock.restoreAll());
const actorId = new Types.ObjectId();
const response = { json: (value: unknown) => value } as Response;

test("planner conversation accepts text only and rejects attachments", () => {
  const input = { message: "Explain compound interest simply", sessionId: "123e4567-e89b-42d3-a456-426614174000" };
  assert.equal(plannerChatSchema.safeParse(input).success, true);
  for (const field of ["files", "image", "pdf", "attachments"]) assert.equal(plannerChatSchema.safeParse({ ...input, [field]: "upload" }).success, false);
});

test("planner rejects multipart files before calling the provider", async () => {
  let caught: any;
  await plannerChat({ files: { upload: {} }, body: {} } as unknown as Request, response, (error) => { caught = error; });
  assert.equal(caught?.statusCode, 400);
  assert.match(caught.message, /text only/);
});

test("conversation deletion is scoped to the owner and selected session", async () => {
  const sessionId = "123e4567-e89b-42d3-a456-426614174000";
  const deletion = mock.method(PlannerHistory, "deleteMany", (async (filter: unknown) => {
    assert.deepEqual(filter, { userId: actorId, kind: "chat", sessionId });
    return { deletedCount: 1 };
  }) as any);
  await deletePlannerConversation({ authUser: { _id: actorId }, params: { sessionId } } as unknown as Request, response, (error) => { throw error; });
  assert.equal(deletion.mock.callCount(), 1);
});

test("planner suggestions use only assigned or owned pending tasks", async () => {
  mock.method(Task, "find", ((filter: any) => {
    assert.deepEqual(filter, { $or: [{ assignedTo: String(actorId) }, { currentOwner: String(actorId) }], status: "PENDING" });
    return { select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => [{ title: "Prepare release" }] };
  }) as any);
  const tasks = await plannerTaskContext(String(actorId));
  assert.match(plannerSuggestions(tasks)[0]!, /Prepare release/);
});

test("company HR can use the daily planner personal workspace", () => {
  assert.ok(personalWorkspaceRoles.includes(UserRole.HR));
});

test("planner defaults to OpenAI and trims configured model names", () => {
  assert.equal(plannerModelName("  gpt-5-mini\n", "gpt-5-nano"), "gpt-5-mini");
  assert.equal(plannerModelName("  ", "gpt-5-mini"), "gpt-5-mini");
  assert.equal(plannerModelName("  ", " "), "gpt-5-nano");
});

test("planner history is owner scoped and excludes expired records before TTL cleanup", async () => {
  mock.method(PlannerHistory, "find", ((filter: any) => {
    assert.equal(filter.userId, actorId);
    assert.ok(filter.expiresAt.$gt instanceof Date);
    return { sort() { return this; }, limit() { return this; }, lean: async () => [] };
  }) as any);
  await listPlannerHistory({ authUser: { _id: actorId } } as unknown as Request, response, (error) => { throw error; });
  assert.ok(PlannerHistory.schema.indexes().some(([keys, options]) => keys.expiresAt === 1 && options.expireAfterSeconds === 0));
});

test("deleting another user's planner entry returns not found", async () => {
  const planId = new Types.ObjectId();
  mock.method(PlannerHistory, "deleteOne", (async (filter: any) => { assert.equal(filter.userId, actorId); assert.equal(filter._id, String(planId)); return { deletedCount: 0 }; }) as any);
  let error: any;
  await deletePlannerHistory({ params: { id: String(planId) }, authUser: { _id: actorId } } as unknown as Request, response, (value) => { error = value; });
  assert.equal(error?.statusCode, 404);
});

test("no-task planner recommends the supervisor and department learning", () => {
  const plan = fallbackPlan({ workDescription: "Plan my work" }, [], "ENGINEERING");
  assert.match(JSON.stringify(plan), /supervisor/i);
  assert.match(JSON.stringify(plan), /ENGINEERING/i);
  assert.ok(plan.blocks.every((block) => !block.taskId));
});