import assert from "node:assert/strict";
import { test } from "node:test";
import { complianceCalendarSchema, complianceListSchema, approvalDecisionSchema } from "./compliance.validation.js";

test("calendar query accepts a valid configured department and bounded dates", () => {
  const result = complianceCalendarSchema.safeParse({
    query: {
      departmentId: "ENGINEERING",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-31T23:59:59.000Z",
    },
  });

  assert.equal(result.success, true);
});

test("calendar query rejects unknown departments and reversed date ranges", () => {
  assert.equal(complianceCalendarSchema.safeParse({ query: {} }).success, true);
  assert.equal(complianceCalendarSchema.safeParse({ query: { departmentId: "LEGAL" } }).success, false);
  assert.equal(complianceCalendarSchema.safeParse({ query: { from: "2026-02-01", to: "2026-01-01" } }).success, false);
});

test("requirement filters reject departments outside the organization catalog", () => {
  const result = complianceListSchema.safeParse({ query: { departmentId: "LEGAL" } });
  assert.equal(result.success, false);
});

test("requirement filters accept omitted optional date bounds", () => {
  const result = complianceListSchema.safeParse({ query: {} });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.query.dueBefore, undefined);
    assert.equal(result.data.query.dueAfter, undefined);
  }
});

test("approval rejection requires an auditable reason", () => {
  assert.equal(approvalDecisionSchema.safeParse({ params: { requirementId: "507f1f77bcf86cd799439011" }, body: { decision: "REJECT" } }).success, false);
  assert.equal(approvalDecisionSchema.safeParse({ params: { requirementId: "507f1f77bcf86cd799439011" }, body: { decision: "REJECT", reason: "Evidence is incomplete" } }).success, true);
});
