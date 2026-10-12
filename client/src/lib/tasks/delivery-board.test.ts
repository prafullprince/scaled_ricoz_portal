import assert from "node:assert/strict";
import { test } from "node:test";
import type { DeliveryAccess, DeliveryPackage, DeliveryWorkItem } from "../../services/engineering-delivery.service";
import { actionForColumn, boardStage, myDeliveryCards } from "./delivery-board";

const access = (id: string, level: DeliveryAccess["level"], extra: Partial<DeliveryAccess> = {}): DeliveryAccess => ({ id, level, department: "ENGINEERING", ceo: false, admin: false, authorizedHr: false, canCreate: false, canSelectDepartment: false, ...extra });
const node = (id: string, parentId: string | null, assigneeId: string, kind: DeliveryWorkItem["kind"], status: DeliveryWorkItem["status"]): DeliveryWorkItem => ({ id, parentId, assigneeId, kind, status, progress: 0, completedAt: null, title: id, description: "Task", deadline: "2026-12-01T00:00:00Z", githubUrl: "", contributionInstructions: "", submission: null, actions: [], canDelegate: false });
const delivery = (): DeliveryPackage => ({ _id: "package", headId: "head", createdBy: "admin", department: "ENGINEERING", title: "Website", description: "Build website", deadline: "2026-12-01T00:00:00Z", githubUrl: "", contributionInstructions: "", status: "IN_PROGRESS", progress: 0, phase: "DELIVERY", submission: null, workItems: [node("frontend", null, "manager", "MANAGER", "IN_PROGRESS"), node("landing", "frontend", "member", "MEMBER", "TODO"), node("starter", null, "direct-member", "MEMBER", "TODO")], history: [], revision: 1, completedAt: null, createdAt: "", updatedAt: "", actions: [], canDelegate: false });

test("manager queue includes their branch and unfinished team tasks, but not head-direct work", () => {
  assert.deepEqual(myDeliveryCards([delivery()], access("manager", "MANAGER")).map((card) => card.node?.id), ["frontend", "landing"]);
});
test("head queue includes every manager branch and direct assignment", () => {
  assert.deepEqual(myDeliveryCards([delivery()], access("head", "HEAD")).map((card) => card.node?.id ?? "root"), ["root", "frontend", "starter"]);
});
test("members see only their own work by default", () => {
  assert.deepEqual(myDeliveryCards([delivery()], access("member", "MEMBER")).map((card) => card.node?.id), ["landing"]);
});
test("individual submission is submitted for its owner but in review for its reviewer", () => {
  const packageRecord = delivery();
  const item = packageRecord.workItems[1];
  item.status = "REVIEW";
  item.actions = ["APPROVE", "REQUEST_REWORK"];
  assert.equal(boardStage({ delivery: packageRecord, node: item }, access("member", "MEMBER")), "SUBMITTED");
  assert.equal(boardStage({ delivery: packageRecord, node: item }, access("manager", "MANAGER")), "REVIEW");
});
test("CEO cannot drag a package to completed until Admin/HR approval", () => {
  const packageRecord = delivery();
  packageRecord.phase = "ADMIN_REVIEW";
  const card = { delivery: packageRecord, node: null };
  const ceo = access("ceo", null, { ceo: true });
  assert.equal(boardStage(card, ceo), "IN_PROGRESS");
  assert.equal(actionForColumn(card, "COMPLETED", ceo), null);
  packageRecord.phase = "CEO_REVIEW";
  packageRecord.actions = ["APPROVE", "REQUEST_REWORK"];
  assert.equal(boardStage(card, ceo), "REVIEW");
  assert.equal(actionForColumn(card, "COMPLETED", ceo), "APPROVE");
  assert.equal(actionForColumn(card, "SUBMITTED", ceo), null);
});
test("Engineering Head can start a new package but cannot bypass unfinished delegated branches", () => {
  const packageRecord = delivery();
  packageRecord.status = "TODO";
  packageRecord.actions = ["START"];
  const card = { delivery: packageRecord, node: null };
  const head = access("head", "HEAD");
  assert.equal(actionForColumn(card, "IN_PROGRESS", head), "START");

  packageRecord.status = "IN_PROGRESS";
  packageRecord.actions = [];
  assert.equal(actionForColumn(card, "TODO", head), null);
  assert.equal(actionForColumn(card, "SUBMITTED", head), null);
});
test("a reviewer can drag submitted work backward only into changes requested", () => {
  const packageRecord = delivery();
  const memberTask = packageRecord.workItems[1];
  memberTask.status = "REVIEW";
  memberTask.actions = ["APPROVE", "REQUEST_REWORK"];
  const card = { delivery: packageRecord, node: memberTask };
  const manager = access("manager", "MANAGER");

  assert.equal(actionForColumn(card, "REWORK", manager), "REQUEST_REWORK");
  assert.equal(actionForColumn(card, "TODO", manager), null);
});
test("a task owner cannot drag their work backward without reviewer-requested changes", () => {
  const packageRecord = delivery();
  const memberTask = packageRecord.workItems[1];
  memberTask.status = "IN_PROGRESS";
  memberTask.actions = ["SUBMIT"];
  const card = { delivery: packageRecord, node: memberTask };
  const manager = access("manager", "MANAGER");

  assert.equal(actionForColumn(card, "SUBMITTED", manager), "SUBMIT");
  assert.equal(actionForColumn(card, "REWORK", manager), null);
  assert.equal(actionForColumn(card, "TODO", manager), null);
});
