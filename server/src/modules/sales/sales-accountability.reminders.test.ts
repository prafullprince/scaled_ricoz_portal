import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { Types } from "mongoose";
import { Company, Task, TaskStatus } from "../../models/index.js";
import { Notification } from "../../models/notification.models.js";
import { currentScope, setDefaultCompanyId } from "../company/company.context.js";
import { remindSalesAccountability } from "./sales-accountability.reminders.js";

afterEach(() => mock.restoreAll());

test("reminders are company-scoped, daily deduplicated and escalate without completing work", async () => {
  const companies = [new Types.ObjectId(), new Types.ObjectId()];
  const defaultCompany = companies[0];
  assert.ok(defaultCompany);
  setDefaultCompanyId(defaultCompany);
  const owner = new Types.ObjectId();
  const supervisor = new Types.ObjectId();
  const taskId = new Types.ObjectId();
  const blockedTaskId = new Types.ObjectId();
  const dueTaskId = new Types.ObjectId();
  mock.method(Company, "find", () => ({
    select() { return this; },
    async *cursor() { for (const _id of companies) yield { _id }; },
  }));
  const filters: Array<Record<string, unknown>> = [];
  mock.method(Task, "find", (filter: Record<string, unknown>) => {
    assert.ok(companies.some((company) => String(company) === String(currentScope()?.companyId)));
    filters.push(filter);
    return {
      async *cursor() {
        yield { _id: taskId, title: "Revenue target", deadline: new Date(0), assignedTo: owner, assignedBy: supervisor, salesAccountability: { state: "ACTIVE", supervisorIds: [supervisor] } };
        yield { _id: blockedTaskId, title: "Blocked calls", deadline: new Date(Date.now() + 7 * 86400_000), assignedTo: owner, salesAccountability: { state: "BLOCKED" } };
        yield { _id: dueTaskId, title: "Demo target", deadline: new Date(Date.now() + 3600_000), assignedTo: owner, salesAccountability: { state: "ACTIVE" } };
      },
    };
  });
  mock.method(Task, "findOneAndUpdate", () => { throw new Error("Reminders must not change task status"); });
  const notifications = new Map<string, { title: string; userId: string }>();
  let writes = 0;
  mock.method(Notification, "updateOne", async (
    filter: { dedupeKey: string },
    update: { $setOnInsert: { title: string; userId: string; dedupeKey: string } },
    options: { upsert: boolean; setDefaultsOnInsert: boolean },
  ) => {
    writes++;
    assert.equal(filter.dedupeKey, update.$setOnInsert.dedupeKey);
    assert.deepEqual(options, { upsert: true, setDefaultsOnInsert: true });
    const key = `${currentScope()?.companyId}:${filter.dedupeKey}`;
    if (!notifications.has(key)) notifications.set(key, update.$setOnInsert);
  });
  await remindSalesAccountability();
  const firstKeys = [...notifications.keys()];
  await remindSalesAccountability();
  assert.equal(writes, 16);
  assert.equal(notifications.size, 8);
  assert.deepEqual([...notifications.keys()], firstKeys);
  assert.ok([...notifications.values()].some((item) => item.userId === String(supervisor) && item.title.startsWith("Overdue:")));
  assert.ok([...notifications.values()].some((item) => item.title.startsWith("Blocked:")));
  assert.ok([...notifications.values()].some((item) => item.title.startsWith("Due within 24 hours:")));
  for (const filter of filters) {
    assert.equal(filter.department, "SALES");
    assert.equal(filter.status, TaskStatus.PENDING);
    assert.deepEqual(filter.salesAccountability, { $ne: null });
    assert.ok(Array.isArray(filter.$or));
  }
  assert.equal(currentScope(), null);
});

test("reminder persistence errors reach the scheduler instead of reporting success", async () => {
  const companyId = new Types.ObjectId();
  setDefaultCompanyId(companyId);
  mock.method(Company, "find", () => ({
    select() { return this; },
    async *cursor() { yield { _id: companyId }; },
  }));
  mock.method(Task, "find", () => ({
    async *cursor() { yield { _id: new Types.ObjectId(), title: "Overdue work", deadline: new Date(0), assignedTo: new Types.ObjectId() }; },
  }));
  const failure = new Error("Notification storage unavailable");
  mock.method(Notification, "updateOne", async () => { throw failure; });
  await assert.rejects(remindSalesAccountability(), failure);
  assert.equal(currentScope(), null);
});
