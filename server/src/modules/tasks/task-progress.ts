export type TaskProgressState = {
  status: string;
  workflowStage: string;
  completedAt?: Date | null;
};

export function taskProgressPercent(task: TaskProgressState, reportedProgress?: number | null) {
  return task.workflowStage === "COMPLETED" || task.status === "DONE" || Boolean(task.completedAt)
    ? 100
    : reportedProgress ?? 0;
}

type TaskReportProgress = {
  taskId: unknown;
  reportDate: string;
  updatedAt: Date;
  progress: number;
};

export function completedTaskReports<T extends TaskReportProgress>(
  reports: T[],
  tasks: Array<TaskProgressState & { _id: unknown }>,
): T[] {
  const completedTaskIds = new Set(
    tasks.filter((task) => taskProgressPercent(task) === 100).map((task) => String(task._id)),
  );
  const latestByTask = new Map<string, T>();
  for (const report of reports) {
    const taskId = String(report.taskId);
    const latest = latestByTask.get(taskId);
    if (
      !latest
      || report.reportDate > latest.reportDate
      || (report.reportDate === latest.reportDate && report.updatedAt > latest.updatedAt)
    ) {
      latestByTask.set(taskId, report);
    }
  }
  return reports.map((report) => {
    const taskId = String(report.taskId);
    return completedTaskIds.has(taskId) && latestByTask.get(taskId) === report
      ? { ...report, progress: 100 }
      : report;
  });
}
