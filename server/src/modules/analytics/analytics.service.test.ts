import { afterEach, it, mock } from "node:test";
import assert from "node:assert/strict";
import { User } from "../../models/index.js";
import { UserRole, UserStatus } from "../auth/authorization.js";
import { runWithCompany } from "../company/company.context.js";
import { AnalyticsService } from "./analytics.service.js";
import type { ResolvedPeriod } from "./period.util.js";
import { Types } from "mongoose";

afterEach(() => mock.restoreAll());

it("reads investor customer KPIs from the active company in this server's database", async () => {
  const companyId = new Types.ObjectId();
  const period: ResolvedPeriod = {
    from: new Date("2026-10-01T00:00:00.000Z"),
    to: new Date("2026-10-31T23:59:59.999Z"),
    previousFrom: new Date("2026-09-01T00:00:00.000Z"),
    previousTo: new Date("2026-09-30T23:59:59.999Z"),
  };
  const filters: Array<Record<string, unknown>> = [];
  mock.method(User, "countDocuments", (async (filter: Record<string, unknown>) => {
    filters.push(filter);
    return filters.length === 1 ? 8 : filters.length === 2 ? 7 : 2;
  }) as any);

  const data = await runWithCompany({ companyId, isDefault: false }, () =>
    AnalyticsService.activeCustomers(period),
  );

  assert.equal(data.current, 8);
  assert.equal(data.previous, 7);
  assert.equal(data.newCustomers, 2);
  assert.equal(filters.length, 3);
  for (const filter of filters) {
    assert.equal(filter.companyId, companyId);
    assert.equal(filter.roles, UserRole.CUSTOMER);
    assert.equal(filter.status, UserStatus.ACTIVE);
  }
});
