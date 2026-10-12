import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";
import type { DeliveryProgressReport, DeliveryWorkItem, EngineeringDeliveryRecord } from "../../models/engineering-delivery.models.js";
import { deliveryContributionAnalytics, deliveryProgress, previousProgressForReport, progressReportCanBeUpdated, progressReportsForDisplay, workItemProgress } from "./engineering-delivery.progress.js";

const item = (id: string, parentId: string | null, assigneeId: string, kind: DeliveryWorkItem["kind"], progress = 0, status: DeliveryWorkItem["status"] = "IN_PROGRESS"): DeliveryWorkItem => ({
  id, parentId, assigneeId, kind, progress, completedAt: null, status, title: id, description: id,
  deadline: new Date("2026-12-01T00:00:00Z"), githubUrl: "", contributionInstructions: "", submission: null,
});
const record = (workItems: DeliveryWorkItem[] = []): EngineeringDeliveryRecord => ({
  _id: new Types.ObjectId(), department: "ENGINEERING", headId: "head", createdBy: "admin",
  title: "Project", description: "Project", deadline: new Date("2026-12-01T00:00:00Z"),
  githubUrl: "", contributionInstructions: "", status: "IN_PROGRESS", phase: "DELIVERY",
  submission: null, workItems, progressReports: [], history: [], revision: 1,
  completedAt: null, createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z"),
});
const report = (nodeId: string, actorId: string, reportDate: string, progress: number, previousProgress: number): DeliveryProgressReport => ({
  nodeId, actorId, reportDate, progress, previousProgress, summary: "Progress update",
  createdAt: new Date(`${reportDate}T12:00:00Z`), updatedAt: new Date(`${reportDate}T12:00:00Z`),
});

test("manager and department progress roll up as simple averages of assigned leaf work", () => {
  const project = record([
    item("manager-a", null, "manager-a", "MANAGER"),
    item("member-a1", "manager-a", "member-a1", "MEMBER", 50),
    item("member-a2", "manager-a", "member-a2", "MEMBER", 100),
    item("direct-member", null, "direct-member", "MEMBER", 0),
  ]);
  assert.equal(workItemProgress(project, project.workItems[0]!), 75);
  assert.equal(deliveryProgress(project), 38);
});

test("completed delivery tasks and packages always report 100 percent progress", () => {
  const project = record([
    item("completed", null, "member-a", "MEMBER", 35, "COMPLETED"),
    item("active", null, "member-b", "MEMBER", 60),
  ]);
  project.workItems[0]!.completedAt = new Date("2026-10-09T12:00:00Z");
  assert.equal(workItemProgress(project, project.workItems[0]!), 100);
  assert.equal(deliveryProgress(project), 80);

  project.phase = "COMPLETED";
  project.completedAt = new Date("2026-10-09T12:00:00Z");
  assert.equal(deliveryProgress(project), 100);
  project.workItems = [];
  assert.equal(deliveryProgress(project), 100);
});

test("latest reports display 100 percent after completion while preserving earlier snapshots", () => {
  const project = record([item("task", null, "member", "MEMBER", 100, "COMPLETED")]);
  const earlier = report("task", "member", "2026-10-08", 60, 40);
  const latest = report("task", "member", "2026-10-09", 80, 60);
  project.workItems[0]!.completedAt = new Date("2026-10-09T13:00:00Z");
  project.progressReports = [earlier, latest];

  const displayed = progressReportsForDisplay(project);
  assert.equal(displayed[0]?.progress, 60);
  assert.equal(displayed[1]?.progress, 100);
  assert.equal(latest.progress, 80);
});

test("only the assigned employee or intern can update their open task progress", () => {
  const project = record([item("member", null, "member", "MEMBER")]);
  const assignedMember = { id: "member", level: "MEMBER", department: "ENGINEERING" };
  assert.equal(progressReportCanBeUpdated(project, assignedMember, project.workItems[0]!), true);
  assert.equal(progressReportCanBeUpdated(project, { ...assignedMember, id: "other" }, project.workItems[0]!), false);
  assert.equal(progressReportCanBeUpdated(project, { ...assignedMember, department: "PRODUCT" }, project.workItems[0]!), false);
  project.workItems[0]!.status = "REVIEW";
  assert.equal(progressReportCanBeUpdated(project, assignedMember, project.workItems[0]!), false);
});

test("manager can report a standalone branch, but child work must drive branch roll-up", () => {
  const project = record([item("branch", null, "manager", "MANAGER")]);
  const manager = { id: "manager", level: "MANAGER", department: "ENGINEERING" };
  assert.equal(progressReportCanBeUpdated(project, manager, project.workItems[0]!), true);
  project.workItems.push(item("member", "branch", "member", "MEMBER", 25));
  assert.equal(progressReportCanBeUpdated(project, manager, project.workItems[0]!), false);
  assert.equal(workItemProgress(project, project.workItems[0]!), 25);
});

test("same-day report edits preserve the prior-day baseline", () => {
  const reports = [report("task", "member", "2026-10-01", 35, 10), report("task", "member", "2026-10-02", 45, 35)];
  assert.equal(previousProgressForReport(reports, "task", "member", "2026-10-02"), 35);
  assert.equal(previousProgressForReport(reports, "task", "member", "2026-10-03"), 45);
});

test("calendar and leaderboard rank positive progress gain plus completed tasks by selected range", () => {
  const project = record([item("task-a", null, "member", "MEMBER", 100)]);
  project.progressReports = [
    report("task-a", "member", "2026-10-06", 40, 0),
    report("task-a", "member", "2026-10-07", 30, 40),
    report("task-a", "member", "2026-10-08", 100, 40),
    report("task-a", "other", "2026-09-30", 20, 0),
  ];
  project.workItems[0]!.completedAt = new Date("2026-10-08T14:00:00Z");
  const result = deliveryContributionAnalytics(
    [project],
    [{ id: "member", name: "A Member", level: "MEMBER" }, { id: "other", name: "Other", level: "MEMBER" }],
    "WEEK",
    new Date("2026-10-09T12:00:00Z"),
  );
  assert.equal(result.leaderboard[0]?.userId, "member");
  assert.equal(result.leaderboard[0]?.progressGained, 100);
  assert.equal(result.leaderboard[0]?.completedTasks, 1);
  assert.equal(result.leaderboard[0]?.score, 200);
  assert.equal(result.calendar.find((day) => day.date === "2026-10-07")?.progressGained, 0);
  assert.equal(result.calendar.find((day) => day.date === "2026-10-08")?.completedTasks, 1);
  assert.equal(result.calendar.length, 365);
});
