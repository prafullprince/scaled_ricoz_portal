import { Company, Task, TaskStatus } from "../../models/index.js";
import { Notification } from "../../models/notification.models.js";
import { runWithCompany, scopeFor } from "../company/company.context.js";

export function deadlineReminderThresholds(createdAt: Date | string, deadline: Date | string, now: Date) {
  const start = new Date(createdAt).getTime();
  const end = new Date(deadline).getTime();
  const current = now.getTime();
  if (![start, end, current].every(Number.isFinite) || end <= start || current >= end || current < start) return [];
  const remaining = (end - current) / (end - start);
  return [20, 10].filter((threshold) => remaining <= threshold / 100);
}

export async function remindTaskDeadlines(now = new Date()) {
  for await (const company of Company.find({ active: true }).select("_id").cursor()) {
    await runWithCompany(scopeFor(company._id), async () => {
      const tasks = Task.find({
        assignedTo: { $ne: null },
        status: TaskStatus.PENDING,
        deadline: { $gt: now },
        createdAt: { $lt: now },
      }).select("_id title createdAt deadline assignedTo currentOwner").cursor();

      for await (const task of tasks) {
        for (const threshold of deadlineReminderThresholds(task.createdAt, task.deadline, now)) {
          const recipients = new Set([task.assignedTo, task.currentOwner].filter(Boolean).map(String));
          for (const userId of recipients) {
            const dedupeKey = `task-deadline:${task._id}:${userId}:${threshold}`;
            const result = await Notification.updateOne(
              { dedupeKey },
              { $setOnInsert: {
                userId,
                taskId: task._id,
                title: `${threshold}% time remaining: ${task.title}`,
                message: `${threshold}% of the assigned time remains before this task deadline.`,
                dedupeKey,
              } },
              { upsert: true, setDefaultsOnInsert: true },
            );
            if (!result.upsertedCount) continue;
            const { publishChatEvent } = await import("../chat/chat.infrastructure.js");
            void publishChatEvent({ type: "task.notification", notification: {
              _id: `${dedupeKey}`,
              userId,
              taskId: String(task._id),
              title: `${threshold}% time remaining: ${task.title}`,
              message: `${threshold}% of the assigned time remains before this task deadline.`,
              readAt: null,
              createdAt: now.toISOString(),
            } }, [userId], 5000).catch((error) => console.error("Task deadline notification publish failed", error));
          }
        }
      }
    });
  }
}
