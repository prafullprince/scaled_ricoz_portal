import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CLIENT_FILTER_PROPERTIES,
  clientFilterKey,
  clientFilterKind,
  clientFilterOperators,
  matchesClientFilter,
} from "./client-filters";

const filterValues: Record<string, string | number | boolean> = Object.fromEntries(CLIENT_FILTER_PROPERTIES.map((property) => [
  clientFilterKey(property),
  "Ricoz Client",
]));
filterValues.touchedrecords = true;
filterValues.untouchedrecords = false;
filterValues.pipelineamount = 1250.5;
filterValues.pipelineclosingdate = "2026-09-30T00:00:00.000Z";
filterValues.createdtime = "2026-09-30T17:30:00.000Z";
filterValues.lastactivitytime = "2026-09-30T05:00:00.000Z";
filterValues.modifiedtime = "2026-10-01T00:00:00.000Z";
filterValues.unsubscribedtime = "2026-09-30";

const lead = {
  name: "Ricoz Client",
  company: "Ricoz",
  email: "client@example.com",
  phone: "+91 1234567890",
  filterValues,
};

test("every Client Lists filter property has a populated value and usable operators", () => {
  for (const property of CLIENT_FILTER_PROPERTIES) {
    assert.ok(clientFilterOperators(property).length > 0, `${property} should expose operators`);
    assert.ok(clientFilterKey(property) in filterValues, `${property} should have an API filter value`);
    assert.equal(
      matchesClientFilter(lead, { property, operator: "is not empty", value: "" }),
      true,
      `${property} should match is not empty`,
    );
  }
});

test("text filters support exact, inverse, prefix, suffix, contains, and empty comparisons", () => {
  const property = "Feedback 1";
  const match = (operator: "contains" | "does not contain" | "is" | "is not" | "starts with" | "ends with" | "is empty" | "is not empty", value: string) =>
    matchesClientFilter(lead, { property, operator, value });
  assert.equal(match("contains", "coz Cli"), true);
  assert.equal(match("does not contain", "missing"), true);
  assert.equal(match("is", "Ricoz Client"), true);
  assert.equal(match("is not", "Different"), true);
  assert.equal(match("starts with", "Ricoz"), true);
  assert.equal(match("ends with", "Client"), true);
  assert.equal(match("is empty", ""), false);
  assert.equal(match("is not empty", ""), true);
  assert.equal(matchesClientFilter({ ...lead, filterValues: { ...filterValues, feedback1: "" } }, {
    property,
    operator: "is empty",
    value: "",
  }), true);
});

test("boolean filters correctly handle both yes/no values and inverse conditions", () => {
  for (const property of ["Touched Records", "Untouched Records"]) {
    assert.equal(matchesClientFilter(lead, { property, operator: "is", value: "Yes" }), property === "Touched Records");
    assert.equal(matchesClientFilter(lead, { property, operator: "is", value: "No" }), property === "Untouched Records");
    assert.equal(matchesClientFilter(lead, { property, operator: "is not", value: "Yes" }), property === "Untouched Records");
  }
});

test("numeric filters support decimals and date filters compare calendar days", () => {
  assert.equal(clientFilterKind("Pipeline Amount"), "number");
  assert.equal(matchesClientFilter(lead, { property: "Pipeline Amount", operator: "is", value: "1,250.5" }), true);
  assert.equal(matchesClientFilter(lead, { property: "Pipeline Amount", operator: "greater than", value: "1200" }), true);
  assert.equal(matchesClientFilter(lead, { property: "Pipeline Amount", operator: "less than", value: "1300" }), true);
  assert.equal(matchesClientFilter(lead, { property: "Pipeline Amount", operator: "is not", value: "1251" }), true);
  assert.equal(matchesClientFilter(lead, { property: "Created Time", operator: "is", value: "2026-09-30" }), true);
  assert.equal(matchesClientFilter(lead, { property: "Created Time", operator: "before", value: "2026-10-01" }), true);
  assert.equal(matchesClientFilter(lead, { property: "Modified Time", operator: "after", value: "2026-09-30" }), true);
  assert.equal(matchesClientFilter(lead, { property: "Unsubscribed Time", operator: "is", value: "2026-09-30" }), true);
  assert.equal(matchesClientFilter(lead, { property: "Unsubscribed Time", operator: "is empty", value: "" }), false);
});
