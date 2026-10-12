import assert from "node:assert/strict";
import { test } from "node:test";
import { archiveSalesLeadSchema, bulkUpdateImportedSalesLeadsSchema, importSalesLeadsSchema, salesLeadDeletionSchema } from "./sales.validation.js";

const baseRow = {
  sheet: "Leads",
  rowNumber: 2,
  values: { name: "Ada Lovelace", phone: "+1 555 123 4567" },
};

test("lead import validation accepts rows with bounded string fields", () => {
  const parsed = importSalesLeadsSchema.parse({ body: { rows: [baseRow] } });
  assert.equal(parsed.body.rows[0]?.values.name, "Ada Lovelace");
});

test("Client Lists imports preserve source columns independently of mapped fields", () => {
  const parsed = importSalesLeadsSchema.parse({
    body: {
      rows: [{
        ...baseRow,
        sourceValues: { "First Name": "Ada", "Feedback 1": "Interested" },
      }],
    },
  });
  assert.deepEqual(parsed.body.rows[0]?.sourceValues, { "First Name": "Ada", "Feedback 1": "Interested" });
  const tooManySourceValues = Object.fromEntries(Array.from({ length: 51 }, (_, index) => [`Column ${index + 1}`, "value"]));
  assert.equal(importSalesLeadsSchema.safeParse({
    body: { rows: [{ ...baseRow, sourceValues: tooManySourceValues }] },
  }).success, false);
});

test("Client Lists bulk updates require unique accessible lead IDs and validate field values", () => {
  const leadId = "a".repeat(24);
  const valid = { leadIds: [leadId], field: "Phone", value: "+1 555 123 4567" };
  assert.equal(bulkUpdateImportedSalesLeadsSchema.safeParse({ body: valid }).success, true);
  assert.equal(bulkUpdateImportedSalesLeadsSchema.safeParse({ body: { ...valid, field: "Owner", value: "Other" } }).success, false);
  assert.equal(bulkUpdateImportedSalesLeadsSchema.safeParse({ body: { ...valid, field: "Email", value: "not-an-email" } }).success, false);
  assert.equal(bulkUpdateImportedSalesLeadsSchema.safeParse({ body: { ...valid, leadIds: [leadId, leadId] } }).success, false);
  assert.equal(bulkUpdateImportedSalesLeadsSchema.safeParse({ body: { ...valid, value: "abc" } }).success, false);
});

test("lead import validation rejects rows with more than 50 columns", () => {
  const values = Object.fromEntries(Array.from({ length: 51 }, (_, index) => [`Column ${index + 1}`, "value"]));
  const result = importSalesLeadsSchema.safeParse({
    body: { rows: [{ ...baseRow, values }] },
  });
  assert.equal(result.success, false);
});

test("lead archive validation accepts only explicit archive or restore actions", () => {
  assert.equal(archiveSalesLeadSchema.safeParse({ body: { archived: true } }).success, true);
  assert.equal(archiveSalesLeadSchema.safeParse({ body: { archived: false } }).success, true);
  assert.equal(archiveSalesLeadSchema.safeParse({ body: {} }).success, false);
});

test("Client Lists deletion validation caps bulk removal at the import limit", () => {
  const leadIds = Array.from({ length: 5000 }, (_, index) => (index + 1).toString(16).padStart(24, "0"));
  assert.equal(salesLeadDeletionSchema.safeParse({ body: { leadIds, deleteAll: true } }).success, true);
  assert.equal(salesLeadDeletionSchema.safeParse({ body: { leadIds: [...leadIds, "f".repeat(24)] } }).success, false);
});

test("lead import validation accepts 5,000 rows and enforces the row and cell-size limits", () => {
  assert.equal(
    importSalesLeadsSchema.safeParse({ body: { rows: Array.from({ length: 5000 }, (_, index) => ({ ...baseRow, rowNumber: index + 2 })) } }).success,
    true,
  );
  assert.equal(
    importSalesLeadsSchema.safeParse({ body: { rows: Array.from({ length: 5001 }, (_, index) => ({ ...baseRow, rowNumber: index + 2 })) } }).success,
    false,
  );
  assert.equal(
    importSalesLeadsSchema.safeParse({ body: { rows: [{ ...baseRow, values: { name: "x".repeat(2001) } }] } }).success,
    false,
  );
});
