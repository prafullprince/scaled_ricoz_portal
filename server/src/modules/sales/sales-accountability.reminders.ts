import { Company, Task, TaskStatus } from "../../models/index.js";
import { Notification } from "../../models/notification.models.js";
import { runWithCompany, scopeFor } from "../company/company.context.js";
import { taskNotificationRecipients } from "../tasks/task-notification.service.js";

export async function remindSalesAccountability() {
  const now = new Date();
  for await (const company of Company.find({ active: true }).select("_id").cursor()) {
    await runWithCompany(scopeFor(company._id), async () => {
      const tasks = Task.find({
        department: "SALES", salesAccountability: { $ne: null }, status: TaskStatus.PENDING,
        $or: [{ deadline: { $lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) } }, { "salesAccountability.state": "BLOCKED" }],
      }).cursor();
      for await (const task of tasks) {
        const kind = task.salesAccountability?.state === "BLOCKED" ? "Blocked" : task.deadline < now ? "Overdue" : "Due within 24 hours";
        for (const userId of taskNotificationRecipients(task)) {
          const dedupeKey = `sales:${task._id}:${userId}:${kind}:${now.toISOString().slice(0, 10)}`;
          await Notification.updateOne({ dedupeKey }, { $setOnInsert: {
            userId, taskId: task._id, title: `${kind}: ${task.title}`,
            message: `${kind} Sales work requires attention. Review the target, evidence and next action in Sales task operations.`,
            dedupeKey,
          } }, { upsert: true, setDefaultsOnInsert: true });
        }
      }
    });
  }
}
