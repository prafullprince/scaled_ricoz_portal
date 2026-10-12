import { Schema, model, Document, Types, type Model } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";
import { salesAccountabilitySchema, type SalesAccountability } from "../modules/sales/sales-accountability.js";

export enum TaskStatus {
  PENDING = "PENDING",
  DONE = "DONE",
}

export enum TaskPriority {
  P1 = "P1",
  P2 = "P2",
  P3 = "P3",
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export enum TaskWorkflowStage {
  ADMIN_REVIEW = "ADMIN_REVIEW",
  HEAD_PLANNING = "HEAD_PLANNING",
  MANAGER_PLANNING = "MANAGER_PLANNING",
  DELEGATED = "DELEGATED",
  ASSIGNED = "ASSIGNED",
  SUBMITTED = "SUBMITTED",
  MANAGER_REVIEW = "MANAGER_REVIEW",
  HEAD_REVIEW = "HEAD_REVIEW",
  ADMIN_FINAL_REVIEW = "ADMIN_FINAL_REVIEW",
  CEO_REVIEW = "CEO_REVIEW",
  COMPLETED = "COMPLETED",
}

export enum TaskWorkflowAction {
  CREATED = "CREATED",
  ROUTED_TO_HEAD = "ROUTED_TO_HEAD",
  ROUTED_TO_MANAGER = "ROUTED_TO_MANAGER",
  DELEGATED = "DELEGATED",
  MEMBER_SUBMITTED = "MEMBER_SUBMITTED",
  REPORT_SUBMITTED = "REPORT_SUBMITTED",
  FORWARDED_TO_HEAD = "FORWARDED_TO_HEAD",
  FORWARDED_TO_ADMIN = "FORWARDED_TO_ADMIN",
  FORWARDED_TO_CEO = "FORWARDED_TO_CEO",
  ENHANCEMENT_REQUESTED = "ENHANCEMENT_REQUESTED",
  ACCEPTED = "ACCEPTED",
  COMPLETED = "COMPLETED",
  COMMENTED = "COMMENTED",
}

export interface ITaskWorkflowEvent {
  action: TaskWorkflowAction;
  actorId: Types.ObjectId;
  recipientId?: Types.ObjectId | null;
  note?: string;
  createdAt: Date;
}

export interface ITaskSubmission {
  description: string;
  githubUrl?: string;
  liveUrl?: string;
  submittedAt: Date;
}

export interface ITask extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  projectObjective?: string;
  recommendedStack?: string[];
  requirements?: string[];
  finalDeliverables?: string[];
  learningResources?: string[];
  deadline: Date;
  priority: TaskPriority;
  assignedTo?: Types.ObjectId | null;
  assignedBy: Types.ObjectId;
  createdBy: Types.ObjectId;
  currentOwner?: Types.ObjectId | null;
  parentTaskId?: Types.ObjectId | null;
  productId?: Types.ObjectId | null;
  collaborationBatchId?: Types.ObjectId | null;
  collaborationConversationId?: Types.ObjectId | null;
  department?: string | null;
  workflowStage: TaskWorkflowStage;
  workflowHistory: ITaskWorkflowEvent[];
  submission?: ITaskSubmission | null;
  salesAccountability?: SalesAccountability | null;
  status: TaskStatus;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const workflowEventSchema = new Schema<ITaskWorkflowEvent>(
  {
    action: {
      type: String,
      enum: Object.values(TaskWorkflowAction),
      required: true,
    },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    note: { type: String, trim: true, maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const taskSubmissionSchema = new Schema<ITaskSubmission>(
  {
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    githubUrl: { type: String, trim: true, maxlength: 500 },
    liveUrl: { type: String, trim: true, maxlength: 500 },
    submittedAt: { type: Date, required: true },
  },
  { _id: false },
);

const taskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    projectObjective: { type: String, trim: true, maxlength: 4000 },
    recommendedStack: { type: [String], default: [] },
    requirements: { type: [String], default: [] },
    finalDeliverables: { type: [String], default: [] },
    learningResources: { type: [String], default: [] },
    deadline: { type: Date, required: true, index: true },
    priority: { type: String, enum: Object.values(TaskPriority), default: TaskPriority.P2, index: true },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    currentOwner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    parentTaskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      default: null,
      index: true,
    },
    productId: { type: Schema.Types.ObjectId, ref: "Product", default: null, index: true },
    collaborationBatchId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    collaborationConversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
      index: true,
    },
    department: { type: String, default: null, index: true },
    workflowStage: {
      type: String,
      enum: Object.values(TaskWorkflowStage),
      default: TaskWorkflowStage.ASSIGNED,
      index: true,
    },
    workflowHistory: { type: [workflowEventSchema], default: [] },
    submission: { type: taskSubmissionSchema, default: null },
    salesAccountability: { type: salesAccountabilitySchema, default: null },
    status: {
      type: String,
      enum: Object.values(TaskStatus),
      default: TaskStatus.PENDING,
      index: true,
    },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

taskSchema.index({ assignedTo: 1, status: 1, deadline: 1 });
taskSchema.index({ workflowStage: 1, currentOwner: 1, createdAt: -1 });
taskSchema.plugin(companyScoped);
const assignmentWorkflowActions = new Set([TaskWorkflowAction.ROUTED_TO_HEAD, TaskWorkflowAction.ROUTED_TO_MANAGER, TaskWorkflowAction.DELEGATED, TaskWorkflowAction.MEMBER_SUBMITTED, TaskWorkflowAction.REPORT_SUBMITTED, TaskWorkflowAction.FORWARDED_TO_HEAD, TaskWorkflowAction.FORWARDED_TO_ADMIN, TaskWorkflowAction.FORWARDED_TO_CEO, TaskWorkflowAction.ENHANCEMENT_REQUESTED]);
const workflowRecipient = (task: Pick<ITask, "workflowHistory">, fromIndex = 0) => task.workflowHistory.slice(fromIndex).reverse().find((event) => assignmentWorkflowActions.has(event.action) && event.recipientId)?.recipientId;

taskSchema.pre("save", async function () {
  this.$locals.notificationAction = this.isNew ? "Assigned" : "Updated";
  this.$locals.assignmentEmail = Boolean(this.assignedTo) && (this.isNew || this.isModified("assignedTo"));
  this.$locals.assignmentEmailRecipient = this.$locals.assignmentEmail ? this.assignedTo : undefined;
  if (!this.isNew && !this.$locals.assignmentEmail && this.isModified("workflowHistory")) {
    const previous = await (this.constructor as Model<ITask>).findById(this._id).select("workflowHistory").lean();
    const recipientId = previous ? workflowRecipient(this as unknown as ITask, previous.workflowHistory?.length ?? 0) : undefined;
    if (recipientId) {
      this.$locals.assignmentEmail = true;
      this.$locals.assignmentEmailRecipient = recipientId;
    }
  }
});
taskSchema.post("save", async function (task) {
  try {
    const { notifyTaskChange } = await import("../modules/tasks/task-notification.service.js");
    await notifyTaskChange(task, String(task.$locals.notificationAction ?? "Updated"), Boolean(task.$locals.assignmentEmail), task.$locals.assignmentEmailRecipient);
  } catch (error) { console.error("Task notification persistence failed", error); }
});
taskSchema.post("insertMany", async function (result: unknown) {
  const tasks = result as ITask[];
  try {
    const { notifyTaskChange } = await import("../modules/tasks/task-notification.service.js");
    await Promise.all(tasks.map((task) => notifyTaskChange(task, "Assigned", Boolean(task.assignedTo || workflowRecipient(task)), task.assignedTo ?? workflowRecipient(task))));
  } catch (error) { console.error("Task notification persistence failed", error); }
});
const notificationTargets = new WeakMap<object, Array<{ id: Types.ObjectId; assignedTo: Types.ObjectId | null | undefined; historyLength: number }>>();
taskSchema.pre(["updateOne", "updateMany", "findOneAndUpdate"], async function () {
  const tasks = await this.model.find(this.getFilter()).select("_id assignedTo workflowHistory").lean();
  notificationTargets.set(this, tasks.map((task: { _id: Types.ObjectId; assignedTo?: Types.ObjectId | null | undefined; workflowHistory?: ITaskWorkflowEvent[] }) => ({ id: task._id, assignedTo: task.assignedTo, historyLength: task.workflowHistory?.length ?? 0 })));
});
taskSchema.post(["updateOne", "updateMany", "findOneAndUpdate"], async function () {
  const targets = notificationTargets.get(this);
  notificationTargets.delete(this);
  if (!targets?.length) return;
  try {
    const { notifyTaskChange } = await import("../modules/tasks/task-notification.service.js");
    const tasks: ITask[] = await this.model.find({ _id: { $in: targets.map(({ id }) => id) } });
    const prior = new Map(targets.map(({ id, assignedTo, historyLength }) => [String(id), { assignedTo: assignedTo ? String(assignedTo) : null, historyLength }]));
    await Promise.all(tasks.map((task) => {
      const previous = prior.get(String(task._id));
      const nextAssignee = task.assignedTo ? String(task.assignedTo) : null;
      const recipientId = workflowRecipient(task, previous?.historyLength ?? 0);
      const assigneeChanged = Boolean(nextAssignee && nextAssignee !== previous?.assignedTo);
      return notifyTaskChange(task, "Updated", Boolean(recipientId || assigneeChanged), recipientId ?? task.assignedTo);
    }));
  } catch (error) { console.error("Task update notification persistence failed", error); }
});
export const Task = model<ITask>("Task", taskSchema);
