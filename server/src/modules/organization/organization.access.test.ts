import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { Types } from "mongoose";
import { OrganizationAssignment, OrganizationDepartment, OrganizationLevel } from "../../models/organization.models.js";
import { Task, TaskDailyReport, User } from "../../models/index.js";
import { UserRole } from "../auth/authorization.js";
import { contributionScopeFilter, resolveOrganizationAccess, workflowScopeFilter, requestedDepartmentFilter } from "./organization.access.js";
import { getAdminReport } from "../tasks/task.controller.js";
import { getOrganizationProfile, listReportingOptions } from "./organization.controller.js";
import { listWorkflowCandidates, routeTaskToHead } from "../tasks/task-workflow.controller.js";
import type { Request, Response } from "express";

const actorId = new Types.ObjectId();
const memberId = new Types.ObjectId();
const foreignId = new Types.ObjectId();
const taskId = new Types.ObjectId();
const query = (value: unknown): any => ({
  select() { return this; },
  populate() { return this; },
  sort() { return this; },
  skip() { return this; },
  limit() { return this; },
  lean: async () => value,
});
test("HR-level assignment manages organization records without becoming an executive", async () => {
  const hrId = new Types.ObjectId();
  const memberId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "findOne", (() => query({
    userId: hrId,
    level: OrganizationLevel.HR,
    department: OrganizationDepartment.HR,
    active: true,
  })) as any);
  mock.method(OrganizationAssignment, "find", (() => query([{ userId: hrId }, { userId: memberId }])) as any);

  const access = await resolveOrganizationAccess(hrId, ["HR"]);
  assert.equal(access.executive, false);
  assert.equal(access.assignment?.level, OrganizationLevel.HR);
  assert.deepEqual(access.userIds, [hrId, memberId]);
});

afterEach(() => mock.restoreAll());

for (const role of [UserRole.CEO, UserRole.ADMIN]) {
  for (const department of Object.values(OrganizationDepartment)) {
    test(`${role} report pages only ${department} employees and interns`, async () => {
      mock.method(OrganizationAssignment, "find", ((filter: any) => {
        assert.deepEqual(filter, { active: true, department });
        return query([{ userId: memberId }]);
      }) as any);
      mock.method(User, "countDocuments", (async (filter: any) => {
        assert.deepEqual(filter._id.$in, [memberId]);
        assert.deepEqual(filter.roles.$in, [UserRole.INTERN, UserRole.EMPLOYEE]);
        return 12;
      }) as any);
      mock.method(User, "find", ((filter: any) => {
        assert.equal(filter.$or[0].name.test("a+b"), true);
        assert.equal(filter.$or[0].name.test("ab"), false);
        return { ...query([{ _id: memberId, name: "a+b", roles: [UserRole.EMPLOYEE] }]), skip(value: number) { assert.equal(value, 5); return this; }, limit(value: number) { assert.equal(value, 5); return this; } };
      }) as any);
      mock.method(Task, "find", ((filter: any) => {
        assert.equal(filter.department, department);
        assert.deepEqual(filter.assignedTo.$in, [memberId]);
        return query([]);
      }) as any);
      mock.method(TaskDailyReport, "find", (() => query([])) as any);
      let result: any;
      await getAdminReport(
        { authUser: { _id: actorId, roles: [role] }, query: { department, page: "2", pageSize: "5", search: "a+b" } } as unknown as Request,
        { json: (body: unknown) => { result = body; } } as Response,
        (error?: unknown) => { if (error) throw error; },
      );
      assert.equal(result.department, department);
      assert.deepEqual(result.pagination, { page: 2, pageSize: 5, total: 12, totalPages: 3 });
    });
  }
}

test("executive reports default to Product and clamp a stale page", async () => {
  mock.method(OrganizationAssignment, "find", ((filter: any) => {
    assert.equal(filter.department, OrganizationDepartment.PRODUCT);
    return query([]);
  }) as any);
  mock.method(User, "countDocuments", (async () => 0) as any);
  mock.method(User, "find", (() => ({ ...query([]), skip(value: number) { assert.equal(value, 0); return this; }, limit(value: number) { assert.equal(value, 10); return this; } })) as any);
  mock.method(Task, "find", (() => query([])) as any);
  mock.method(TaskDailyReport, "find", (() => query([])) as any);
  let result: any;
  await getAdminReport({ authUser: { _id: actorId, roles: [UserRole.CEO] }, query: { page: "99" } } as unknown as Request, { json: (body: unknown) => { result = body; } } as Response, (error?: unknown) => { if (error) throw error; });
  assert.deepEqual(result.pagination, { page: 1, pageSize: 10, total: 0, totalPages: 1 });
  assert.deepEqual(result.report, []);
});

for (const params of [{ department: "UNKNOWN" }, { page: "0" }, { page: "1.5" }, { pageSize: "51" }, { pageSize: "invalid" }]) {
  test(`report rejects invalid query ${JSON.stringify(params)}`, async () => {
    let caught: any;
    await getAdminReport({ authUser: { _id: actorId, roles: [UserRole.ADMIN] }, query: params } as unknown as Request, {} as Response, (error?: unknown) => { caught = error; });
    assert.equal(caught?.statusCode, 400);
  });
}

test("a Product head cannot request Sales reports or insights", async () => {
  mock.method(OrganizationAssignment, "findOne", (() => query({ userId: actorId, level: OrganizationLevel.HEAD, department: OrganizationDepartment.PRODUCT })) as any);
  mock.method(OrganizationAssignment, "find", (() => query([])) as any);
  let caught: any;
  await getAdminReport({ authUser: { _id: actorId, roles: [UserRole.PRODUCT_HEAD] }, query: { department: "SALES" } } as unknown as Request, {} as Response, (error?: unknown) => { caught = error; });
  assert.equal(caught?.statusCode, 403);
  const access = await resolveOrganizationAccess(actorId, [UserRole.PRODUCT_HEAD]);
  assert.throws(() => requestedDepartmentFilter(access, "SALES"), { statusCode: 403 });
  assert.deepEqual(requestedDepartmentFilter(access, "PRODUCT"), { department: "PRODUCT" });
});

test("report status filtering happens before counting and paging people", async () => {
  mock.method(OrganizationAssignment, "find", (() => query([{ userId: memberId }, { userId: foreignId }])) as any);
  mock.method(Task, "distinct", (async (field: string, filter: any) => {
    assert.equal(field, "assignedTo");
    assert.equal(filter.department, "SALES");
    assert.equal(filter.status, "PENDING");
    assert.ok(filter.deadline.$lt instanceof Date);
    assert.deepEqual(filter.assignedTo.$in, [memberId, foreignId]);
    return [memberId];
  }) as any);
  mock.method(User, "countDocuments", (async (filter: any) => { assert.deepEqual(filter._id.$in, [memberId]); return 1; }) as any);
  mock.method(User, "find", (() => query([{ _id: memberId }])) as any);
  mock.method(Task, "find", (() => query([])) as any);
  mock.method(TaskDailyReport, "find", (() => query([])) as any);
  await getAdminReport({ authUser: { _id: actorId, roles: [UserRole.ADMIN] }, query: { department: "SALES", status: "DELAYED" } } as unknown as Request, { json: () => undefined } as unknown as Response, (error?: unknown) => { if (error) throw error; });
});

for (const department of Object.values(OrganizationDepartment)) {
  for (const level of [OrganizationLevel.HEAD, OrganizationLevel.MANAGER, OrganizationLevel.MEMBER]) {
    test(`${department} ${level} cannot expand beyond its active scope`, async () => {
      const roles = level === OrganizationLevel.MEMBER ? [UserRole.EMPLOYEE] : [`${department}_${level}`];
      mock.method(OrganizationAssignment, "findOne", (() => query({ userId: actorId, department, level })) as any);
      const searches: any[] = [];
      mock.method(OrganizationAssignment, "find", ((filter: unknown) => {
        searches.push(filter);
        return query([{ userId: memberId }]);
      }) as any);
      const access = await resolveOrganizationAccess(actorId, roles);
      assert.equal(access.executive, false);
      assert.equal(access.assignment?.department, department);
      assert.deepEqual(access.userIds, level === OrganizationLevel.MEMBER ? [actorId] : [actorId, memberId]);
      if (level !== OrganizationLevel.MEMBER) assert.equal(searches[0].department, department);
      if (level === OrganizationLevel.MANAGER) {
        assert.equal(searches[0].reportsTo, actorId);
        assert.equal(searches[0].level, OrganizationLevel.MEMBER);
      }
      assert.deepEqual(contributionScopeFilter(access), { department, assignedTo: { $in: access.userIds } });
      if (level === OrganizationLevel.MEMBER) {
        assert.throws(() => workflowScopeFilter(access, actorId));
      } else {
        assert.equal(workflowScopeFilter(access, actorId).department, department);
      }
    });
  }
}

test("Projects Heads see only their own reporting subtree", async () => {
  const managerId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "findOne", (() => query({
    userId: actorId,
    level: OrganizationLevel.HEAD,
    department: OrganizationDepartment.PROJECTS,
    roleKeys: [UserRole.PROJECTS_HEAD],
  })) as any);
  mock.method(OrganizationAssignment, "find", ((filter: any) => {
    assert.equal(filter.department, OrganizationDepartment.PROJECTS);
    assert.equal(filter.active, true);
    const reportsTo = filter.reportsTo.$in.map(String);
    if (reportsTo.includes(String(actorId))) return query([{ userId: managerId }]);
    if (reportsTo.includes(String(managerId))) return query([{ userId: memberId }]);
    return query([]);
  }) as any);

  const access = await resolveOrganizationAccess(actorId, [UserRole.PROJECTS_HEAD]);

  assert.equal(access.executive, false);
  assert.deepEqual(access.userIds, [actorId, managerId, memberId]);
  assert.deepEqual(workflowScopeFilter(access, actorId), {
    department: OrganizationDepartment.PROJECTS,
    $or: [
      { currentOwner: { $in: access.userIds } },
      { "workflowHistory.actorId": { $in: access.userIds } },
      { "workflowHistory.recipientId": { $in: access.userIds } },
    ],
  });
});

for (const role of [UserRole.CEO, UserRole.ADMIN]) {
  test(`${role} has all departments even with an additional manager role`, async () => {
    mock.method(OrganizationAssignment, "findOne", (() => { throw new Error("Executive scope must not depend on a department assignment"); }) as any);
    const access = await resolveOrganizationAccess(actorId, [UserRole.PRODUCT_MANAGER, role]);
    assert.equal(access.executive, true);
    assert.equal(access.userIds, undefined);
    assert.deepEqual(workflowScopeFilter(access, actorId), {});
    assert.deepEqual(contributionScopeFilter(access), {});
  });
}

test("missing or inactive assignment fails closed", async () => {
  mock.method(OrganizationAssignment, "findOne", ((filter: any) => {
    assert.equal(filter.active, true);
    return query(null);
  }) as any);
  await assert.rejects(resolveOrganizationAccess(actorId, [UserRole.PRODUCT_HEAD]), { statusCode: 403 });
});

test("explicitly assigned additional department roles do not invalidate the primary organization position", async () => {
  mock.method(OrganizationAssignment, "findOne", (() => query({
    userId: actorId,
    level: OrganizationLevel.MANAGER,
    department: OrganizationDepartment.PRODUCT,
    roleKeys: [UserRole.PRODUCT_MANAGER, UserRole.SALES_HEAD],
  })) as any);
  mock.method(OrganizationAssignment, "find", (() => query([])) as any);

  const access = await resolveOrganizationAccess(actorId, [
    UserRole.PRODUCT_MANAGER,
    UserRole.SALES_HEAD,
  ]);

  assert.equal(access.assignment?.department, OrganizationDepartment.PRODUCT);
  assert.deepEqual(access.userIds, [actorId]);
});

test("a stale department role cannot authorize a different assignment", async () => {
  mock.method(OrganizationAssignment, "findOne", (() => query({ userId: actorId, level: OrganizationLevel.HEAD, department: OrganizationDepartment.MARKETING })) as any);
  await assert.rejects(resolveOrganizationAccess(actorId, [UserRole.PRODUCT_HEAD]), { statusCode: 403 });
});

test("a hierarchy assignment does not promote an employee role", async () => {
  mock.method(OrganizationAssignment, "findOne", (() => query({ userId: actorId, level: OrganizationLevel.HEAD, department: OrganizationDepartment.PRODUCT })) as any);
  await assert.rejects(resolveOrganizationAccess(actorId, [UserRole.EMPLOYEE]), { statusCode: 403 });
});

test("contribution report scopes people, tasks, and daily reports together", async () => {
  mock.method(User, "countDocuments", (async () => 1) as any);
  mock.method(OrganizationAssignment, "findOne", (() => query({ userId: actorId, level: OrganizationLevel.HEAD, department: OrganizationDepartment.PRODUCT })) as any);
  mock.method(OrganizationAssignment, "find", (() => query([{ userId: memberId }])) as any);
  mock.method(User, "find", ((filter: any) => {
    assert.deepEqual(filter._id.$in, [actorId, memberId]);
    assert.equal(filter._id.$in.includes(foreignId), false);
    return query([{ _id: memberId, name: "Product member", roles: [UserRole.EMPLOYEE] }]);
  }) as any);
  mock.method(Task, "find", ((filter: any) => {
    assert.equal(filter.department, OrganizationDepartment.PRODUCT);
    assert.deepEqual(filter.assignedTo.$in, [memberId]);
    return query([{ _id: taskId, assignedTo: { _id: memberId }, deadline: new Date(), status: "PENDING" }]);
  }) as any);
  mock.method(TaskDailyReport, "find", ((filter: any) => {
    assert.deepEqual(filter.userId.$in, [memberId]);
    assert.deepEqual(filter.taskId.$in, [taskId]);
    return query([]);
  }) as any);
  let result: any;
  await getAdminReport(
    { authUser: { _id: actorId, roles: [UserRole.PRODUCT_HEAD] }, query: {} } as unknown as Request,
    { json: (value: unknown) => { result = value; } } as Response,
    (error?: unknown) => { if (error) throw error; },
  );
  assert.equal(result.report.length, 1);
  assert.equal(result.report[0].user.name, "Product member");
});

test("direct profile lookup rejects a foreign user before reading profile data", async () => {
  mock.method(OrganizationAssignment, "findOne", (() => query({ userId: actorId, level: OrganizationLevel.MANAGER, department: OrganizationDepartment.PRODUCT })) as any);
  mock.method(OrganizationAssignment, "find", (() => query([{ userId: memberId }])) as any);
  mock.method(User, "findById", (() => { throw new Error("Foreign profile must not be queried"); }) as any);
  let caught: any;
  await getOrganizationProfile(
    { authUser: { _id: actorId, roles: [UserRole.PRODUCT_MANAGER] }, params: { userId: String(foreignId) } } as unknown as Request,
    {} as Response,
    (error?: unknown) => { caught = error; },
  );
  assert.equal(caught?.statusCode, 403);
});

test("foreign department task candidates fail before reading candidates", async () => {
  mock.method(Task, "findById", (async () => ({ department: OrganizationDepartment.MARKETING, currentOwner: actorId, workflowStage: "HEAD_PLANNING" })) as any);
  mock.method(OrganizationAssignment, "findOne", (() => query({ userId: actorId, level: OrganizationLevel.HEAD, department: OrganizationDepartment.PRODUCT })) as any);
  mock.method(OrganizationAssignment, "find", ((filter: any) => {
    assert.equal(filter.department, OrganizationDepartment.PRODUCT);
    return query([]);
  }) as any);
  let caught: any;
  await listWorkflowCandidates(
    { authUser: { _id: actorId, roles: [UserRole.PRODUCT_HEAD] }, params: { id: String(taskId) } } as unknown as Request,
    {} as Response,
    (error?: unknown) => { caught = error; },
  );
  assert.equal(caught?.statusCode, 403);
});

for (const explicitSelection of [false, true]) {
  test(`duplicate heads ${explicitSelection ? "allow an explicit department head" : "require an explicit selection"}`, async () => {
    let saved = false;
    const task: any = { _id: taskId, workflowStage: "ADMIN_REVIEW", workflowHistory: [], async save() { saved = true; } };
    const taskQuery = { ...query(task), then: (resolve: (value: unknown) => unknown) => Promise.resolve(task).then(resolve) };
    mock.method(Task, "findById", (() => taskQuery) as any);
    mock.method(OrganizationAssignment, "find", ((filter: any) => {
      assert.equal(filter.department, OrganizationDepartment.PRODUCT);
      assert.equal(filter.active, true);
      assert.equal(filter.level, OrganizationLevel.HEAD);
      assert.equal(filter.userId, explicitSelection ? String(memberId) : undefined);
      const heads = explicitSelection ? [{ userId: memberId }] : [{ userId: memberId }, { userId: foreignId }];
      return { ...query(heads), then: (resolve: (value: unknown) => unknown) => Promise.resolve(heads).then(resolve) };
    }) as any);
    let caught: any;
    await routeTaskToHead(
      { authUser: { _id: actorId, roles: [UserRole.ADMIN] }, params: { id: String(taskId) }, body: { department: OrganizationDepartment.PRODUCT, ...(explicitSelection ? { headId: String(memberId) } : {}) } } as unknown as Request,
      { json: () => undefined } as unknown as Response,
      (error?: unknown) => { caught = error; },
    );
    assert.equal(saved, explicitSelection);
    assert.equal(caught?.statusCode, explicitSelection ? undefined : 409);
    if (explicitSelection) assert.equal(task.currentOwner, memberId);
  });
}

test("HR Head receives only active HR Managers as member supervisors", async () => {
  mock.method(OrganizationAssignment, "findOne", (() => query({ level: OrganizationLevel.HEAD, department: OrganizationDepartment.HR, active: true })) as any);
  mock.method(OrganizationAssignment, "find", ((filter: any) => {
    if (filter.level === OrganizationLevel.MANAGER) {
      assert.deepEqual(filter, { active: true, department: OrganizationDepartment.HR, level: OrganizationLevel.MANAGER });
      return { ...query([{ userId: memberId }, { userId: null }]), populate() { return this; } };
    }
    return query([]);
  }) as any);
  let result: any;
  await listReportingOptions(
    { authUser: { _id: actorId, roles: [UserRole.HR_HEAD] }, query: { level: "MEMBER", department: "HR" } } as unknown as Request,
    { json: (body: unknown) => { result = body; } } as Response,
    (error?: unknown) => { if (error) throw error; },
  );
  assert.equal(result.options.length, 1);
  assert.equal(result.options[0].department, "HR");
});