import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { Attendance } from "../../models/index.js";
import { checkIn } from "./attendance.controller.js";
import { attendanceMonthSchema } from "./attendance.validation.js";

afterEach(() => mock.restoreAll());

test("attendance pagination rejects fractional, invalid and oversized input", () => {
  for (const query of [{ page: "NaN" }, { page: "1.5" }, { pageSize: "51" }, { month: "2026-13" }]) assert.equal(attendanceMonthSchema.safeParse({ query }).success, false);
  assert.deepEqual(attendanceMonthSchema.parse({ query: { page: "2", pageSize: "10", month: "2026-09" } }).query, { page: 2, pageSize: 10, month: "2026-09" });
});

test("duplicate check-in is rejected without opening a second session", async () => {
  mock.method(Attendance, "findOneAndUpdate", (async (filter: any) => { assert.deepEqual(filter.sessions, { $not: { $elemMatch: { checkOut: null } } }); throw { code: 11000 }; }) as any);
  let error: any;
  await checkIn({ authUser: { _id: new Types.ObjectId() }, body: {} } as unknown as Request, {} as Response, (value) => { error = value; });
  assert.equal(error?.statusCode, 409);
});