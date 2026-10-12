import assert from "node:assert/strict";
import { test } from "node:test";
import { DEMO_ACCOUNTS } from "./demoAccounts";

test("Engineering Head demo account is available in featured development accounts", () => {
  const engineeringHead = DEMO_ACCOUNTS.find((account) => account.email === "demo.engineering.head@ricoz.demo");
  assert.ok(engineeringHead);
  assert.equal(engineeringHead.name, "Demo Engineering Head");
  assert.equal(engineeringHead.department, "Engineering");
  assert.deepEqual(engineeringHead.roles, ["USER", "ENGINEERING_HEAD"]);
  assert.equal(engineeringHead.featured, true);
});

test("IT Head demo account is available for DevOps pipeline testing", () => {
  const itHead = DEMO_ACCOUNTS.find((account) => account.email === "demo.it.head@ricoz.demo");
  assert.ok(itHead);
  assert.equal(itHead.name, "Demo IT Head");
  assert.equal(itHead.department, "IT");
  assert.deepEqual(itHead.roles, ["USER", "IT_HEAD"]);
  assert.equal(itHead.featured, true);
});
