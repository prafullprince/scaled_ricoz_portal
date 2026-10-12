import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { Task, TaskDailyReport, OrganizationAssignment, User } from "../../models/index.js";
import { getAdminReport, listMyTasks, updateMyTaskStatus } from "./task.controller.js";
import { canManageCompanyWorkflow, routeTaskToHead, reviewWorkflowTask, submitWorkflowReport } from "./task-workflow.controller.js";
import { taskNotificationRecipients } from "./task-notification.service.js";
import { Permission } from "../auth/authorization.js";

const actorId = new Types.ObjectId();
afterEach(() => mock.restoreAll());

test("HR task management requires the task grant, not an unrelated product grant", () => {
  for (const permissions of [[], [Permission.PRODUCT_ADMIN]]) {
    assert.equal(canManageCompanyWorkflow({ companyRoles: ["HR"], companyPermissions: permissions } as Request), false);
  }
  assert.equal(canManageCompanyWorkflow({ companyRoles: ["HR"], companyPermissions: [Permission.TASK_ASSIGN] } as Request), true);
  assert.equal(canManageCompanyWorkflow({ companyRoles: ["EMPLOYEE"], companyPermissions: [Permission.TASK_ASSIGN] } as Request), false);
});

for (const role of ["CEO", "HR"]) {
for (const level of ["MEMBER", "MANAGER", "HEAD"]) {
  test(`${role} with task access can route a brief directly to ${level}`, async () => {
    const taskId = new Types.ObjectId();
    const recipientId = new Types.ObjectId();
    const task: any = { _id: taskId, title: "Delivery", description: "Implement release", deadline: new Date(Date.now() + 86400000), createdBy: actorId, parentTaskId: null, workflowStage: "ADMIN_REVIEW", workflowHistory: [], save: async () => undefined, populate() { return this; } };
    mock.method(Task, "findById", (() => task) as any);
    mock.method(OrganizationAssignment, "findOne", (() => ({ lean: async () => ({ userId: recipientId, department: "ENGINEERING", level }) })) as any);
    mock.method(User, "exists", (async () => ({ _id: recipientId })) as any);
    const create = mock.method(Task, "create", (async (input: any) => { assert.equal(input.parentTaskId, taskId); assert.equal(input.assignedTo, recipientId); return input; }) as any);
    let error: unknown;
    await routeTaskToHead({ params: { id: String(taskId) }, body: { recipientId: String(recipientId), department: "ENGINEERING" }, authUser: { _id: actorId, roles: [role] }, companyPermissions: role === "HR" ? [Permission.TASK_ASSIGN] : [] } as unknown as Request, { json: (body: unknown) => body } as Response, (value) => { error = value; });
    assert.equal(error, undefined);
    assert.equal(task.workflowStage, level === "MEMBER" ? "DELEGATED" : level === "MANAGER" ? "MANAGER_PLANNING" : "HEAD_PLANNING");
    assert.equal(create.mock.callCount(), level === "MEMBER" ? 1 : 0);
  });
}
}

test("task notification recipients include contributors and deduplicate people", () => {
  const recipientId = new Types.ObjectId();
  assert.deepEqual(taskNotificationRecipients({ _id: new Types.ObjectId(), title: "Task", assignedTo: recipientId, createdBy: actorId, assignedBy: actorId, workflowHistory: [{ recipientId: { _id: recipientId }, actorId }] }), [String(recipientId), String(actorId)]);
});

test("skipped-head delivery returns to the creating executive for final review", async () => {
  const task: any = { _id: new Types.ObjectId(), title: "Direct delivery", parentTaskId: null, createdBy: actorId, currentOwner: actorId, workflowStage: "MANAGER_REVIEW", workflowHistory: [], save: async () => undefined, populate() { return this; } };
  mock.method(Task, "findById", (() => task) as any);
  mock.method(Task, "exists", (async () => null) as any);
  mock.method(Task, "find", (() => ({ populate() { return this; }, sort() { return this; }, lean: async () => [] })) as any);
  let error: unknown;
  await reviewWorkflowTask({ params: { id: String(task._id) }, body: { decision: "APPROVE" }, authUser: { _id: actorId, roles: ["CEO"] } } as unknown as Request, { json: (body: unknown) => body } as Response, (value) => { error = value; });
  assert.equal(error, undefined);
  assert.equal(task.currentOwner, actorId);
  assert.equal(task.workflowStage, "CEO_REVIEW");
});

async function run(roles: string[]) {
  let filter: unknown;
  const query: any = {
    populate() { return this; },
    sort() { return this; },
    lean: async () => [],
  };
  mock.method(Task, "find", ((value: unknown) => { filter = value; return query; }) as any);
  let error: unknown;
  await listMyTasks(
    { authUser: { _id: actorId, roles } } as unknown as Request,
    { json: (body: unknown) => body } as Response,
    (reason?: unknown) => { error = reason; },
  );
  if (error) throw error;
  return filter;
}

for (const role of ["HEAD", "PRODUCT_HEAD", "MANAGER", "SALES_MANAGER"]) {
  test(`${role} gets only assigned work and workflows currently owned by self`, async () => {
    assert.deepEqual(await run([role]), {
      $or: [{ assignedTo: actorId }, { currentOwner: actorId }],
      salesAccountability: null,
    });
  });
}

test("employee task list remains limited to directly assigned work", async () => {
  assert.deepEqual(await run(["EMPLOYEE"]), { assignedTo: actorId, salesAccountability: null });
});

test("executive all-department reports find direct assignees by task and include saved progress", async () => {
  const userId = new Types.ObjectId();
  const reportRecord = { _id: new Types.ObjectId(), taskId: new Types.ObjectId(), userId, reportDate: "2026-10-03", summary: "Progress saved", progress: 45 };
  const task = { _id: reportRecord.taskId, title: "Demo delivery", description: "Build the feature", deadline: new Date(Date.now() + 86400000), assignedTo: { _id: userId, name: "Demo User", email: "demo@example.test", roles: ["INTERN"] }, status: "PENDING", completedAt: null };
  const distinctFilters: Array<Record<string, any>> = [];
  const taskFilters: Array<Record<string, any>> = [];
  let userFilter: Record<string, any> | undefined;
  mock.method(OrganizationAssignment, "find", (() => ({ select() { return this; }, lean: async () => [] })) as any);
  mock.method(Task, "distinct", (async (_field: string, filter: Record<string, any>) => { distinctFilters.push(filter); return [userId]; }) as any);
  mock.method(User, "countDocuments", (async () => 1) as any);
  mock.method(User, "find", ((filter: Record<string, any>) => { userFilter = filter; return { select() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; }, lean: async () => [{ _id: userId, name: "Demo User", email: "demo@example.test", roles: ["INTERN"] }] }; }) as any);
  mock.method(Task, "find", ((filter: Record<string, any>) => { taskFilters.push(filter); return { populate() { return this; }, sort() { return this; }, lean: async () => [task] }; }) as any);
  mock.method(TaskDailyReport, "find", (() => ({ sort() { return this; }, lean: async () => [reportRecord] })) as any);
  let response: any;
  let error: unknown;
  for (const role of ["ADMIN", "HR"]) {
    await getAdminReport(
      {
        authUser: { _id: actorId, roles: [role] },
        ...(role === "HR" ? { companyPermissions: [Permission.TASK_REPORT_READ] } : {}),
        query: { department: "ALL", search: "Demo delivery" },
      } as unknown as Request,
      { json: (body: unknown) => { response = body; return body; } } as Response,
      (reason) => { error = reason; },
    );
    assert.equal(error, undefined);
    assert.equal(response.department, "ALL");
    assert.equal("department" in taskFilters.at(-1)!, false);
    assert.equal(distinctFilters.at(-1)?.$or[0].title.test("Demo delivery"), true);
    assert.equal(userFilter?.$or[2]._id.$in[0], userId);
    assert.equal(response.report[0].user._id, userId);
    assert.equal(response.report[0].dailyReports[0].progress, 45);
  }
});

test("HR calendar task list remains limited to directly assigned work", async () => {
  assert.deepEqual(await run(["HR"]), { assignedTo: actorId, salesAccountability: null });
});

test("standalone assigned work can be submitted to its assigning executive", async () => {
  const supervisor = new Types.ObjectId();
  const task: any = { _id: new Types.ObjectId(), parentTaskId: null, assignedBy: supervisor, workflowStage: "ASSIGNED", workflowHistory: [], save: async () => undefined };
  mock.method(Task, "findOne", (async (filter: any) => { assert.equal(filter.assignedTo, actorId); return task; }) as any);
  let error: unknown;
  await updateMyTaskStatus({ params: { id: String(task._id) }, authUser: { _id: actorId }, body: { submissionDescription: "Completed the assigned delivery" } } as unknown as Request, { json: (body: unknown) => body } as Response, (value) => { error = value; });
  assert.equal(error, undefined);
  assert.equal(task.workflowStage, "SUBMITTED");
  assert.equal(task.currentOwner, supervisor);
  assert.equal(task.status, "PENDING");
});

test("direct Head assignments return Member submissions to Head review", async () => {
  const headId = new Types.ObjectId();
  const parent: any = {
    _id: new Types.ObjectId(),
    workflowHistory: [{ action: "ROUTED_TO_HEAD", recipientId: headId }],
  };
  const subtask: any = {
    _id: new Types.ObjectId(),
    parentTaskId: parent._id,
    assignedBy: headId,
    assignedTo: actorId,
    workflowStage: "ASSIGNED",
    workflowHistory: [],
    save: async () => undefined,
  };
  let parentUpdate: any;
  mock.method(Task, "findOne", (async () => subtask) as any);
  mock.method(Task, "findById", (() => parent) as any);
  mock.method(Task, "updateOne", (async (_filter: any, update: any) => { parentUpdate = update; }) as any);
  let error: unknown;
  await updateMyTaskStatus(
    { params: { id: String(subtask._id) }, authUser: { _id: actorId }, body: { submissionDescription: "Completed the assigned direct delivery work" } } as unknown as Request,
    { json: (body: unknown) => body } as Response,
    (value) => { error = value; },
  );
  assert.equal(error, undefined);
  assert.equal(parentUpdate.$set.workflowStage, "HEAD_REVIEW");
  assert.equal(String(parentUpdate.$set.currentOwner), String(headId));
});

test("a Manager without Members can send a task report to the department Head", async () => {
  const headId = new Types.ObjectId();
  const task: any = {
    _id: new Types.ObjectId(),
    department: "SALES",
    currentOwner: actorId,
    workflowStage: "MANAGER_PLANNING",
    workflowHistory: [{ action: "ROUTED_TO_HEAD", recipientId: headId }],
    save: async () => undefined,
    populate() { return this; },
  };
  mock.method(Task, "findById", (() => task) as any);
  mock.method(OrganizationAssignment, "find", (() => ({ select() { return this; }, lean: async () => [] })) as any);
  mock.method(OrganizationAssignment, "exists", (async () => null) as any);
  mock.method(OrganizationAssignment, "findOne", ((filter: any) =>
    String(filter.userId) === String(actorId)
      ? { lean: async () => ({ level: "MANAGER", department: "SALES" }) }
      : filter.level === "MEMBER"
        ? { populate: async () => null }
        : { populate: async () => ({ level: "HEAD", userId: { _id: headId } }) }) as any);
  let response: any;
  let error: unknown;
  await submitWorkflowReport(
    { params: { id: String(task._id) }, body: { recipientId: String(headId), report: "Progress is complete and all delivery requirements were verified." }, authUser: { _id: actorId, roles: ["SALES_MANAGER"] } } as unknown as Request,
    { json: (body: unknown) => { response = body; return body; } } as Response,
    (value) => { error = value; },
  );
  assert.equal(error, undefined);
  assert.equal(response.success, true);
  assert.equal(task.workflowStage, "HEAD_REVIEW");
  assert.equal(String(task.currentOwner), String(headId));
});

test("a Head without Managers or Members can send a report to the CEO", async () => {
  const headId = actorId;
  const ceoId = new Types.ObjectId();
  const task: any = {
    _id: new Types.ObjectId(),
    department: "SALES",
    currentOwner: headId,
    workflowStage: "HEAD_PLANNING",
    workflowHistory: [{ action: "ROUTED_TO_HEAD", recipientId: headId }],
    save: async () => undefined,
  };
  let taskLookups = 0;
  mock.method(Task, "findById", (() => {
    taskLookups += 1;
    return taskLookups === 1 ? task : { populate() { return this; } };
  }) as any);
  mock.method(OrganizationAssignment, "find", (() => ({ select() { return this; }, lean: async () => [{ userId: headId }] })) as any);
  mock.method(OrganizationAssignment, "findOne", ((filter: any) => {
    if (String(filter.userId) === String(headId) && !filter.level) {
      return { lean: async () => ({ userId: headId, level: "HEAD", department: "SALES", active: true }) };
    }
    if (filter.level === "MANAGER" || filter.level === "MEMBER")
      return { populate: async () => null };
    return { populate: async () => ({ level: "CEO", userId: { _id: ceoId } }) };
  }) as any);
  let error: unknown;
  await submitWorkflowReport(
    { params: { id: String(task._id) }, body: { recipientId: String(ceoId), report: "The delivery tier is empty and this is the final progress report." }, authUser: { _id: headId, roles: ["SALES_HEAD"] } } as unknown as Request,
    { json: (body: unknown) => body } as Response,
    (value) => { error = value; },
  );
  assert.equal(error, undefined);
  assert.equal(task.workflowStage, "CEO_REVIEW");
  assert.equal(String(task.currentOwner), String(ceoId));
});

test("a Manager cannot skip active Members when submitting a senior report", async () => {
  const task: any = {
    _id: new Types.ObjectId(),
    department: "SALES",
    currentOwner: actorId,
    workflowStage: "MANAGER_PLANNING",
    workflowHistory: [],
    save: async () => assert.fail("must not save"),
  };
  mock.method(Task, "findById", (() => task) as any);
  mock.method(OrganizationAssignment, "find", (() => ({ select() { return this; }, lean: async () => [] })) as any);
  mock.method(OrganizationAssignment, "findOne", ((filter: any) =>
    String(filter.userId) === String(actorId)
      ? { lean: async () => ({ level: "MANAGER", department: "SALES" }) }
      : { populate: async () => ({ userId: new Types.ObjectId() }) }) as any);
  mock.method(OrganizationAssignment, "exists", (async (filter: any) =>
    filter.level === "MEMBER" ? { _id: new Types.ObjectId() } : null) as any);
  let error: any;
  await submitWorkflowReport(
    { params: { id: String(task._id) }, body: { recipientId: String(new Types.ObjectId()), report: "Progress is complete and all delivery requirements were verified." }, authUser: { _id: actorId, roles: ["SALES_MANAGER"] } } as unknown as Request,
    { json: () => undefined } as unknown as Response,
    (value) => { error = value; },
  );
  assert.equal(error?.statusCode, 409);
});

test("CEO enhancement feedback returns an upward report to its Manager", async () => {
  const managerId = new Types.ObjectId();
  const task: any = {
    _id: new Types.ObjectId(),
    currentOwner: actorId,
    workflowStage: "CEO_REVIEW",
    workflowHistory: [{ action: "REPORT_SUBMITTED", actorId: managerId, recipientId: actorId }],
    save: async () => undefined,
  };
  let taskLookups = 0;
  mock.method(Task, "findById", (() => {
    taskLookups += 1;
    return taskLookups === 1 ? task : { populate() { return this; } };
  }) as any);
  mock.method(OrganizationAssignment, "findOne", (() => ({
    select() { return this; },
    lean: async () => ({ level: "MANAGER" }),
  })) as any);
  let error: unknown;
  await reviewWorkflowTask(
    { params: { id: String(task._id) }, body: { decision: "ENHANCEMENT", note: "Clarify the delivery evidence" }, authUser: { _id: actorId, roles: ["CEO"] } } as unknown as Request,
    { json: (body: unknown) => body } as Response,
    (value) => { error = value; },
  );
  assert.equal(error, undefined);
  assert.equal(task.workflowStage, "MANAGER_PLANNING");
  assert.equal(String(task.currentOwner), String(managerId));
});