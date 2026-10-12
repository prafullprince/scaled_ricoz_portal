import assert from "node:assert/strict";
import test from "node:test";
import {
  createApplicationAssignmentSchema,
  submitApplicationAssignmentSchema,
} from "./recruitment.validation.js";

test("assignment creation requires clear instructions and a future deadline", () => {
  const valid = createApplicationAssignmentSchema.safeParse({
    body: {
      title: "Design exercise",
      instructions: "Create a short prototype and explain the design decisions.",
      deadline: new Date(Date.now() + 60_000),
    },
  });
  assert.equal(valid.success, true);

  const pastDeadline = createApplicationAssignmentSchema.safeParse({
    body: {
      title: "Design exercise",
      instructions: "Create a short prototype and explain the design decisions.",
      deadline: new Date(Date.now() - 60_000),
    },
  });
  assert.equal(pastDeadline.success, false);

  const shortInstructions = createApplicationAssignmentSchema.safeParse({
    body: {
      title: "Design exercise",
      instructions: "Do it",
      deadline: new Date(Date.now() + 60_000),
    },
  });
  assert.equal(shortInstructions.success, false);
});

test("assignment submission allows optional text for file multipart requests", () => {
  assert.equal(
    submitApplicationAssignmentSchema.safeParse({
      body: { submissionText: "Here is my response." },
    }).success,
    true,
  );
  assert.equal(
    submitApplicationAssignmentSchema.safeParse({ body: {} }).success,
    true,
  );
});
