import assert from "node:assert/strict";
import test from "node:test";
import { TaskStatus, TaskWorkflowStage } from "../../models/index.js";
import { taskProgressPercent } from "./task-progress.js";

test("completed workflow tasks always report 100 percent over stale progress updates", () => {
  assert.equal(taskProgressPercent({
    workflowStage: TaskWorkflowStage.COMPLETED,
    status: TaskStatus.DONE,
  }, 25), 100);
});

test("legacy completed tasks and tasks with a completion timestamp report 100 percent", () => {
  assert.equal(taskProgressPercent({
    workflowStage: TaskWorkflowStage.ASSIGNED,
    status: TaskStatus.DONE,
  }, 25), 100);
  assert.equal(taskProgressPercent({
    workflowStage: TaskWorkflowStage.ASSIGNED,
    status: TaskStatus.PENDING,
    completedAt: new Date("2026-10-09T12:00:00Z"),
  }, 25), 100);
});

test("open tasks preserve the latest reported progress", () => {
  assert.equal(taskProgressPercent({
    workflowStage: TaskWorkflowStage.ASSIGNED,
    status: TaskStatus.PENDING,
  }, 45), 45);
  assert.equal(taskProgressPercent({
    workflowStage: TaskWorkflowStage.ASSIGNED,
    status: TaskStatus.PENDING,
  }), 0);
});
