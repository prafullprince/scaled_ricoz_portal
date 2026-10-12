import assert from "node:assert/strict";
import test from "node:test";
import { deadlineReminderThresholds } from "./task-deadline-reminders.js";

const start = new Date("2026-01-01T00:00:00.000Z");
const deadline = new Date("2026-01-11T00:00:00.000Z");
const atRemaining = (fraction: number) => new Date(start.getTime() + (deadline.getTime() - start.getTime()) * (1 - fraction));

test("deadline reminders trigger at 20% and 10% of assigned time remaining", () => {
  assert.deepEqual(deadlineReminderThresholds(start, deadline, atRemaining(0.2)), [20]);
  assert.deepEqual(deadlineReminderThresholds(start, deadline, atRemaining(0.1)), [20, 10]);
});

test("deadline reminders do not trigger before 20%, after due time, or for invalid durations", () => {
  assert.deepEqual(deadlineReminderThresholds(start, deadline, atRemaining(0.21)), []);
  assert.deepEqual(deadlineReminderThresholds(start, deadline, deadline), []);
  assert.deepEqual(deadlineReminderThresholds(deadline, start, new Date()), []);
});
