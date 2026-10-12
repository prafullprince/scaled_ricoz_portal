import assert from "node:assert/strict";
import { test } from "node:test";
import type { SalesLead, SalesLeadPage } from "../../types/sales";
import { scopeBoardPage } from "./board";

const lead: SalesLead = {
  _id: "test-lead", name: "Test Lead", phone: "9999999999", source: "WEBSITE",
  status: "NEW", priority: "MEDIUM", expectedValue: 20000000, currency: "INR",
  ownerId: null, updatedAt: "2026-10-03T00:00:00.000Z",
};
const pageOf = (leads: SalesLead[]): SalesLeadPage => ({
  leads, pagination: { page: 1, pageSize: 20, total: 100, totalPages: 5 },
  amounts: [{ _id: "INR", value: 20000000 }],
});

test("an unfiltered New lead appears only in its New column", () => {
  for (const stage of ["NEW", "QUALIFIED", "CONTACTED", "REQUIREMENT", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]) {
    const scoped = scopeBoardPage(pageOf([lead]), "Sales", stage);
    assert.equal(scoped.page.leads.length, stage === "NEW" ? 1 : 0);
    assert.equal(scoped.rejected, stage !== "NEW");
  }
});

test("custom stages with the same status do not share cards", () => {
  const custom = { ...lead, pipeline: "Renewals", stageId: "discovery", status: "CONTACTED" as const };
  assert.equal(scopeBoardPage(pageOf([custom]), "Renewals", "discovery").page.leads.length, 1);
  assert.equal(scopeBoardPage(pageOf([custom]), "Renewals", "CONTACTED").page.leads.length, 0);
  assert.equal(scopeBoardPage(pageOf([custom]), "Sales", "discovery").page.leads.length, 0);
});

test("correctly filtered pages preserve server totals and pagination", () => {
  const page = pageOf([lead]);
  const scoped = scopeBoardPage(page, "Sales", "NEW");
  assert.equal(scoped.rejected, false);
  assert.deepEqual(scoped.page, page);
});

test("rejecting other stages preserves pagination so later matches can be loaded", () => {
  const page = pageOf([lead]);
  const scoped = scopeBoardPage(page, "Sales", "QUALIFIED");
  assert.equal(scoped.rejected, true);
  assert.deepEqual(scoped.page.pagination, page.pagination);
  assert.equal(page.leads.length, 1);
});