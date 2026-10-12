import { Notification } from "../../models/notification.models.js";
import { EmployeeProfile, InternProfile, Product, User } from "../../models/index.js";
import { sendTaskAssignmentEmail } from "../../utils/email.utils.js";

type TaskEvent = { _id: unknown; title: string; description?: string; projectObjective?: string; recommendedStack?: string[]; requirements?: string[]; finalDeliverables?: string[]; createdAt?: Date | string; deadline?: Date | string | null; priority?: string; department?: string | null; productId?: unknown; assignedTo?: unknown; assignedBy?: unknown; createdBy?: unknown; currentOwner?: unknown; status?: string; workflowStage?: string; workflowHistory?: Array<{ actorId?: unknown; recipientId?: unknown; action?: string }> };
type SalesTaskEvent = TaskEvent & { salesAccountability?: { supervisorIds?: unknown[] } | null };
const identifier = (value: unknown): string | null => value ? String(typeof value === "object" && "_id" in value ? value._id : value) : null;

export function taskNotificationRecipients(task: SalesTaskEvent) {
  return [...new Set([task.assignedTo, task.assignedBy, task.createdBy, task.currentOwner, ...(task.salesAccountability?.supervisorIds ?? []), ...(task.workflowHistory ?? []).flatMap((event) => [event.actorId, event.recipientId])].map(identifier).filter((value): value is string => Boolean(value)))];
}

export async function notifyTaskChange(task: SalesTaskEvent, action = "Updated", assignmentEmail = action === "Assigned", assignmentRecipient?: unknown) {
  const recipients = taskNotificationRecipients(task);
  if (!recipients.length) return;
  const notifications = await Notification.insertMany(recipients.map((userId) => ({ userId, taskId: task._id, title: task.title, message: `${action}: ${(task.workflowStage ?? task.status ?? "PENDING").replaceAll("_", " ").toLowerCase()}` })));
  const { publishChatEvent } = await import("../chat/chat.infrastructure.js");
  void Promise.allSettled(notifications.map((notification) => publishChatEvent({ type: "task.notification", notification }, [String(notification.userId)], 5000)));
  const assigneeId = assignmentEmail ? identifier(assignmentRecipient) ?? identifier(task.assignedTo) : null;
  if (!assigneeId) return;
  try {
    const [assignee, assigner, product, internProfile, employeeProfile] = await Promise.all([
      User.findById(assigneeId).select("name email roles").lean(),
      User.findById(identifier(task.assignedBy)).select("name").lean(),
      task.productId ? Product.findById(identifier(task.productId)).select("title").lean() : null,
      InternProfile.findOne({ userId: assigneeId }).select("currentRole").lean(),
      EmployeeProfile.findOne({ userId: assigneeId }).select("currentRole").lean(),
    ]);
    if (!assignee?.email) return;
    const role = internProfile?.currentRole || employeeProfile?.currentRole || assignee.roles?.[0]?.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
    const department = task.department?.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
    await sendTaskAssignmentEmail(assignee.email, {
      recipientName: assignee.name,
      taskTitle: task.title,
      description: task.description ?? "",
      projectObjective: task.projectObjective,
      recommendedStack: task.recommendedStack,
      requirements: task.requirements,
      deliverables: task.finalDeliverables,
      startDate: task.createdAt,
      role,
      department,
      assignedBy: assigner?.name,
      deadline: task.deadline,
      priority: task.priority,
      projectName: product?.title,
    });
  } catch (error) {
    console.error("Task assignment email delivery failed", error);
  }
}