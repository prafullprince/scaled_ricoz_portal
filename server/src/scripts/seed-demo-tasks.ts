import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { connectDB } from "../config/mongodb.js";
import {
  type ITaskWorkflowEvent,
  Task,
  TaskStatus,
  TaskWorkflowAction,
  TaskWorkflowStage,
  User,
} from "../models/index.js";

const emailDomain = "ricoz.demo";
const deadline = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);

type WorkflowSeed = {
  title: string;
  description: string;
  department?: string;
  stage: TaskWorkflowStage;
  ownerEmail?: string;
  projectObjective?: string;
  subtasks?: Array<{ title: string; description: string; assigneeEmail: string }>;
};

const workflows: WorkflowSeed[] = [
  {
    title: "Demo: Quarterly customer experience review",
    description: "Review customer feedback themes and propose the next quarter's highest-impact improvements.",
    stage: TaskWorkflowStage.ADMIN_REVIEW,
  },
  {
    title: "Demo: Product onboarding conversion plan",
    description: "Improve first-session activation for new workspace users.",
    department: "PRODUCT",
    stage: TaskWorkflowStage.HEAD_PLANNING,
    ownerEmail: `demo.product.head@${emailDomain}`,
  },
  {
    title: "Demo: Marketing launch narrative",
    description: "Create a campaign narrative and launch calendar for the next product release.",
    department: "MARKETING",
    stage: TaskWorkflowStage.HEAD_PLANNING,
    ownerEmail: `demo.marketing.head@${emailDomain}`,
  },
  {
    title: "Demo: Finance forecasting controls",
    description: "Define validation checks for the monthly revenue forecast process.",
    department: "FINANCE",
    stage: TaskWorkflowStage.HEAD_PLANNING,
    ownerEmail: `demo.finance.head@${emailDomain}`,
  },
  {
    title: "Demo: Sales pipeline health audit",
    description: "Identify stalled opportunity patterns and prepare an action plan.",
    department: "SALES",
    stage: TaskWorkflowStage.HEAD_PLANNING,
    ownerEmail: `demo.sales.head@${emailDomain}`,
  },
  {
    title: "Demo: Project delivery milestone board",
    description: "Break the delivery board refresh into implementation work suitable for the project team.",
    department: "PROJECTS",
    stage: TaskWorkflowStage.MANAGER_PLANNING,
    ownerEmail: `demo.projects.manager@${emailDomain}`,
    projectObjective: "Give delivery teams a reliable view of project milestones, risks, and ownership.",
  },
  {
    title: "Demo: Support response quality dashboard",
    description: "Design the work package for tracking response quality and resolution trends.",
    department: "SUPPORT",
    stage: TaskWorkflowStage.MANAGER_PLANNING,
    ownerEmail: `demo.support.manager@${emailDomain}`,
    projectObjective: "Make support quality trends visible to support leads each week.",
  },
  {
    title: "Demo: HR onboarding checklist refresh",
    description: "Break down the onboarding checklist improvements for the HR delivery team.",
    department: "HR",
    stage: TaskWorkflowStage.MANAGER_PLANNING,
    ownerEmail: `demo.hr.manager@${emailDomain}`,
    projectObjective: "Create a consistent and complete employee onboarding experience.",
  },
  {
    title: "Demo: Design system component audit",
    description: "Audit the shared interface components and close the highest-priority accessibility gaps.",
    department: "DESIGN",
    stage: TaskWorkflowStage.DELEGATED,
    ownerEmail: `demo.design.manager@${emailDomain}`,
    projectObjective: "Raise consistency and accessibility across the product interface.",
    subtasks: [
      { title: "Audit component contrast", description: "Review the core component set against contrast requirements and record fixes.", assigneeEmail: `demo.design.employee@${emailDomain}` },
      { title: "Document focus states", description: "Create implementation notes for keyboard focus states across components.", assigneeEmail: `demo.design.intern@${emailDomain}` },
    ],
  },
  {
    title: "Demo: Engineering API reliability pass",
    description: "Improve observability and error handling for the highest-traffic API paths.",
    department: "ENGINEERING",
    stage: TaskWorkflowStage.DELEGATED,
    ownerEmail: `demo.engineering.manager@${emailDomain}`,
    projectObjective: "Make API failures diagnosable and reduce avoidable request errors.",
    subtasks: [
      { title: "Add API error context", description: "Add structured context to the top API error paths.", assigneeEmail: `demo.engineering.employee@${emailDomain}` },
      { title: "Build request health report", description: "Prepare a lightweight report for request failures and latency signals.", assigneeEmail: `demo.engineering.intern@${emailDomain}` },
    ],
  },
];

async function findUserId(email: string) {
  const user = await User.findOne({ email }).select("_id").lean();
  if (!user) throw new Error(`Demo account is missing: ${email}`);
  return user._id;
}

function workflowHistory(
  stage: TaskWorkflowStage,
  ceoId: Types.ObjectId,
  adminId: Types.ObjectId,
  ownerId?: Types.ObjectId,
) {
  const history: ITaskWorkflowEvent[] = [
    { action: TaskWorkflowAction.CREATED, actorId: ceoId, createdAt: new Date() },
  ];
  if (stage !== TaskWorkflowStage.ADMIN_REVIEW && ownerId) {
    history.push({ action: TaskWorkflowAction.ROUTED_TO_HEAD, actorId: adminId, recipientId: ownerId, createdAt: new Date() });
  }
  return history;
}

await connectDB();

try {
  const [ceoId, adminId] = await Promise.all([
    findUserId(`demo.ceo@${emailDomain}`),
    findUserId(`demo.admin@${emailDomain}`),
  ]);

  for (const [index, workflow] of workflows.entries()) {
    const ownerId = workflow.ownerEmail
      ? await findUserId(workflow.ownerEmail)
      : null;
    const task = await Task.findOneAndUpdate(
      { title: workflow.title, parentTaskId: null },
      {
        $set: {
          description: workflow.description,
          deadline: deadline(index + 7),
          assignedBy: adminId,
          createdBy: ceoId,
          currentOwner: ownerId,
          department: workflow.department ?? null,
          projectObjective: workflow.projectObjective ?? null,
          recommendedStack: [],
          requirements: [],
          finalDeliverables: [],
          learningResources: [],
          workflowStage: workflow.stage,
          status: TaskStatus.PENDING,
          completedAt: null,
          workflowHistory: workflowHistory(workflow.stage, ceoId, adminId, ownerId ?? undefined),
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    if (!task) throw new Error(`Unable to seed ${workflow.title}`);

    if (!workflow.subtasks) continue;
    for (const [subtaskIndex, subtask] of workflow.subtasks.entries()) {
      const assigneeId = await findUserId(subtask.assigneeEmail);
      await Task.findOneAndUpdate(
        { title: subtask.title, parentTaskId: task._id },
        {
          $set: {
            description: subtask.description,
            deadline: deadline(index + subtaskIndex + 3),
            assignedTo: assigneeId,
            assignedBy: ownerId,
            createdBy: ceoId,
            currentOwner: assigneeId,
            parentTaskId: task._id,
            department: workflow.department,
            projectObjective: workflow.projectObjective,
            workflowStage: TaskWorkflowStage.ASSIGNED,
            status: TaskStatus.PENDING,
            completedAt: null,
            workflowHistory: [{ action: TaskWorkflowAction.DELEGATED, actorId: ownerId, recipientId: assigneeId, createdAt: new Date() }],
          },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      );
    }
  }

  console.log(`Seeded ${workflows.length} demo workflow tasks.`);
} finally {
  await mongoose.disconnect();
}