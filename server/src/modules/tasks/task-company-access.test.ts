import assert from "node:assert/strict";
import test from "node:test";
import { canReadTaskCompany } from "./task-company-access.js";

const defaultCompanyId = "ricoz";
const otherCompanyId = "client-company";
const anotherCompanyId = "different-company";

test("Ricoz Innovation executives can read task data in selected company scopes", () => {
  assert.equal(canReadTaskCompany(["CEO"], ["CEO"], defaultCompanyId, otherCompanyId, defaultCompanyId), true);
  assert.equal(canReadTaskCompany(["ADMIN"], ["ADMIN"], defaultCompanyId, anotherCompanyId, defaultCompanyId), true);
  assert.equal(canReadTaskCompany(["HR"], ["HR"], defaultCompanyId, otherCompanyId, defaultCompanyId), true);
});

test("other-company executives can read task data only in their home company", () => {
  for (const role of ["CEO", "ADMIN", "HR"]) {
    assert.equal(canReadTaskCompany([role], [role], otherCompanyId, otherCompanyId, defaultCompanyId), true);
    assert.equal(canReadTaskCompany([role], [role], otherCompanyId, anotherCompanyId, defaultCompanyId), false);
  }
});

test("the company-wide executive restriction does not change non-executive access", () => {
  assert.equal(canReadTaskCompany(["ENGINEERING_HEAD"], ["ENGINEERING_HEAD"], otherCompanyId, anotherCompanyId, defaultCompanyId), true);
});
