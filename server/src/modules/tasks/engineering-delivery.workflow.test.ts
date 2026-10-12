import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";
import type { DeliveryWorkItem, EngineeringDeliveryRecord } from "../../models/engineering-delivery.models.js";
import { applyDeliveryTransition, canDelegateDelivery, deliveryActions, type DeliveryActor } from "./engineering-delivery.workflow.js";
import { createEngineeringDeliverySchema, delegateEngineeringDeliverySchema, transitionEngineeringDeliverySchema } from "./engineering-delivery.validation.js";

const actor = (id: string, level: DeliveryActor["level"], extra: Partial<DeliveryActor> = {}): DeliveryActor => ({
  id, level, department: "ENGINEERING", ceo: false, admin: false, authorizedHr: false, ...extra,
});
const head = actor("head", "HEAD");
const manager = actor("manager", "MANAGER");
const member = actor("member", "MEMBER");
const admin = actor("admin", null, { admin: true });
const hr = actor("hr", null, { authorizedHr: true });
const ceo = actor("ceo", null, { ceo: true });
const future = new Date(Date.now() + 86400000);
function node(id: string, parentId: string | null, kind: "HEAD" | "MANAGER" | "MEMBER", assigneeId: string, status: DeliveryWorkItem["status"] = "TODO"): DeliveryWorkItem {
  return { id, parentId, kind, assigneeId, status, progress: 0, completedAt: null, title: id, description: "Build and test the requested functionality", deadline: future, githubUrl: "", contributionInstructions: "", submission: null };
}
function record(workItems: DeliveryWorkItem[] = [], department: EngineeringDeliveryRecord["department"] = "ENGINEERING"): EngineeringDeliveryRecord {
  return {
    _id: new Types.ObjectId(), headId: "head", createdBy: "admin", department,
    title: "Complete website", description: "Frontend, backend and deployment", deadline: future,
    status: "IN_PROGRESS", phase: "DELIVERY", workItems, progressReports: [], history: [], revision: 0,
    githubUrl: "", contributionInstructions: "", submission: null, completedAt: null, createdAt: new Date(), updatedAt: new Date(),
  };
}
const submission = { summary: "Implemented and verified the requested feature.", liveUrl: "https://example.test" };

test("every manager branch must be approved before head submission", () => {
  const delivery = record([node("frontend", null, "MANAGER", "manager"), node("backend", null, "MANAGER", "manager2")]);
  applyDeliveryTransition(delivery, manager, { nodeId: "frontend", action: "SUBMIT", ...submission });
  assert.equal(delivery.workItems[0]?.status, "REVIEW");
  assert.equal(deliveryActions(delivery, head, null).includes("SUBMIT"), false);
  applyDeliveryTransition(delivery, head, { nodeId: "frontend", action: "APPROVE" });
  assert.equal(delivery.workItems[0]?.status, "SUBMITTED");
  assert.equal(deliveryActions(delivery, head, null).includes("SUBMIT"), false);
  assert.throws(() => applyDeliveryTransition(delivery, head, { nodeId: null, action: "SUBMIT", ...submission }));
  applyDeliveryTransition(delivery, actor("manager2", "MANAGER"), { nodeId: "backend", action: "SUBMIT", ...submission });
  applyDeliveryTransition(delivery, head, { nodeId: "backend", action: "APPROVE" });
  assert.equal(delivery.status, "REVIEW");
  applyDeliveryTransition(delivery, head, { nodeId: null, action: "SUBMIT", ...submission });
  assert.equal(delivery.phase, "ADMIN_REVIEW");
});

test("manager approval of the last individual task automatically queues its branch for head review", () => {
  const delivery = record([node("frontend", null, "MANAGER", "manager", "IN_PROGRESS"), node("landing", "frontend", "MEMBER", "member"), node("dashboard", "frontend", "MEMBER", "member2")]);
  applyDeliveryTransition(delivery, member, { nodeId: "landing", action: "SUBMIT", ...submission });
  assert.deepEqual(deliveryActions(delivery, manager, "landing"), ["APPROVE", "REQUEST_REWORK"]);
  applyDeliveryTransition(delivery, manager, { nodeId: "landing", action: "APPROVE" });
  assert.equal(delivery.workItems[0]?.status, "IN_PROGRESS");
  assert.equal(deliveryActions(delivery, manager, "frontend").includes("SUBMIT"), false);
  applyDeliveryTransition(delivery, actor("member2", "MEMBER"), { nodeId: "dashboard", action: "SUBMIT", ...submission });
  applyDeliveryTransition(delivery, manager, { nodeId: "dashboard", action: "APPROVE" });
  assert.equal(delivery.workItems[0]?.status, "REVIEW");
  assert.deepEqual(deliveryActions(delivery, head, "frontend"), ["APPROVE", "REQUEST_REWORK"]);
  assert.equal(delivery.workItems.some((item) => item.status === "COMPLETED"), false);
});

test("direct head assignments bypass managers even when manager branches exist", () => {
  const delivery = record([node("backend", null, "MANAGER", "manager"), node("starter", null, "MEMBER", "member")]);
  assert.equal(canDelegateDelivery(delivery, head, null), true);
  applyDeliveryTransition(delivery, member, { nodeId: "starter", action: "SUBMIT", ...submission });
  assert.deepEqual(deliveryActions(delivery, head, "starter"), ["APPROVE", "REQUEST_REWORK"]);
  assert.deepEqual(deliveryActions(delivery, manager, "starter"), []);
  applyDeliveryTransition(delivery, head, { nodeId: "starter", action: "APPROVE" });
  assert.equal(delivery.phase, "DELIVERY");
  assert.equal(delivery.status, "IN_PROGRESS");
});

test("a company reviewer can manage directly assigned tasks when the department has no head", () => {
  const delivery = record([node("task", null, "MEMBER", "member")]);
  delivery.headId = null;
  assert.equal(canDelegateDelivery(delivery, admin, null), true);
  applyDeliveryTransition(delivery, member, { nodeId: "task", action: "SUBMIT", ...submission });
  assert.deepEqual(deliveryActions(delivery, admin, "task"), ["APPROVE", "REQUEST_REWORK"]);
  applyDeliveryTransition(delivery, admin, { nodeId: "task", action: "APPROVE" });
  assert.deepEqual(deliveryActions(delivery, admin, null), ["SUBMIT"]);
});

test("Admin and authorized HR are interchangeable, but neither can bypass final CEO approval", () => {
  for (const reviewer of [admin, hr]) {
    const delivery = record();
    applyDeliveryTransition(delivery, head, { nodeId: null, action: "SUBMIT", ...submission });
    assert.deepEqual(deliveryActions(delivery, ceo, null), []);
    applyDeliveryTransition(delivery, reviewer, { nodeId: null, action: "APPROVE" });
    assert.equal(delivery.phase, "CEO_REVIEW");
    assert.equal(delivery.completedAt, null);
    assert.deepEqual(deliveryActions(delivery, reviewer, null), []);
    assert.throws(() => applyDeliveryTransition(delivery, reviewer, { nodeId: null, action: "APPROVE" }));
    applyDeliveryTransition(delivery, ceo, { nodeId: null, action: "APPROVE" });
    assert.equal(delivery.phase, "COMPLETED");
    assert.ok(delivery.completedAt);
  }
});

test("CEO approval marks all manager and member tasks completed together", () => {
  const delivery = record([node("frontend", null, "MANAGER", "manager", "SUBMITTED"), node("landing", "frontend", "MEMBER", "member", "SUBMITTED")]);
  applyDeliveryTransition(delivery, head, { nodeId: null, action: "SUBMIT", ...submission });
  applyDeliveryTransition(delivery, admin, { nodeId: null, action: "APPROVE" });
  const now = new Date();
  applyDeliveryTransition(delivery, ceo, { nodeId: null, action: "APPROVE" }, now);
  assert.equal(delivery.status, "COMPLETED");
  assert.equal(delivery.completedAt, now);
  assert.ok(delivery.workItems.every((item) => item.status === "COMPLETED"));
  assert.equal(delivery.history.at(-1)?.action, "CEO_COMPLETED");
  for (const user of [head, manager, member, admin, hr, ceo]) assert.deepEqual(deliveryActions(delivery, user, null), []);
  assert.equal(canDelegateDelivery(delivery, head, null), false);
});

test("rework invalidates a previously submitted manager branch and re-locks head forwarding", () => {
  const delivery = record([node("frontend", null, "MANAGER", "manager", "SUBMITTED"), node("landing", "frontend", "MEMBER", "member", "SUBMITTED")]);
  delivery.status = "REVIEW";
  applyDeliveryTransition(delivery, manager, { nodeId: "landing", action: "REQUEST_REWORK", note: "Fix keyboard navigation" });
  assert.equal(delivery.workItems[1]?.status, "REWORK");
  assert.equal(delivery.workItems[0]?.status, "REWORK");
  assert.equal(delivery.status, "IN_PROGRESS");
  assert.equal(deliveryActions(delivery, head, null).includes("SUBMIT"), false);
  applyDeliveryTransition(delivery, member, { nodeId: "landing", action: "SUBMIT", ...submission });
  applyDeliveryTransition(delivery, manager, { nodeId: "landing", action: "APPROVE" });
  assert.equal(delivery.workItems[0]?.status, "REVIEW");
});

test("senior rework returns to the head and must pass Admin/HR review again", () => {
  const delivery = record();
  applyDeliveryTransition(delivery, head, { nodeId: null, action: "SUBMIT", ...submission });
  applyDeliveryTransition(delivery, admin, { nodeId: null, action: "APPROVE" });
  applyDeliveryTransition(delivery, ceo, { nodeId: null, action: "REQUEST_REWORK", note: "Correct the live deployment" });
  assert.equal(delivery.phase, "DELIVERY");
  assert.equal(delivery.status, "REWORK");
  applyDeliveryTransition(delivery, head, { nodeId: null, action: "SUBMIT", ...submission });
  assert.equal(delivery.phase, "ADMIN_REVIEW");
  assert.deepEqual(deliveryActions(delivery, ceo, null), []);
});

test("approval in another branch cannot clear head-requested rework", () => {
  const delivery = record([
    node("frontend", null, "MANAGER", "manager", "SUBMITTED"),
    node("landing", "frontend", "MEMBER", "member", "SUBMITTED"),
    node("backend", null, "MANAGER", "manager2", "REVIEW"),
  ]);
  applyDeliveryTransition(delivery, head, { nodeId: "frontend", action: "REQUEST_REWORK", note: "Improve the delivery summary" });
  applyDeliveryTransition(delivery, head, { nodeId: "backend", action: "APPROVE" });
  assert.equal(delivery.workItems[0]?.status, "REWORK");
  assert.equal(deliveryActions(delivery, head, null).includes("SUBMIT"), false);
  applyDeliveryTransition(delivery, manager, { nodeId: "frontend", action: "SUBMIT", ...submission });
  assert.equal(delivery.workItems[0]?.status, "REVIEW");
});

test("cross-department, peer and executive bypasses cannot review individual work", () => {
  const delivery = record([node("frontend", null, "MANAGER", "manager", "IN_PROGRESS"), node("landing", "frontend", "MEMBER", "member", "REVIEW")]);
  for (const outsider of [actor("manager2", "MANAGER"), actor("manager", "MANAGER", { department: "PRODUCT" }), head, admin, hr, ceo]) {
    assert.deepEqual(deliveryActions(delivery, outsider, "landing"), []);
    assert.throws(() => applyDeliveryTransition(delivery, outsider, { nodeId: "landing", action: "APPROVE" }));
  }
  assert.equal(canDelegateDelivery(delivery, actor("manager2", "MANAGER"), "frontend"), false);
});

test("head delivery requires a live URL; rework requires a reason", () => {
  const delivery = record();
  assert.throws(() => applyDeliveryTransition(delivery, head, { nodeId: null, action: "SUBMIT", summary: submission.summary }));
  delivery.phase = "ADMIN_REVIEW";
  assert.throws(() => applyDeliveryTransition(delivery, admin, { nodeId: null, action: "REQUEST_REWORK" }));
});

test("IT department heads use the same delivery transitions without cross-department authority", () => {
  const delivery = record([], "IT");
  delivery.headId = "it-head";
  delivery.status = "TODO";
  const itHead = actor("it-head", "HEAD", { department: "IT" });
  applyDeliveryTransition(delivery, itHead, { nodeId: null, action: "START" });
  assert.equal(delivery.status, "IN_PROGRESS");
  assert.throws(() => applyDeliveryTransition(delivery, head, { nodeId: null, action: "SUBMIT", ...submission }));
});

test("delivery package validation accepts the IT department", () => {
  const result = createEngineeringDeliverySchema.safeParse({
    body: {
      title: "DevOps infrastructure rollout",
      description: "Prepare the production deployment pipeline",
      deadline: future,
      department: "IT",
      assigneeId: new Types.ObjectId().toHexString(),
    },
  });
  assert.equal(result.success, true);
});

test("HTTP validation rejects dangerous URLs and accepts optional GitHub/instructions", () => {
  const id = new Types.ObjectId().toHexString();
  const brief = { title: "Website", description: "Deliver a tested website", deadline: future.toISOString(), department: "ENGINEERING", assigneeId: id };
  assert.ok(createEngineeringDeliverySchema.safeParse({ body: brief }).success);
  assert.ok(createEngineeringDeliverySchema.safeParse({ body: { ...brief, githubUrl: "https://github.com/org/repo", contributionInstructions: "Create a branch and open a PR" } }).success);
  assert.equal(createEngineeringDeliverySchema.safeParse({ body: { ...brief, githubUrl: "https://not-github.test/repo" } }).success, false);
  const transition = { params: { id }, body: { revision: 0, nodeId: null, action: "SUBMIT", summary: submission.summary, liveUrl: "javascript:alert(1)" } };
  assert.equal(transitionEngineeringDeliverySchema.safeParse(transition).success, false);
  assert.equal(transitionEngineeringDeliverySchema.safeParse({ ...transition, body: { ...transition.body, liveUrl: "" } }).success, false);
  assert.ok(transitionEngineeringDeliverySchema.safeParse({ ...transition, body: { ...transition.body, liveUrl: "https://example.test" } }).success);
  assert.equal(delegateEngineeringDeliverySchema.safeParse({ params: { id }, body: { revision: 0, parentId: null, workItems: [] } }).success, false);
});
