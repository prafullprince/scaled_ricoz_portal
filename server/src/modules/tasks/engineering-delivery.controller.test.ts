import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { EngineeringDelivery, type EngineeringDeliveryRecord } from "../../models/engineering-delivery.models.js";
import { OrganizationAssignment, User } from "../../models/index.js";
import { createEngineeringDelivery, delegateEngineeringDelivery, listEngineeringDeliveries, listEngineeringDeliveryReports, reportEngineeringDeliveryProgress, transitionEngineeringDelivery } from "./engineering-delivery.controller.js";

afterEach(() => mock.restoreAll());
const headId = new Types.ObjectId();
const managerId = new Types.ObjectId();
const memberId = new Types.ObjectId();
const packageId = new Types.ObjectId();
const nextDay = new Date(Date.now() + 86400000);
type DeliveryUpdate = { $set: Partial<EngineeringDeliveryRecord> & { workItems: EngineeringDeliveryRecord["workItems"] }; $inc: { revision: number } };
const fixture = () => ({ _id: packageId, department: "ENGINEERING", headId: String(headId), createdBy: String(headId), title: "Website", description: "Build website", deadline: nextDay, status: "IN_PROGRESS", phase: "DELIVERY", workItems: [], progressReports: [], history: [], revision: 4, completedAt: null });
function req(body: Record<string, unknown>, actor = headId, roles = ["ENGINEERING_HEAD"]) {
  return { authUser: { _id: actor, roles }, params: { id: String(packageId) }, body } as unknown as Request;
}
async function execute(handler: typeof transitionEngineeringDelivery, request: Request, locals: Record<string, unknown> = {}) {
  let error: unknown;
  let result: unknown;
  const response = { locals, json: (value: unknown) => { result = value; }, status() { return this; } } as unknown as Response;
  await handler(request, response, (caught) => { error = caught; });
  return { error, result };
}
function mockRead(record = fixture()) {
  mock.method(OrganizationAssignment, "findOne", () => ({ lean: async () => ({ userId: headId, department: "ENGINEERING", level: "HEAD", active: true }) }));
  mock.method(EngineeringDelivery, "findById", () => ({ lean: async () => record }));
}

test("company Admin can create a delivery directly assigned to a department member without a department head", async () => {
  const adminId = new Types.ObjectId();
  let assignmentQuery = 0;
  mock.method(OrganizationAssignment, "findOne", () => {
    assignmentQuery += 1;
    return {
      lean: async () => assignmentQuery === 1
        ? null
        : {
            userId: memberId,
            level: "MEMBER",
            department: "ENGINEERING",
            employmentType: "INTERN",
            active: true,
          },
    };
  });
  mock.method(OrganizationAssignment, "find", () => ({
    select() { return this; },
    lean: async () => [],
  }));
  mock.method(User, "exists", async () => ({ _id: memberId }));
  mock.method(User, "find", () => ({
    select() { return this; },
    lean: async () => [],
  }));
  const createdInputs: Array<Record<string, any>> = [];
  mock.method(EngineeringDelivery, "create", async (input: Record<string, any>) => {
    createdInputs.push(input);
    return {
      toObject: () => ({
        _id: packageId,
        ...input,
        status: "TODO",
        phase: "DELIVERY",
        submission: null,
        progressReports: [],
        history: input.history,
        workItems: input.workItems,
        revision: 0,
        completedAt: null,
        createdAt: nextDay,
        updatedAt: nextDay,
      }),
    };
  });
  const request = {
    authUser: { _id: adminId, roles: ["ADMIN"] },
    body: {
      title: "Implement task search",
      description: "Build the task search and verify its results",
      deadline: nextDay,
      department: "ENGINEERING",
      assigneeId: String(memberId),
    },
  } as unknown as Request;
  let error: unknown;
  let responseBody: unknown;
  const response = {
    status() { return this; },
    json(value: unknown) { responseBody = value; return this; },
  } as unknown as Response;

  await createEngineeringDelivery(request, response, (caught) => { error = caught; });

  assert.equal(error, undefined);
  const saved = createdInputs[0];
  assert.ok(saved);
  assert.equal(saved?.headId, null);
  assert.equal(saved?.workItems[0]?.assigneeId, String(memberId));
  assert.equal(saved?.workItems[0]?.kind, "MEMBER");
  assert.equal(saved?.workItems[0]?.parentId, null);
  assert.ok(responseBody);
});

test("stale client revisions cannot persist a transition", async () => {
  mockRead();
  const update = mock.method(EngineeringDelivery, "findOneAndUpdate", () => { throw new Error("Must not update"); });
  const { error } = await execute(transitionEngineeringDelivery, req({ revision: 3, nodeId: null, action: "SUBMIT", summary: "Implemented and verified delivery", liveUrl: "https://example.test" }));
  assert.match(String(error), /changed while you were working/);
  assert.equal(update.mock.callCount(), 0);
});

test("a competing delegation or review returns 409 when the atomic revision no longer matches", async () => {
  mockRead();
  const update = mock.method(EngineeringDelivery, "findOneAndUpdate", (filter: unknown, update: DeliveryUpdate) => {
    assert.deepEqual(filter, { _id: packageId, revision: 4 });
    assert.deepEqual(update.$inc, { revision: 1 });
    return { lean: async () => null };
  });
  const { error } = await execute(transitionEngineeringDelivery, req({ revision: 4, nodeId: null, action: "SUBMIT", summary: "Implemented and verified delivery", liveUrl: "https://example.test" }));
  assert.match(String(error), /Another person updated/);
  assert.equal(update.mock.callCount(), 1);
});

test("a head can directly assign a member who normally reports to a manager", async () => {
  mockRead();
  mock.method(OrganizationAssignment, "find", () => ({ lean: async () => [{ userId: memberId, level: "MEMBER", reportsTo: managerId, employmentType: "INTERN", department: "ENGINEERING" }] }));
  mock.method(User, "find", () => ({ select() { return this; }, lean: async () => [{ _id: memberId }] }));
  mock.method(EngineeringDelivery, "findOneAndUpdate", (_filter: unknown, update: DeliveryUpdate) => {
    assert.equal(update.$set.workItems[0]?.parentId, null);
    assert.equal(update.$set.workItems[0]?.assigneeId, String(memberId));
    return { lean: async () => ({ ...fixture(), ...update.$set, revision: 5 }) };
  });
  const { error } = await execute(delegateEngineeringDelivery, req({ revision: 4, parentId: null, workItems: [{ assigneeId: String(memberId), title: "Starter", description: "Set up the build", deadline: nextDay, githubUrl: "", contributionInstructions: "" }] }));
  assert.equal(error, undefined);
});

test("head delegation rejects a manager outside their direct reporting line", async () => {
  mockRead();
  mock.method(OrganizationAssignment, "find", () => ({ lean: async () => [{ userId: managerId, level: "MANAGER", reportsTo: memberId, department: "ENGINEERING" }] }));
  mock.method(User, "find", () => ({ select() { return this; }, lean: async () => [{ _id: managerId }] }));
  const update = mock.method(EngineeringDelivery, "findOneAndUpdate", () => { throw new Error("Must not update"); });
  const { error } = await execute(delegateEngineeringDelivery, req({ revision: 4, parentId: null, workItems: [{ assigneeId: String(managerId), title: "Frontend", description: "Build dashboard", deadline: nextDay }] }));
  assert.match(String(error), /direct-report manager/);
  assert.equal(update.mock.callCount(), 0);
});

test("a manager cannot delegate to another manager's team member", async () => {
  const branchId = new Types.ObjectId().toHexString();
  const record = {
    ...fixture(),
    workItems: [{ id: branchId, parentId: null, kind: "MANAGER", assigneeId: String(managerId), title: "Frontend", description: "Build the frontend", deadline: nextDay, status: "IN_PROGRESS", progress: 0, completedAt: null, githubUrl: "", contributionInstructions: "", submission: null }],
  };
  mock.method(OrganizationAssignment, "findOne", () => ({ lean: async () => ({ userId: managerId, department: "ENGINEERING", level: "MANAGER", active: true }) }));
  mock.method(EngineeringDelivery, "findById", () => ({ lean: async () => record }));
  mock.method(OrganizationAssignment, "find", () => ({ lean: async () => [{ userId: memberId, level: "MEMBER", reportsTo: headId, employmentType: "EMPLOYEE", department: "ENGINEERING" }] }));
  mock.method(User, "find", () => ({ select() { return this; }, lean: async () => [{ _id: memberId }] }));
  const update = mock.method(EngineeringDelivery, "findOneAndUpdate", () => { throw new Error("Must not update"); });
  const { error } = await execute(delegateEngineeringDelivery, req({ revision: 4, parentId: branchId, workItems: [{ assigneeId: String(memberId), title: "Landing", description: "Build landing page", deadline: nextDay }] }, managerId, ["ENGINEERING_MANAGER"]));
  assert.match(String(error), /direct-report interns or employees/);
  assert.equal(update.mock.callCount(), 0);
});

test("delegated work cannot extend beyond the parent deadline", async () => {
  mockRead();
  mock.method(OrganizationAssignment, "find", () => ({ lean: async () => [{ userId: memberId, level: "MEMBER", reportsTo: headId, employmentType: "EMPLOYEE", department: "ENGINEERING" }] }));
  mock.method(User, "find", () => ({ select() { return this; }, lean: async () => [{ _id: memberId }] }));
  const update = mock.method(EngineeringDelivery, "findOneAndUpdate", () => { throw new Error("Must not update"); });
  const { error } = await execute(delegateEngineeringDelivery, req({ revision: 4, parentId: null, workItems: [{ assigneeId: String(memberId), title: "Landing", description: "Build landing page", deadline: new Date(nextDay.getTime() + 86400000) }] }));
  assert.match(String(error), /cannot exceed its parent deadline/);
  assert.equal(update.mock.callCount(), 0);
});

test("cross-department reads are rejected before querying delivery packages", async () => {
  mock.method(OrganizationAssignment, "findOne", () => ({ lean: async () => ({ userId: memberId, department: "PRODUCT", level: "MEMBER" }) }));
  const find = mock.method(EngineeringDelivery, "find", () => { throw new Error("Must not read"); });
  let error: unknown;
  await listEngineeringDeliveries(req({}, memberId, ["INTERN"]), { locals: { query: { department: "ENGINEERING", page: 1, pageSize: 20 } } } as unknown as Response, (caught) => { error = caught; });
  assert.match(String(error), /active Product, Engineering, or IT/);
  assert.equal(find.mock.callCount(), 0);
});

test("assigned members can atomically publish daily progress updates", async () => {
  const nodeId = new Types.ObjectId().toHexString();
  const record = {
    ...fixture(),
    workItems: [{ id: nodeId, parentId: null, kind: "MEMBER", assigneeId: String(memberId), title: "Landing", description: "Build landing page", deadline: nextDay, status: "IN_PROGRESS", progress: 15, completedAt: null, githubUrl: "", contributionInstructions: "", submission: null }],
  };
  mock.method(OrganizationAssignment, "findOne", () => ({ lean: async () => ({ userId: memberId, department: "ENGINEERING", level: "MEMBER", active: true }) }));
  mock.method(EngineeringDelivery, "findById", () => ({ lean: async () => record }));
  const update = mock.method(EngineeringDelivery, "findOneAndUpdate", (_filter: unknown, value: DeliveryUpdate) => ({
    lean: async () => ({ ...record, ...value.$set, revision: 5 }),
  }));
  const { error, result } = await execute(reportEngineeringDeliveryProgress, req({
    revision: 4,
    nodeId,
    progress: 40,
    summary: "Finished the responsive layout",
  }, memberId, ["INTERN"]));
  assert.equal(error, undefined);
  assert.equal(update.mock.callCount(), 1);
  const response = result as { package: { workItems: Array<{ progress: number }>; progressReports: Array<{ progress: number; summary: string }> } };
  assert.equal(response.package.workItems[0]?.progress, 40);
  assert.equal(response.package.progressReports[0]?.progress, 40);
  assert.equal(response.package.progressReports[0]?.summary, "Finished the responsive layout");
});

test("progress update cannot be reported by a different user", async () => {
  const nodeId = new Types.ObjectId().toHexString();
  const record = {
    ...fixture(),
    workItems: [{ id: nodeId, parentId: null, kind: "MEMBER", assigneeId: String(memberId), title: "Landing", description: "Build landing page", deadline: nextDay, status: "IN_PROGRESS", progress: 15, completedAt: null, githubUrl: "", contributionInstructions: "", submission: null }],
  };
  mock.method(OrganizationAssignment, "findOne", () => ({ lean: async () => ({ userId: headId, department: "ENGINEERING", level: "HEAD", active: true }) }));
  mock.method(EngineeringDelivery, "findById", () => ({ lean: async () => record }));
  const update = mock.method(EngineeringDelivery, "findOneAndUpdate", () => { throw new Error("Must not update"); });
  const { error } = await execute(reportEngineeringDeliveryProgress, req({
    revision: 4,
    nodeId,
    progress: 40,
    summary: "Updated by an unauthorized user",
  }, headId));
  assert.match(String(error), /Only the assigned person/);
  assert.equal(update.mock.callCount(), 0);
});

test("every member of the selected department can read every delivery report", async () => {
  const secondPackage = { ...fixture(), _id: new Types.ObjectId(), headId: String(managerId), createdBy: String(managerId) };
  mock.method(OrganizationAssignment, "findOne", () => ({ lean: async () => ({ userId: memberId, department: "ENGINEERING", level: "MEMBER", active: true }) }));
  mock.method(OrganizationAssignment, "find", () => ({ lean: async () => [{ userId: memberId, department: "ENGINEERING", level: "MEMBER", active: true }] }));
  mock.method(User, "find", () => ({ select() { return this; }, lean: async () => [{ _id: memberId, name: "Assigned member", status: "ACTIVE" }] }));
  mock.method(EngineeringDelivery, "find", () => ({
    sort() { return this; },
    lean: async () => [fixture(), secondPackage],
  }));
  const request = req({}, memberId, ["INTERN"]);
  const { error, result } = await execute(listEngineeringDeliveryReports, request, { query: { period: "MONTH" } });
  assert.equal(error, undefined);
  const body = result as { packages: Array<{ _id: Types.ObjectId }> };
  assert.equal(body.packages.length, 2);
});
