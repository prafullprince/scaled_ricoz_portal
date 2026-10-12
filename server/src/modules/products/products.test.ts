import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { Product, Task, TaskDailyReport, OrganizationAssignment, User } from "../../models/index.js";
import { createProduct, updateProduct, deleteProduct, dispatchProduct, listProducts, productDetails } from "./products.controller.js";
import { productSchema, dispatchProductSchema } from "./products.validation.js";
import { delegateTask, reviewWorkflowTask } from "../tasks/task-workflow.controller.js";
import { productLifecycle, productProgress } from "./products.lifecycle.js";
import { Permission } from "../auth/authorization.js";

test("product lifecycle follows assignment and final workflow approval", () => {
  assert.equal(productLifecycle(null), "unassigned");
  assert.equal(productLifecycle(null, "development"), "development");
  assert.equal(productLifecycle(null, "production"), "production");
  assert.equal(productLifecycle(null, "unknown"), "unassigned");
  for (const workflowStage of ["HEAD_PLANNING", "DELEGATED", "SUBMITTED", "CEO_REVIEW", "HEAD_REVIEW"]) {
    assert.equal(productLifecycle({ workflowStage }, "production"), "development");
  }
  assert.equal(productLifecycle({ workflowStage: "COMPLETED" }, "unassigned"), "production");
});

test("progress includes unreported work and completed contributions", () => {
  assert.equal(productProgress([]), 0);
  assert.equal(productProgress([{ completed: false, progress: 60 }, { completed: false }]), 30);
  assert.equal(productProgress([{ completed: true }, { completed: false, progress: 40 }]), 70);
  assert.equal(productProgress([{ completed: false, progress: 100 }]), 100);
});

afterEach(() => mock.restoreAll());

const actorId = new Types.ObjectId();
const productId = new Types.ObjectId();
const rootId = new Types.ObjectId();
const memberId = new Types.ObjectId();
const contributionId = new Types.ObjectId();
const headId = new Types.ObjectId();
const request = (role = "CEO", body = {}, query = {}) => ({
  authUser: { _id: actorId, roles: [role] }, params: { id: String(productId) }, body, query,
  companyPermissions: role === "HR" ? [Permission.PRODUCT_ADMIN] : [],
}) as unknown as Request;
const queryResult = (value: unknown): any => ({
  select() { return this; }, populate() { return this; }, sort() { return this; },
  skip() { return this; }, limit() { return this; },
  lean: async () => value,
  then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) { return Promise.resolve(value).then(resolve, reject); },
});
async function invoke(handler: (req: Request, res: Response, next: any) => unknown, req: Request) {
  let body: any;
  let error: any;
  const res = { status() { return this; }, json(value: unknown) { body = value; return this; } } as unknown as Response;
  await handler(req, res, (reason: unknown) => { error = reason; });
  return { body, error };
}

for (const role of ["EMPLOYEE", "INTERN", "PRODUCT_HEAD", "PRODUCT_MANAGER"]) {
  test(`${role} cannot mutate or dispatch products`, async () => {
    for (const handler of [createProduct, updateProduct, deleteProduct, dispatchProduct]) {
      const result = await invoke(handler, request(role));
      assert.equal(result.error?.statusCode, 403);
    }
  });
}

test("product validation accepts known statuses and strips workflow overrides", () => {
  const parsed = productSchema.parse({ body: {
    title: "Product", description: "A product description", status: "production", workflowTaskId: String(rootId),
  } });
  assert.equal(parsed.body.status, "production");
  assert.equal("workflowTaskId" in parsed.body, false);
  assert.equal(productSchema.safeParse({ body: { title: "Product", description: "A product description", status: "archived" } }).success, false);
  assert.equal(dispatchProductSchema.safeParse({ body: { department: "OTHER", deadline: new Date() } }).success, false);
  assert.equal(dispatchProductSchema.safeParse({ body: { department: "PRODUCT", deadline: "2020-01-01" } }).success, false);
});

test("HR without product access cannot mutate products even with task access", async () => {
  for (const permissions of [[], [Permission.TASK_ASSIGN]]) {
    for (const handler of [createProduct, updateProduct, deleteProduct, dispatchProduct]) {
      const deniedRequest = request("HR");
      deniedRequest.companyPermissions = permissions;
      const result = await invoke(handler, deniedRequest);
      assert.equal(result.error?.statusCode, 403);
    }
  }
});

for (const role of ["CEO", "ADMIN", "HR"]) {
  test(`${role} creates products with a chosen or default status`, async () => {
    mock.method(Product, "create", (async (value: any) => ({ status: value.status, toObject: () => ({ ...value, _id: productId }) })) as any);
    const chosen = await invoke(createProduct, request(role, { title: "Product", status: "production" }));
    assert.equal(chosen.error, undefined);
    assert.equal(chosen.body.product.status, "production");
    assert.equal(chosen.body.product.progress, 100);
    const defaulted = await invoke(createProduct, request(role, { title: "Product" }));
    assert.equal(defaulted.body.product.status, "unassigned");
    assert.equal(defaulted.body.product.progress, 0);
  });

  test(`${role} can change status only before a delivery workflow exists`, async () => {
    mock.method(Product, "exists", (async () => ({ _id: productId })) as any);
    let workflowExists = false;
    mock.method(Task, "exists", (async () => (workflowExists ? { _id: rootId } : null)) as any);
    mock.method(Product, "findOneAndUpdate", (async (_filter: any, update: any) => {
      assert.equal(update.$set.status, "development");
      return { _id: productId };
    }) as any);
    mock.method(Product, "find", (() => queryResult([{ _id: productId, status: "development" }])) as any);
    mock.method(Task, "find", (() => queryResult([])) as any);
    mock.method(TaskDailyReport, "aggregate", (async () => []) as any);
    const manual = await invoke(updateProduct, request(role, { title: "Product", status: "development" }));
    assert.equal(manual.error, undefined);
    assert.equal(manual.body.product.status, "development");
    workflowExists = true;
    const locked = await invoke(updateProduct, request(role, { title: "Product", status: "development" }));
    assert.equal(locked.error?.statusCode, 409);
  });

  test(`${role} cannot dispatch a production product`, async () => {
    mock.method(OrganizationAssignment, "find", (() => queryResult([{ userId: headId }])) as any);
    mock.method(Product, "findOne", (() => queryResult({ _id: productId, title: "Product", description: "Live product", techStack: [], status: "production" })) as any);
    const create = mock.method(Task, "create");
    const result = await invoke(dispatchProduct, request(role, { department: "PRODUCT", deadline: new Date(Date.now() + 86400000) }));
    assert.equal(result.error?.statusCode, 409);
    assert.equal(create.mock.callCount(), 0);
  });

  test(`${role} edits metadata without changing assignment or lifecycle`, async () => {
    mock.method(Product, "exists", (async () => ({ _id: productId })) as any);
    mock.method(Product, "findOneAndUpdate", (async (_filter: any, update: any) => {
      assert.equal(update.$set.title, "Renamed product");
      assert.equal("status" in update.$set, false);
      assert.equal("isPublic" in update.$set, false);
      assert.equal("summary" in update.$set, false);
      assert.equal("category" in update.$set, false);
      assert.equal("website" in update.$set, false);
      assert.equal("workflowTaskId" in update.$set, false);
      return { _id: productId };
    }) as any);
    mock.method(Product, "find", (() => queryResult([{ _id: productId, title: "Renamed product" }])) as any);
    mock.method(Task, "find", (() => queryResult([])) as any);
    mock.method(TaskDailyReport, "aggregate", (async () => []) as any);
    const result = await invoke(updateProduct, request(role, { title: "Renamed product" }));
    assert.equal(result.error, undefined);
    assert.equal(result.body.product.status, "unassigned");
  });

  test(`${role} deletes catalog entry without deleting delivery history`, async () => {
    mock.method(Product, "findOneAndUpdate", (async (filter: any, update: any) => {
      assert.equal(String(filter._id), String(productId));
      assert.equal(filter.deletedAt, null);
      assert.ok(update.$set.deletedAt instanceof Date);
      return { _id: productId };
    }) as any);
    mock.method(Task, "deleteMany", (() => { throw new Error("Delivery history must remain"); }) as any);
    const result = await invoke(deleteProduct, request(role));
    assert.equal(result.error, undefined);
    assert.equal(result.body.success, true);
  });

  test(`${role} dispatches exactly once into Head planning`, async () => {
    let assigned = false;
    mock.method(OrganizationAssignment, "find", (() => queryResult([{ userId: headId }])) as any);
    mock.method(Product, "findOne", ((filter: any) => {
      assert.equal(filter.deletedAt, null);
      return queryResult({ _id: productId, title: "Product", description: "Product delivery", techStack: ["React"] });
    }) as any);
    const create = mock.method(Task, "create", (async (task: any) => {
      if (assigned) throw Object.assign(new Error("Duplicate key"), { code: 11000 });
      assigned = true;
      assert.equal(String(task._id), String(productId));
      assert.equal(String(task.productId), String(productId));
      assert.equal(task.workflowStage, "HEAD_PLANNING");
      assert.equal(task.currentOwner, headId);
      assert.equal(task.department, "PRODUCT");
      return task;
    }) as any);
    const input = request(role, { department: "PRODUCT", headId: String(headId), deadline: new Date(Date.now() + 86400000) });
    assert.equal((await invoke(dispatchProduct, input)).error, undefined);
    assert.equal((await invoke(dispatchProduct, input)).error?.statusCode, 409);
    assert.equal(create.mock.callCount(), 2);
  });
}

test("dispatch refuses a department without an active Head", async () => {
  mock.method(OrganizationAssignment, "find", (() => queryResult([])) as any);
  assert.equal((await invoke(dispatchProduct, request("CEO", { department: "PRODUCT" }))).error?.statusCode, 400);
});

test("failed task creation leaves the product available for retry", async () => {
  mock.method(OrganizationAssignment, "find", (() => queryResult([{ userId: headId }])) as any);
  mock.method(Product, "findOne", (() => queryResult({ _id: productId, title: "Product", description: "Product delivery", techStack: [] })) as any);
  mock.method(Product, "findOneAndUpdate", (() => { throw new Error("Dispatch must not reserve a second document"); }) as any);
  let failed = false;
  mock.method(Task, "create", (async (task: any) => {
    if (!failed) { failed = true; throw new Error("Temporary write failure"); }
    return task;
  }) as any);
  const input = request("CEO", { department: "PRODUCT", deadline: new Date(Date.now() + 86400000) });
  assert.equal((await invoke(dispatchProduct, input)).error?.message, "Temporary write failure");
  assert.equal((await invoke(dispatchProduct, input)).body.success, true);
});

for (const role of ["CEO", "ADMIN"]) {
  test(`${role} final approval moves the product into production`, async () => {
    const task = { _id: rootId, productId, workflowStage: "CEO_REVIEW", workflowHistory: [], status: "PENDING", save: async () => undefined };
    mock.method(Task, "findById", (() => queryResult(task)) as any);
    mock.method(Task, "find", (() => queryResult([])) as any);
    mock.method(Task, "updateMany", (async (filter: any, update: any) => {
      assert.equal(filter.parentTaskId, rootId);
      assert.equal(update.$set.workflowStage, "COMPLETED");
    }) as any);
    assert.equal(productLifecycle(task), "development");
    const result = await invoke(reviewWorkflowTask, request(role, { decision: "APPROVE" }));
    assert.equal(result.error, undefined);
    assert.equal(productLifecycle(task), "production");
  });
}

test("product reports use latest contributions, scoped tasks, and server pagination", async () => {
  mock.method(OrganizationAssignment, "findOne", (() => queryResult({ level: "MANAGER", department: "PRODUCT" })) as any);
  mock.method(OrganizationAssignment, "find", (() => queryResult([{ userId: memberId }])) as any);
  mock.method(Product, "find", ((filter: any) => {
    assert.deepEqual(filter._id.$in, [productId]);
    assert.equal(filter.deletedAt, null);
    return queryResult([{ _id: productId }]);
  }) as any);
  mock.method(Task, "find", ((filter: any) => {
    if (filter.parentTaskId === null && !filter.productId) {
      assert.equal(filter.department, "PRODUCT");
      assert.ok(filter.$or);
      return queryResult([{ _id: rootId, productId }]);
    }
    if (filter.parentTaskId?.$in) {
      assert.equal(filter.department, "PRODUCT");
      assert.deepEqual(filter.assignedTo.$in, [actorId, memberId]);
      return queryResult([{ _id: contributionId, parentTaskId: rootId, status: "PENDING" }]);
    }
    return queryResult([{ _id: rootId, productId, workflowStage: "DELEGATED" }]);
  }) as any);
  mock.method(TaskDailyReport, "aggregate", (async (pipeline: any[]) => {
    assert.deepEqual(pipeline[0].$match.taskId.$in, [contributionId]);
    assert.equal(pipeline[1].$sort.reportDate, -1);
    return [{ _id: contributionId, progress: 65 }];
  }) as any);
  mock.method(TaskDailyReport, "countDocuments", (async () => 21) as any);
  mock.method(TaskDailyReport, "find", ((filter: any) => {
    assert.deepEqual(filter.taskId.$in, [contributionId]);
    return { ...queryResult([{ summary: "Shipped API", progress: 65 }]), skip(value: number) { assert.equal(value, 20); return this; }, limit(value: number) { assert.equal(value, 20); return this; } };
  }) as any);
  const result = await invoke(productDetails, request("PRODUCT_MANAGER", {}, { page: "2" }));
  assert.equal(result.error, undefined);
  assert.equal(result.body.product.progress, 65);
  assert.equal(result.body.product.status, "development");
  assert.equal(result.body.tasks[0].progress, 65);
  assert.equal(result.body.pagination.totalPages, 2);
});

test("foreign department is rejected before reading products", async () => {
  mock.method(OrganizationAssignment, "findOne", (() => queryResult({ level: "MEMBER", department: "PRODUCT" })) as any);
  const result = await invoke(listProducts, request("EMPLOYEE", {}, { department: "SALES" }));
  assert.equal(result.error?.statusCode, 403);
});

test("delegation carries product identity onto each contribution", async () => {
  const task = { _id: rootId, productId, department: "PRODUCT", currentOwner: actorId, createdBy: actorId,
    workflowStage: "MANAGER_PLANNING", deadline: new Date(Date.now() + 172800000), workflowHistory: [], save: async () => undefined };
  mock.method(Task, "findById", (async () => task) as any);
  mock.method(OrganizationAssignment, "find", (() => queryResult([{ userId: memberId }])) as any);
  mock.method(User, "find", (() => queryResult([{ _id: memberId }])) as any);
  mock.method(Task, "insertMany", (async (tasks: any[]) => {
    assert.equal(tasks[0].productId, productId);
    assert.equal(tasks[0].parentTaskId, rootId);
    assert.equal(tasks[0].department, "PRODUCT");
    return [{ ...tasks[0], _id: contributionId }];
  }) as any);
  mock.method(Task, "find", (() => queryResult([])) as any);
  const result = await invoke(delegateTask, request("CEO", { subtasks: [{ title: "Build", description: "Build API", deadline: new Date(Date.now() + 86400000), assignedToIds: [String(memberId)] }] }));
  assert.equal(result.error, undefined);
});