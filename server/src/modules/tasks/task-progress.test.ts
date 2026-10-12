import assert from "node:assert/strict";
import test from "node:test";
import { completedTaskReports, taskProgressPercent } from "./task-progress.js";

test("completed tasks report 100 percent even when their latest saved progress is lower", () => {
  const taskId = "completed-task";
  const earlier = { taskId, reportDate: "2026-10-08", updatedAt: new Date("2026-10-08T12:00:00Z"), progress: 60 };
  const latest = { taskId, reportDate: "2026-10-09", updatedAt: new Date("2026-10-09T12:00:00Z"), progress: 80 };

  const reports = completedTaskReports([earlier, latest], [{
    _id: taskId,
    status: "DONE",
    workflowStage: "COMPLETED",
  }]);

  assert.equal(reports[0]?.progress, 60);
  assert.equal(reports[1]?.progress, 100);
  assert.equal(latest.progress, 80);
  assert.equal(taskProgressPercent({ status: "DONE", workflowStage: "ASSIGNED" }, 80), 100);
});

test("open tasks keep their latest reported progress", () => {
  const report = { taskId: "open-task", reportDate: "2026-10-09", updatedAt: new Date("2026-10-09T12:00:00Z"), progress: 45 };
  assert.equal(completedTaskReports([report], [{
    _id: "open-task",
    status: "PENDING",
    workflowStage: "ASSIGNED",
  }])[0]?.progress, 45);
  assert.equal(taskProgressPercent({ status: "PENDING", workflowStage: "ASSIGNED" }), 0);
});
