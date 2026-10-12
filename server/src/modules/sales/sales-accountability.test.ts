import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { OrganizationAssignment, SalesLead, Task, User } from "../../models/index.js";
import { Permission, UserRole } from "../auth/authorization.js";
import { createSalesAccountability, listSalesAccountability, reportSalesAccountability, reviewSalesAccountability } from "./sales-accountability.controller.js";
import { createSalesAccountabilitySchema, reportSalesAccountabilitySchema } from "./sales-accountability.validation.js";
import { crmTargetValue, salesTargetProgress } from "./sales-accountability.js";
import { updateTaskStatus, updateMyTaskStatus } from "../tasks/task.controller.js";
import { completeSalesTask } from "./sales.controller.js";
import { taskNotificationRecipients } from "../tasks/task-notification.service.js";

afterEach(() => mock.restoreAll());
const actor = new Types.ObjectId();
const assignee = new Types.ObjectId();
const taskId = new Types.ObjectId();
const parentId = new Types.ObjectId();
const deadline = new Date(Date.now() + 7 * 86400_000);
const base = { title: "October revenue", description: "Sales plan and closed revenue", assignedTo: String(assignee), deadline, priority: "HIGH", kind: "TARGET", metric: "REVENUE", target: 1_000_000, currency: "INR", expectedOutcome: "10 lakh closed revenue", leadIds: [] };
const evidenceReport = { actorId: assignee, summary: "Reported progress", evidence: "CRM activity records checked", achieved: 20, createdAt: new Date() };
function query<T>(value: T) {
  return { select() { return this; }, lean: async () => value };
}
function listQuery<T>(value: T) {
  return { populate() { return this; }, sort() { return this; }, limit: async () => value, lean: async () => value };
}
async function run(handler: (req: Request, res: Response, next: NextFunction) => unknown, body: object = {}, roles: UserRole[] = [UserRole.ADMIN], permissions: Permission[] = []) {
  let error: unknown;
  let result: unknown;
  const response = { locals: { salesAccess: { scope: "DEPARTMENT" } }, status() { return this; }, json(value: unknown) { result = value; return this; } } as unknown as Response;
  await handler({ authUser: { _id: actor, roles }, companyRoles: roles, companyPermissions: permissions, body, params: { id: String(taskId), taskId: String(taskId) }, query: {} } as unknown as Request, response, (caught) => { error = caught; });
  return { error, result };
}
function code(error: unknown) { return (error as { statusCode?: number } | undefined)?.statusCode; }

test("target validation enforces measurable values, evidence and valid links", () => {
  assert.equal(createSalesAccountabilitySchema.safeParse({ body: base }).success, true);
  for (const target of [0, -1, 0.001, Infinity]) assert.equal(createSalesAccountabilitySchema.safeParse({ body: { ...base, target } }).success, false);
  assert.equal(createSalesAccountabilitySchema.safeParse({ body: { ...base, kind: "LEAD_LINKED", metric: "ACTIVITY" } }).success, false);
  assert.equal(createSalesAccountabilitySchema.safeParse({ body: { ...base, kind: "EXECUTION" } }).success, false);
  assert.equal(createSalesAccountabilitySchema.safeParse({ body: { ...base, periodStart: deadline } }).success, false);
  assert.equal(reportSalesAccountabilitySchema.safeParse({ body: { summary: "Called", evidence: "", achieved: 20, state: "REVIEW" } }).success, false);
});

test("10 lakh revenue requires 1,000,000 rupees, not 1,000,000 paise", () => {
  const start = new Date("2026-10-01");
  const end = new Date("2026-10-31T23:59:59Z");
  const closedAt = new Date("2026-10-10");
  const won = { _id: "one", status: "WON", currency: "INR", expectedValue: 100_000_000, closedAt };
  const leads = [won, won, { ...won, _id: "two", currency: "USD" }, { ...won, _id: "three", status: "NEGOTIATION" }, { ...won, _id: "four", closedAt: new Date("2026-09-30") }, { ...won, _id: "legacy", closedAt: null }];
  assert.equal(crmTargetValue("REVENUE", "INR", start, end, leads), 1_000_000);
  assert.equal(salesTargetProgress(1_000_000, 1_000_000), 100);
  assert.equal(salesTargetProgress(1_000_000, 300_000), 30);
  assert.equal(salesTargetProgress(1_000_000, 2_000_000), 100);
});

test("customer acquisition counts distinct new customers, not duplicate deals", () => {
  const start = new Date("2026-10-01");
  const end = new Date("2026-10-31");
  const lead = { status: "WON", currency: "INR", expectedValue: 100, closedAt: new Date("2026-10-10") };
  assert.equal(crmTargetValue("CUSTOMERS", "INR", start, end, [{ ...lead, _id: "1", company: "Acme" }, { ...lead, _id: "2", company: " ACME " }, { ...lead, _id: "3", company: "Prior customer" }], new Set(["prior customer"])), 1);
});

test("CEO approves a CRM-backed Sales Head target after Manager and Employee work is accepted", async () => {
  const managerId = new Types.ObjectId();
  const employeeId = new Types.ObjectId();
  const leadId = new Types.ObjectId();
  const periodStart = new Date(Date.now() - 86400_000);
  const root = new Task({
    _id: taskId, assignedTo: assignee, assignedBy: actor, department: "SALES", deadline,
    salesAccountability: { kind: "TARGET", metric: "REVENUE", currency: "INR", target: 1_000_000, periodStart, expectedOutcome: "10 lakh closed revenue", state: "REVIEW", reports: [evidenceReport] },
  });
  const manager = new Task({
    _id: managerId, parentTaskId: taskId, status: "DONE", department: "SALES", deadline,
    salesAccountability: { kind: "TARGET", metric: "REVENUE", target: 1_000_000, expectedOutcome: "Team revenue", state: "ACCEPTED", leadIds: [leadId] },
  });
  const employee = new Task({
    _id: employeeId, parentTaskId: managerId, status: "DONE", department: "SALES", deadline,
    salesAccountability: { kind: "LEAD_LINKED", metric: "ACTIVITY", target: 1, expectedOutcome: "Close the opportunity", state: "ACCEPTED", leadIds: [leadId] },
  });
  mock.method(Task, "findOne", async () => root);
  mock.method(Task, "find", (filter: { parentTaskId: { $in: Types.ObjectId[] } }) =>
    Promise.resolve([manager, employee].filter((task) => filter.parentTaskId.$in.some((id) => String(id) === String(task.parentTaskId)))));
  mock.method(SalesLead, "find", (filter: { _id: { $in: Types.ObjectId[] } }) => {
    assert.deepEqual(filter._id.$in.map(String), [String(leadId)]);
    return query([{ _id: leadId, status: "WON", currency: "INR", expectedValue: 100_000_000, closedAt: new Date() }]);
  });
  let approved = false;
  mock.method(Task, "findOneAndUpdate", async (_filter: unknown, update: { $set: { status: string; "salesAccountability.state": string } }) => {
    assert.equal(update.$set.status, "DONE");
    assert.equal(update.$set["salesAccountability.state"], "ACCEPTED");
    approved = true;
    return root;
  });
  const result = await run(reviewSalesAccountability, { decision: "APPROVE", note: "CRM revenue and completed delegation verified" }, [UserRole.CEO]);
  assert.equal(result.error, undefined);
  assert.equal(approved, true);
});

for (const roles of [[UserRole.ADMIN], [UserRole.CEO], [UserRole.HR]]) {
  test(`${roles[0]} can assign a Sales Head target with appropriate grants`, async () => {
    mock.method(OrganizationAssignment, "findOne", () => query({ level: "HEAD" }));
    mock.method(User, "exists", async () => ({ _id: assignee }));
    mock.method(SalesLead, "countDocuments", async () => 0);
    let saved: Record<string, unknown> | undefined;
    mock.method(Task, "create", async (input: unknown) => { saved = input as Record<string, unknown>; return { _id: taskId }; });
    const result = await run(createSalesAccountability, base, roles, roles[0] === UserRole.HR ? [Permission.TASK_ASSIGN] : []);
    assert.equal(result.error, undefined);
    assert.equal(saved?.department, "SALES");
    assert.equal(String(saved?.assignedBy), String(actor));
    assert.equal((saved?.salesAccountability as { target: number }).target, 1_000_000);
  });
}

test("HR without task or Sales grants cannot create CEO-level Sales targets", async () => {
  mock.method(OrganizationAssignment, "findOne", () => query(null));
  assert.equal(code((await run(createSalesAccountability, base, [UserRole.HR])).error), 403);
});

test("department targets cannot skip the Sales Head", async () => {
  mock.method(OrganizationAssignment, "findOne", () => query({ level: "MEMBER" }));
  mock.method(User, "exists", async () => ({ _id: assignee }));
  assert.equal(code((await run(createSalesAccountability, base)).error), 400);
});

test("delegation rejects another manager's team and child deadlines beyond the parent", async () => {
  const parent = new Task({ _id: parentId, assignedTo: actor, department: "SALES", deadline, salesAccountability: { kind: "TARGET", metric: "REVENUE", target: 100, expectedOutcome: "Revenue", state: "ACTIVE" } });
  mock.method(Task, "findOne", async () => parent);
  mock.method(OrganizationAssignment, "findOne", () => query({ level: "MEMBER", reportsTo: assignee }));
  mock.method(User, "exists", async () => ({ _id: assignee }));
  assert.equal(code((await run(createSalesAccountability, { ...base, parentTaskId: String(parentId), kind: "EXECUTION", metric: "ACTIVITY" })).error), 403);
  assert.equal(code((await run(createSalesAccountability, { ...base, parentTaskId: String(parentId), deadline: new Date(deadline.getTime() + 1) })).error), 409);
});

test("only the assigned owner can submit reports, even for Admin", async () => {
  const task = new Task({ _id: taskId, assignedTo: assignee, salesAccountability: { kind: "EXECUTION", metric: "ACTIVITY", target: 20, expectedOutcome: "20 calls" } });
  mock.method(Task, "findOne", async () => task);
  assert.equal(code((await run(reportSalesAccountability, { summary: "Done", evidence: "CRM calls", achieved: 20, state: "REVIEW" })).error), 403);
});

test("revenue reports cannot invent achieved revenue and atomically submit evidence", async () => {
  const task = new Task({ _id: taskId, assignedTo: actor, assignedBy: assignee, salesAccountability: { kind: "TARGET", metric: "REVENUE", target: 1_000_000, expectedOutcome: "Revenue", state: "ACTIVE", achieved: 0, leadIds: [] } });
  mock.method(Task, "findOne", async () => task);
  mock.method(OrganizationAssignment, "findOne", () => query({ level: "HEAD" }));
  mock.method(SalesLead, "countDocuments", async () => 0);
  mock.method(Task, "findOneAndUpdate", (filter: unknown, update: unknown) => {
    assert.equal((filter as Record<string, unknown>)["salesAccountability.state"], "ACTIVE");
    const fields = (update as { $set: Record<string, unknown> }).$set;
    assert.equal(fields["salesAccountability.achieved"], 0);
    assert.equal(fields["salesAccountability.state"], "REVIEW");
    return Promise.resolve(task);
  });
  assert.equal((await run(reportSalesAccountability, { summary: "Revenue plan", evidence: "CRM opportunities", achieved: 1_000_000, state: "REVIEW" })).error, undefined);
});

test("parent approval waits for child completion", async () => {
  const parent = new Task({ _id: taskId, assignedTo: assignee, assignedBy: actor, salesAccountability: { kind: "TARGET", metric: "ACTIVITY", target: 20, expectedOutcome: "20 calls", state: "REVIEW", reports: [evidenceReport] } });
  const child = new Task({ _id: parentId, parentTaskId: taskId, status: "PENDING", salesAccountability: { kind: "EXECUTION", metric: "ACTIVITY", target: 20, expectedOutcome: "20 calls" } });
  mock.method(Task, "findOne", async () => parent);
  let calls = 0;
  mock.method(Task, "find", async () => calls++ === 0 ? [child] : []);
  assert.equal(code((await run(reviewSalesAccountability, { decision: "APPROVE", note: "Reviewed evidence" })).error), 409);
});

test("CRM target approval rejects unattained revenue", async () => {
  const task = new Task({ _id: taskId, assignedTo: assignee, assignedBy: actor, deadline, createdAt: new Date(), salesAccountability: { kind: "TARGET", metric: "REVENUE", target: 1_000_000, expectedOutcome: "Revenue", state: "REVIEW", reports: [evidenceReport] } });
  mock.method(Task, "findOne", async () => task);
  mock.method(Task, "find", async () => []);
  mock.method(SalesLead, "find", () => query([]));
  assert.equal(code((await run(reviewSalesAccountability, { decision: "APPROVE", note: "Reviewed evidence" })).error), 409);
});

test("legacy completion endpoints cannot bypass Sales evidence review", async () => {
  const task = new Task({ _id: taskId, department: "SALES", assignedTo: actor, workflowStage: "ASSIGNED", salesAccountability: { kind: "TARGET", metric: "REVENUE", target: 100, expectedOutcome: "Revenue" } });
  mock.method(Task, "findOne", async () => task);
  mock.method(Task, "findById", async () => task);
  for (const handler of [updateTaskStatus, updateMyTaskStatus, completeSalesTask]) {
    assert.equal(code((await run(handler, { status: "DONE", submissionDescription: "Unsupported direct completion" })).error), 409);
  }
});

test("Sales descendant notifications and escalation include leadership without duplicates", () => {
  const result = taskNotificationRecipients({ _id: taskId, title: "Calls", assignedTo: actor, assignedBy: assignee, salesAccountability: { supervisorIds: [assignee, parentId] } });
  assert.deepEqual(result, [String(actor), String(assignee), String(parentId)]);
});

for (const [role, parentLevel, childLevel, kind, metric] of [
  [UserRole.SALES_HEAD, "HEAD", "MANAGER", "TARGET", "REVENUE"],
  [UserRole.SALES_MANAGER, "MANAGER", "MEMBER", "EXECUTION", "ACTIVITY"],
] as const) {
  test(`${role} delegates within their assigned target to ${childLevel}`, async () => {
    const parent = new Task({ _id: parentId, assignedTo: actor, assignedBy: assignee, department: "SALES", deadline, salesAccountability: { kind: "TARGET", metric: "REVENUE", target: 1_000_000, expectedOutcome: "Revenue", state: "ACTIVE" } });
    const actorAssignment = { userId: actor, level: parentLevel, department: "SALES", reportsTo: new Types.ObjectId() };
    mock.method(OrganizationAssignment, "findOne", (filter: unknown) => {
      const userId = String((filter as { userId?: unknown }).userId);
      return query(userId === String(assignee) ? { userId: assignee, level: childLevel, department: "SALES", reportsTo: actor } : actorAssignment);
    });
    mock.method(OrganizationAssignment, "find", () => query([{ userId: assignee }]));
    mock.method(Task, "findOne", async () => parent);
    mock.method(Task, "findOneAndUpdate", async () => parent);
    mock.method(User, "exists", async () => ({ _id: assignee }));
    mock.method(SalesLead, "countDocuments", async () => 0);
    let assignedParent: unknown;
    mock.method(Task, "create", async (input: unknown) => { assignedParent = (input as { parentTaskId: unknown }).parentTaskId; return { _id: taskId }; });
    const result = await run(createSalesAccountability, { ...base, parentTaskId: String(parentId), kind, metric }, [role]);
    assert.equal(result.error, undefined);
    assert.equal(String(assignedParent), String(parentId));
  });
}

test("employee accountability lists are own-only and distinguish reported from verified progress", async () => {
  const task = new Task({ _id: taskId, assignedTo: actor, assignedBy: assignee, deadline, salesAccountability: { kind: "EXECUTION", metric: "ACTIVITY", target: 20, achieved: 10, expectedOutcome: "Calls", state: "ACTIVE" } });
  mock.method(OrganizationAssignment, "findOne", () => query({ userId: actor, level: "MEMBER", department: "SALES" }));
  mock.method(OrganizationAssignment, "find", () => listQuery([]));
  mock.method(Task, "find", (filter: unknown) => {
    const values = filter as { parentTaskId?: unknown; assignedTo?: { $in: Types.ObjectId[] } };
    if (values.parentTaskId) return Promise.resolve([]);
    assert.deepEqual(values.assignedTo?.$in, [actor]);
    return listQuery([task]);
  });
  const result = await run(listSalesAccountability, {}, [UserRole.EMPLOYEE]);
  assert.equal(result.error, undefined);
  const data = result.result as { canCreate: boolean; tasks: Array<{ progress: number; reportedProgress: number; canReview: boolean }> };
  assert.equal(data.canCreate, false);
  assert.equal(data.tasks[0]?.progress, 0);
  assert.equal(data.tasks[0]?.reportedProgress, 50);
  assert.equal(data.tasks[0]?.canReview, false);
});

test("review accepts a fulfilled leaf target only after explicit evidence submission", async () => {
  const task = new Task({ _id: taskId, assignedTo: assignee, assignedBy: actor, salesAccountability: { kind: "EXECUTION", metric: "ACTIVITY", target: 20, achieved: 20, expectedOutcome: "20 calls", state: "REVIEW", reports: [evidenceReport] } });
  mock.method(Task, "findOne", async () => task);
  mock.method(Task, "find", async () => []);
  mock.method(Task, "findOneAndUpdate", (filter: unknown, update: unknown) => {
    assert.equal((filter as Record<string, unknown>)["salesAccountability.state"], "REVIEW");
    assert.equal((update as { $set: Record<string, unknown> }).$set.status, "DONE");
    assert.equal((update as { $set: Record<string, unknown> }).$set["salesAccountability.state"], "ACCEPTED");
    return Promise.resolve(task);
  });
  assert.equal((await run(reviewSalesAccountability, { decision: "APPROVE", note: "Verified CRM activity references" })).error, undefined);
});

test("activity rollups do not count demos as calls", async () => {
  const parent = new Task({ _id: taskId, assignedTo: assignee, assignedBy: actor, deadline, salesAccountability: { kind: "TARGET", metric: "ACTIVITY", unit: "calls", target: 20, expectedOutcome: "20 calls", state: "ACTIVE" } });
  const child = new Task({ _id: parentId, parentTaskId: taskId, status: "DONE", salesAccountability: { kind: "EXECUTION", metric: "ACTIVITY", unit: "demos", target: 20, achieved: 20, expectedOutcome: "20 demos", state: "ACCEPTED" } });
  mock.method(OrganizationAssignment, "find", () => listQuery([]));
  mock.method(Task, "find", (filter: unknown) => {
    const value = filter as { parentTaskId?: { $in: Types.ObjectId[] } };
    if (value.parentTaskId) return Promise.resolve(value.parentTaskId.$in.some((id) => String(id) === String(taskId)) ? [child] : []);
    return listQuery([parent]);
  });
  const result = await run(listSalesAccountability);
  assert.equal(result.error, undefined);
  const data = result.result as { tasks: Array<{ achieved: number; reportedProgress: number }> };
  const task = data.tasks[0];
  assert.ok(task);
  assert.equal(task.achieved, 0);
  assert.equal(task.reportedProgress, 0);
});
