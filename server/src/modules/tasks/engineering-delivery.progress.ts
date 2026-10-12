import type { DeliveryProgressReport, DeliveryWorkItem, EngineeringDeliveryRecord } from "../../models/engineering-delivery.models.js";

export type DeliveryProgressPeriod = "WEEK" | "MONTH" | "YEAR";
export type DeliveryProgressPerson = { id: string; name: string; level: string | null };

export function workItemProgress(record: EngineeringDeliveryRecord, item: DeliveryWorkItem): number {
  if (item.status === "COMPLETED" || item.completedAt) return 100;
  const children = record.workItems.filter((child) => child.parentId === item.id);
  if (!children.length) return Math.max(0, Math.min(100, item.progress ?? 0));
  return Math.round(children.reduce((sum, child) => sum + workItemProgress(record, child), 0) / children.length);
}

export function deliveryProgress(record: EngineeringDeliveryRecord): number {
  if (record.phase === "COMPLETED" || record.completedAt) return 100;
  const topLevel = record.workItems.filter((item) => item.parentId === null);
  if (!topLevel.length) return 0;
  return Math.round(topLevel.reduce((sum, item) => sum + workItemProgress(record, item), 0) / topLevel.length);
}

export function progressReportsForDisplay(record: EngineeringDeliveryRecord): DeliveryProgressReport[] {
  const reports = record.progressReports ?? [];
  const latestByNode = new Map<string, DeliveryProgressReport>();
  for (const report of reports) {
    const latest = latestByNode.get(report.nodeId);
    if (!latest || report.updatedAt > latest.updatedAt) latestByNode.set(report.nodeId, report);
  }
  return reports.map((report) => {
    const item = record.workItems.find((workItem) => workItem.id === report.nodeId);
    const completed = item?.status === "COMPLETED" || Boolean(item?.completedAt);
    return completed && latestByNode.get(report.nodeId) === report
      ? { ...report, progress: 100 }
      : report;
  });
}

export function progressReportCanBeUpdated(
  record: EngineeringDeliveryRecord,
  actor: { id: string; level: string | null; department: string | null },
  item: DeliveryWorkItem,
): boolean {
  if (record.phase !== "DELIVERY" || actor.department !== record.department || item.assigneeId !== actor.id) return false;
  if (!["TODO", "IN_PROGRESS", "REWORK"].includes(item.status)) return false;
  if (item.kind === "MEMBER") return actor.level === "MEMBER";
  if (item.kind === "HEAD") {
    return actor.level === "HEAD" && !record.workItems.some((child) => child.parentId === item.id);
  }
  return actor.level === "MANAGER" && !record.workItems.some((child) => child.parentId === item.id);
}

function periodStart(period: DeliveryProgressPeriod, now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === "WEEK") {
    const daysSinceMonday = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  } else if (period === "MONTH") {
    start.setUTCDate(1);
  } else {
    start.setUTCMonth(0, 1);
  }
  return start;
}

export type DeliveryContributionDay = {
  date: string;
  updates: number;
  progressGained: number;
  completedTasks: number;
};

export type DeliveryLeaderboardEntry = {
  userId: string;
  name: string;
  level: string | null;
  progressGained: number;
  completedTasks: number;
  score: number;
};

export function deliveryContributionAnalytics(
  records: EngineeringDeliveryRecord[],
  people: DeliveryProgressPerson[],
  period: DeliveryProgressPeriod,
  now = new Date(),
): { period: DeliveryProgressPeriod; leaderboard: DeliveryLeaderboardEntry[]; calendar: DeliveryContributionDay[] } {
  const rangeStart = periodStart(period, now);
  const calendarStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 364));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const days = new Map<string, DeliveryContributionDay>();
  for (let date = new Date(calendarStart); date <= today; date.setUTCDate(date.getUTCDate() + 1)) {
    const key = date.toISOString().slice(0, 10);
    days.set(key, { date: key, updates: 0, progressGained: 0, completedTasks: 0 });
  }

  const peopleById = new Map(people.map((person) => [person.id, person]));
  const scoreByUser = new Map<string, { progressGained: number; completedTasks: number }>();
  const metric = (userId: string) => {
    const existing = scoreByUser.get(userId) ?? { progressGained: 0, completedTasks: 0 };
    scoreByUser.set(userId, existing);
    return existing;
  };
  const withinPeriod = (value: Date) => value >= rangeStart && value <= now;

  for (const record of records) {
    for (const report of record.progressReports ?? []) {
      const contributionDate = new Date(`${report.reportDate}T00:00:00.000Z`);
      const gain = Math.max(0, report.progress - report.previousProgress);
      const day = days.get(report.reportDate);
      if (day) {
        day.updates += 1;
        day.progressGained += gain;
      }
      if (withinPeriod(contributionDate)) metric(report.actorId).progressGained += gain;
    }
    for (const item of record.workItems) {
      if (!item.completedAt || !withinPeriod(item.completedAt)) continue;
      metric(item.assigneeId).completedTasks += 1;
      const day = days.get(item.completedAt.toISOString().slice(0, 10));
      if (day) day.completedTasks += 1;
    }
    if (record.headId && record.completedAt && withinPeriod(record.completedAt)) {
      metric(record.headId).completedTasks += 1;
      const day = days.get(record.completedAt.toISOString().slice(0, 10));
      if (day) day.completedTasks += 1;
    }
  }

  const leaderboard = [...scoreByUser.entries()].map(([userId, value]) => {
    const person = peopleById.get(userId);
    return {
      userId,
      name: person?.name ?? "Former team member",
      level: person?.level ?? null,
      ...value,
      score: value.progressGained + value.completedTasks * 100,
    };
  }).sort((left, right) =>
    right.score - left.score
    || right.progressGained - left.progressGained
    || left.name.localeCompare(right.name),
  );

  return { period, leaderboard, calendar: [...days.values()] };
}

export function previousProgressForReport(
  reports: DeliveryProgressReport[],
  nodeId: string,
  actorId: string,
  reportDate: string,
): number {
  return reports
    .filter((report) => report.nodeId === nodeId && report.actorId === actorId && report.reportDate < reportDate)
    .sort((left, right) => right.reportDate.localeCompare(left.reportDate))[0]?.progress ?? 0;
}
