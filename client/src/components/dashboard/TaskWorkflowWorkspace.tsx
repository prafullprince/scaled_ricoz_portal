"use client";
import { useSelectedDepartment } from "./DepartmentRail";
import { useSearchParams } from "next/navigation";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  CircleAlert,
  Clock3,
  History,
  Inbox,
  LayoutList,
  Plus,
  RotateCcw,
  Route,
  Search,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useAppSelector } from "@/redux/hooks";
import { USER_ROLES } from "@/lib/auth/roles";
import { taskPriorityOptions, type TaskPriorityValue } from "@/lib/task-priority";
import {
  TaskService,
  type Task,
  type WorkflowCandidate,
  type WorkflowSubtaskInput,
} from "@/services/task.service";
import { DashboardEmptyState } from "./DashboardPrimitives";
import { ManagerTeamMemberDialog } from "./ManagerTeamMemberDialog";
import { HierarchyPerformanceBoard } from "./HierarchyPerformanceBoard";
import { HierarchyProgressBoard } from "./HierarchyProgressBoard";
import { ProductDeliveryPanel } from "../products/ProductDeliveryPanel";
import { DeliveryTaskEntry } from "./delivery/DeliveryTaskEntry";
import { MyWorkInbox, type MyWorkItem } from "./MyWorkInbox";

const stageLabel = {
  ADMIN_REVIEW: "Admin triage",
  HEAD_PLANNING: "Department planning",
  MANAGER_PLANNING: "Work breakdown",
  DELEGATED: "In delivery",
  ASSIGNED: "Assigned",
  SUBMITTED: "Submitted",
  MANAGER_REVIEW: "Manager review",
  HEAD_REVIEW: "Head review",
  ADMIN_FINAL_REVIEW: "Admin review",
  CEO_REVIEW: "CEO approval",
  COMPLETED: "Completed",
} as const;
const departments = [
  "PRODUCT",
  "MARKETING",
  "FINANCE",
  "SALES",
  "PROJECTS",
  "SUPPORT",
  "HR",
  "DESIGN",
  "ENGINEERING",
];
const inputClass =
  "h-11 w-full rounded-md border border-(--brand-border) bg-white px-3 text-sm outline-none focus:border-(--brand-red)";
const areaClass =
  "w-full rounded-md border border-(--brand-border) bg-white p-3 text-sm outline-none focus:border-(--brand-red)";
const lines = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
const personName = (person: Task["currentOwner"] | Task["createdBy"]) =>
  person && typeof person !== "string" ? person.name : null;
const personId = (person: Task["currentOwner"]) =>
  person && typeof person !== "string" ? person._id : person;

type DetailForm = {
  managerId: string;
  projectObjective: string;
  recommendedStack: string;
  requirements: string;
  finalDeliverables: string;
  learningResources: string;
};
type WorkItem = {
  title: string;
  description: string;
  deadline: string;
  assignedToIds: string[];
  priority: TaskPriorityValue;
};
type QueueFilter = "ALL" | "ACTION" | "DELIVERY" | "REVIEW" | "COMPLETED";

export function TaskWorkflowWorkspace({
  lockedDepartment,
  showMyWork = true,
}: { lockedDepartment?: string; showMyWork?: boolean } = {}) {
  const user = useAppSelector((state) => state.auth.user);
  const selectedDepartment = useSelectedDepartment();
  const params = useSearchParams();
  const executive = user?.roles.some((role) => role === "CEO" || role === "ADMIN");
  const hrSales = user?.roles.includes("HR") && user.permissions?.includes("TASK_ASSIGN") && params.get("department") === "SALES";
  const department = lockedDepartment ?? (executive || hrSales ? selectedDepartment : user?.organization_department === "SALES" ? "SALES" : undefined);
  return <DeliveryTaskEntry department={department} existing={<DepartmentTaskWorkspace key={department ?? "team"} lockedDepartment={department} showMyWork={showMyWork} />} />;
}

function DepartmentTaskWorkspace({ lockedDepartment, showMyWork }: { lockedDepartment?: string; showMyWork: boolean }) {
  const currentUser = useAppSelector((state) => state.auth.user);
  const roles = currentUser?.roles ?? [];
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [selected, setSelected] = useState<Task | null>(null);
  const [candidates, setCandidates] = useState<WorkflowCandidate[]>([]);
  const [seniorCandidates, setSeniorCandidates] = useState<WorkflowCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [brief, setBrief] = useState({
    title: "",
    description: "",
    deadline: "",
    priority: "P2" as TaskPriorityValue,
  });
  const [route, setRoute] = useState({ department: "", note: "" });
  const [details, setDetails] = useState<DetailForm>({
    managerId: "",
    projectObjective: "",
    recommendedStack: "",
    requirements: "",
    finalDeliverables: "",
    learningResources: "",
  });
  const [workItems, setWorkItems] = useState<WorkItem[]>([
    { title: "", description: "", deadline: "", assignedToIds: [], priority: "P2" },
  ]);
  const [reviewNote, setReviewNote] = useState("");
  const [workflowReport, setWorkflowReport] = useState("");
  const [reportRecipientId, setReportRecipientId] = useState("");
  const [reviewSubtaskId, setReviewSubtaskId] = useState("");
  const [query, setQuery] = useState("");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("ALL");
  const [showInsights, setShowInsights] = useState(false);
  const [headId, setHeadId] = useState("");
  const [loadedAt, setLoadedAt] = useState(0);
  const isCeo = roles.includes(USER_ROLES.CEO);
  const isExecutive = isCeo || roles.includes(USER_ROLES.ADMIN) || (roles.includes(USER_ROLES.HR) && Boolean(currentUser?.permissions?.includes("TASK_ASSIGN")));
  const canManageProducts = isCeo || roles.includes(USER_ROLES.ADMIN) || (roles.includes(USER_ROLES.HR) && Boolean(currentUser?.permissions?.includes("PRODUCT_ADMIN")));
  const isAdmin = isExecutive;
  const isHead = isExecutive || roles.some(
    (role) => role === USER_ROLES.HEAD || role.endsWith("_HEAD"),
  );
  const isManager = isExecutive || roles.some(
    (role) => role === USER_ROLES.MANAGER || role.endsWith("_MANAGER"),
  );
  const roleLabel = isCeo
    ? "CEO"
    : isAdmin
      ? "Administration"
      : isHead
        ? "Department head"
        : "Manager";

  const applyDepartmentFilter = useCallback(
    (result: { tasks: Task[]; subtasks: Task[] }) => {
      if (!lockedDepartment) return result;
      const tasks = result.tasks.filter(
        (task) => task.department === lockedDepartment,
      );
      const taskIds = new Set(tasks.map((task) => task._id));
      return {
        tasks,
        subtasks: result.subtasks.filter((task) =>
          Boolean(task.parentTaskId && taskIds.has(task.parentTaskId)),
        ),
      };
    },
    [lockedDepartment],
  );

  async function load() {
    const result = applyDepartmentFilter(await TaskService.workflow(lockedDepartment));
    setTasks(result.tasks);
    setSubtasks(result.subtasks);
    setLoadedAt(Date.now());
  }

  useEffect(() => {
    let cancelled = false;
    TaskService.workflow(lockedDepartment)
      .then((value) => {
        const result = applyDepartmentFilter(value);
        if (!cancelled) {
          setTasks(result.tasks);
          setSubtasks(result.subtasks);
          setLoadedAt(Date.now());
        }
      })
      .catch(() => setMessage("The workflow queue could not be loaded."))
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [applyDepartmentFilter, lockedDepartment]);

  async function openTask(task: Task) {
    setHeadId("");
    setReviewSubtaskId("");
    setCandidates([]);
    setSeniorCandidates([]);
    setWorkflowReport("");
    setReportRecipientId("");
    setSelected(task);
    setMessage("");
    if (reviewStages.includes(task.workflowStage ?? "")) {
      setCandidates([]);
      setSeniorCandidates([]);
      return;
    }
    try {
      const options = await TaskService.workflowCandidates(task._id);
      setCandidates(options.candidates);
      setSeniorCandidates(options.seniorCandidates);
      if (task.workflowStage === "ADMIN_REVIEW") {
        const first = options.candidates[0];
        setRoute({ department: first?.department ?? "", note: "" });
      }
    } catch {
      setCandidates([]);
      setSeniorCandidates([]);
    }
  }

  async function createBrief(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await TaskService.createWorkflowTask({
        ...brief,
        ...(lockedDepartment ? { department: lockedDepartment } : {}),
      });
      setBrief({ title: "", description: "", deadline: "", priority: "P2" });
      setCreateOpen(false);
      setMessage("The brief is now in the admin queue.");
      await load();
    } catch {
      setMessage("The task brief could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function routeToHead(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await TaskService.routeToHead(selected._id, {
        ...route,
        department: lockedDepartment ?? route.department,
        recipientId: headId,
      });
      setSelected(null);
      setMessage("Task routed to the selected assignee.");
      await load();
    } catch {
      setMessage("Choose an active assignee in the selected department.");
    } finally {
      setSaving(false);
    }
  }

  async function routeToManager(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await TaskService.routeToManager(selected._id, {
        managerId: details.managerId,
        projectObjective: details.projectObjective,
        recommendedStack: lines(details.recommendedStack),
        requirements: lines(details.requirements),
        finalDeliverables: lines(details.finalDeliverables),
        learningResources: lines(details.learningResources),
      });
      setSelected(null);
      setMessage("Technical plan handed to the selected manager.");
      await load();
    } catch {
      setMessage("Complete the plan and select a manager in your department.");
    } finally {
      setSaving(false);
    }
  }

  async function delegate(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    if (workItems.some((item) => item.assignedToIds.length === 0)) {
      setMessage("Select at least one intern or employee for every work item.");
      return;
    }
    setSaving(true);
    try {
      const input: WorkflowSubtaskInput[] = workItems.map((item) => ({
        ...item,
      }));
      await TaskService.delegate(selected._id, input);
      setSelected(null);
      setWorkItems([
        { title: "", description: "", deadline: "", assignedToIds: [], priority: "P2" },
      ]);
      setMessage(
        workItems.some((item) => item.assignedToIds.length > 1)
          ? "Work package delegated and collaboration groups created."
          : "Work package delegated to the delivery team.",
      );
      await load();
    } catch {
      setMessage(
        "Every work item needs a direct-report assignee and a deadline within the parent deadline.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitWorkflowReport(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !reportRecipientId) return;
    setSaving(true);
    try {
      await TaskService.submitWorkflowReport(selected._id, {
        recipientId: reportRecipientId,
        report: workflowReport.trim(),
      });
      setSelected(null);
      setMessage("Task report sent to the selected senior reviewer.");
      await load();
    } catch {
      setMessage("The report could not be sent. Confirm the next reporting tier has no active direct reports.");
    } finally {
      setSaving(false);
    }
  }

  async function review(decision: "APPROVE" | "ENHANCEMENT") {
    if (!selected) return;
    if (decision === "ENHANCEMENT" && !reviewNote.trim()) {
      setMessage(
        "Describe the enhancement required before returning the task.",
      );
      return;
    }
    if (
      decision === "ENHANCEMENT" &&
      (selected.workflowStage === "MANAGER_REVIEW" || directHeadReview) &&
      !reviewSubtaskId
    ) {
      setMessage("Select the submitted work item that needs enhancement.");
      return;
    }
    setSaving(true);
    try {
      await TaskService.review(selected._id, {
        decision,
        note: reviewNote.trim() || undefined,
        subtaskId: reviewSubtaskId || undefined,
      });
      setSelected(null);
      setReviewNote("");
      setReviewSubtaskId("");
      setMessage(
        decision === "APPROVE"
          ? "Task forwarded to the next review level."
          : "Enhancement request returned to the responsible owner.",
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The review action could not be completed.",
      );
    } finally {
      setSaving(false);
    }
  }

  const reviewStages = [
    "MANAGER_REVIEW",
    "HEAD_REVIEW",
    "ADMIN_FINAL_REVIEW",
    "CEO_REVIEW",
  ];
  const selectedChildren = selected
    ? subtasks.filter((item) => item.parentTaskId === selected._id)
    : [];
  const allChildrenSubmitted =
    selectedChildren.length > 0 &&
    selectedChildren.every((item) => item.workflowStage === "SUBMITTED");
  const directHeadReview = Boolean(
    selected?.workflowStage === "HEAD_REVIEW" &&
      selectedChildren.length > 0 &&
      !selected.workflowHistory?.some((event) => event.action === "ROUTED_TO_MANAGER"),
  );
  const headDirectDelivery = Boolean(
    isHead &&
      selected?.workflowStage === "HEAD_PLANNING" &&
      candidates.some((candidate) => candidate.level === "MEMBER"),
  );
  const canCreateWorkItems = Boolean(
    (isManager && ["MANAGER_PLANNING", "DELEGATED"].includes(selected?.workflowStage ?? "") && candidates.length > 0) ||
      headDirectDelivery,
  );
  const canSubmitSeniorReport = Boolean(
    selected &&
      seniorCandidates.length > 0 &&
      ((isHead && selected.workflowStage === "HEAD_PLANNING") ||
        (isManager && selected.workflowStage === "MANAGER_PLANNING")),
  );
  const canReviewSelected = Boolean(
    selected?.workflowStage &&
    reviewStages.includes(selected.workflowStage) &&
    (isExecutive || personId(selected.currentOwner) === currentUser?.user_id) &&
    ((isManager && selected.workflowStage === "MANAGER_REVIEW") ||
      (isHead && selected.workflowStage === "HEAD_REVIEW") ||
      (isAdmin && selected.workflowStage === "ADMIN_FINAL_REVIEW") ||
      (isExecutive && selected.workflowStage === "CEO_REVIEW")),
  );
  const approveLabel =
    selected?.workflowStage === "MANAGER_REVIEW"
      ? "Accept and send to Department Head"
      : selected?.workflowStage === "HEAD_REVIEW"
        ? "Accept and send to Admin"
        : selected?.workflowStage === "ADMIN_FINAL_REVIEW"
          ? "Accept and send to CEO"
          : "Accept completed work";
  const ownsTask = (task: Task) =>
    isExecutive || personId(task.currentOwner) === currentUser?.user_id;
  const canActOnTask = (task: Task) =>
    (isAdmin && task.workflowStage === "ADMIN_REVIEW") ||
    (ownsTask(task) &&
      ((isHead &&
        ["HEAD_PLANNING", "HEAD_REVIEW"].includes(task.workflowStage ?? "")) ||
        (isManager &&
          ["MANAGER_PLANNING", "DELEGATED", "MANAGER_REVIEW"].includes(
            task.workflowStage ?? "",
          )) ||
        (isAdmin && task.workflowStage === "ADMIN_FINAL_REVIEW") ||
        (isExecutive && task.workflowStage === "CEO_REVIEW")));
  const myWorkItems: MyWorkItem[] = [...new Map([...tasks, ...subtasks].map((task) => [task._id, task])).values()]
    .filter((task) => task.status === "PENDING" && (
      personId(task.assignedTo) === currentUser?.user_id ||
      personId(task.currentOwner) === currentUser?.user_id
    ))
    .map((task) => {
      const approval = reviewStages.includes(task.workflowStage ?? "") && canActOnTask(task);
      return {
        id: task._id,
        title: task.title,
        description: task.description,
        kind: approval ? "APPROVAL" as const : "TASK" as const,
        priority: task.priority,
        dueAt: task.deadline,
        tags: [task.department ?? lockedDepartment ?? "Task", task.workflowStage?.replaceAll("_", " ") ?? "Assigned"],
        actionLabel: approval ? "Review" : "Take Action",
        onAction: () => { void openTask(task); },
      };
    });
  const reviewQueue = tasks.filter((task) =>
    reviewStages.includes(task.workflowStage ?? ""),
  ).length;
  const deliveryQueue = tasks.filter((task) =>
    ["DELEGATED", "ASSIGNED", "SUBMITTED"].includes(task.workflowStage ?? ""),
  ).length;
  const completedQueue = tasks.filter(
    (task) => task.workflowStage === "COMPLETED",
  ).length;
  const actionQueue = tasks.filter(canActOnTask).length;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      !normalizedQuery ||
      `${task.title} ${task.description} ${task.department ?? ""}`
        .toLowerCase()
        .includes(normalizedQuery);
    const matchesFilter =
      queueFilter === "ALL" ||
      (queueFilter === "ACTION" && canActOnTask(task)) ||
      (queueFilter === "DELIVERY" &&
        ["DELEGATED", "ASSIGNED", "SUBMITTED"].includes(
          task.workflowStage ?? "",
        )) ||
      (queueFilter === "REVIEW" &&
        reviewStages.includes(task.workflowStage ?? "")) ||
      (queueFilter === "COMPLETED" && task.workflowStage === "COMPLETED");
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4 [&_a]:cursor-pointer [&_button:not(:disabled)]:cursor-pointer [&_button:not(:disabled)]:transition-colors [&_button:disabled]:cursor-not-allowed [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-(--brand-red)">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-(--brand-text-muted)">
            {roleLabel} workspace
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-(--brand-navy)">
            {lockedDepartment
              ? `${lockedDepartment[0]}${lockedDepartment.slice(1).toLowerCase()} task operations`
              : "Task operations"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {isManager && !isExecutive ? <ManagerTeamMemberDialog /> : null}
          {isExecutive ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-(--brand-red) px-4 text-sm font-bold text-white transition hover:brightness-95"
            >
              <Plus size={17} />
              New brief
            </button>
          ) : null}
        </div>
      </header>

      {showMyWork && <MyWorkInbox items={myWorkItems} />}
      {(!roles.includes(USER_ROLES.HR) || canManageProducts) && <ProductDeliveryPanel executive={canManageProducts} department={lockedDepartment} revision={loadedAt} onDispatched={load} />}

      {message ? (
        <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
          <CircleAlert size={17} className="mt-0.5 shrink-0 text-blue-600" />
          <p className="flex-1">{message}</p>
          <button
            type="button"
            onClick={() => setMessage("")}
            aria-label="Dismiss message"
            className="rounded p-0.5 text-blue-500 hover:bg-blue-100"
          >
            <X size={15} />
          </button>
        </div>
      ) : null}

      <section aria-label="Task summary" className="grid grid-cols-2 overflow-hidden rounded-lg border border-(--brand-border) bg-white shadow-(--shadow-xs) lg:grid-cols-4">
        <QueueMetric
          label="Needs your action"
          value={actionQueue}
          icon={CircleAlert}
          tone="red"
          active={queueFilter === "ACTION"}
          onClick={() => setQueueFilter("ACTION")}
        />
        <QueueMetric
          label="In delivery"
          value={deliveryQueue}
          icon={Activity}
          tone="blue"
          active={queueFilter === "DELIVERY"}
          onClick={() => setQueueFilter("DELIVERY")}
        />
        <QueueMetric
          label="In review"
          value={reviewQueue}
          icon={Clock3}
          tone="amber"
          active={queueFilter === "REVIEW"}
          onClick={() => setQueueFilter("REVIEW")}
        />
        <QueueMetric
          label="Completed"
          value={completedQueue}
          icon={CheckCircle2}
          tone="green"
          active={queueFilter === "COMPLETED"}
          onClick={() => setQueueFilter("COMPLETED")}
        />
      </section>

      <section className="overflow-hidden rounded-lg border border-(--brand-border) bg-white px-4 pt-4 shadow-(--shadow-xs) sm:px-5 sm:pt-5">
        <button
          type="button"
          onClick={() => setShowInsights((current) => !current)}
          aria-expanded={showInsights}
          className="flex w-full items-center justify-between gap-4 rounded-md px-1 pb-4 text-left transition-colors hover:text-(--brand-red)"
        >
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-(--brand-navy)">
              <Activity size={16} className="text-[#2563eb]" />
              Delivery insights
            </p>
          </div>
          <span className="flex items-center gap-2 text-xs font-bold text-(--brand-text-secondary)">
            {showInsights ? "Hide" : "View insights"}
            <ChevronDown
              size={17}
              className={`transition ${showInsights ? "rotate-180" : ""}`}
            />
          </span>
        </button>
        {showInsights ? (
          <div className="space-y-5 border-t border-(--brand-border) py-4">
            <HierarchyProgressBoard department={lockedDepartment} />
            <HierarchyPerformanceBoard department={lockedDepartment} />
          </div>
        ) : null}
      </section>

      <section className="min-w-0 overflow-hidden rounded-lg border border-(--brand-border) bg-white shadow-(--shadow-xs)">
        <header className="border-b border-(--brand-border) bg-(--brand-surface) px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-(--brand-navy)">
                <Inbox size={17} className="text-(--brand-red)" />
                Work queue
              </h2>
              <p className="mt-1 text-xs text-(--brand-text-muted)">
                {filteredTasks.length} of {tasks.length} tasks shown
              </p>
            </div>
            <label className="flex h-10 min-w-56 flex-1 items-center gap-2 rounded-md border border-(--brand-border) bg-white px-3 transition-colors focus-within:border-(--brand-red) sm:max-w-xs">
              <Search
                size={15}
                className="shrink-0 text-(--brand-text-muted)"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-(--brand-navy) outline-none placeholder:text-(--brand-text-muted)"
                placeholder="Search tasks"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="text-(--brand-text-muted)"
                >
                  <X size={14} />
                </button>
              ) : null}
            </label>
          </div>
          <div className="mt-4 flex items-center gap-1 overflow-x-auto">
            <SlidersHorizontal
              size={15}
              className="mr-1 shrink-0 text-(--brand-text-muted)"
            />
            {(
              [
                ["ALL", "All tasks", tasks.length],
                ["ACTION", "My actions", actionQueue],
                ["DELIVERY", "Delivery", deliveryQueue],
                ["REVIEW", "Review", reviewQueue],
                ["COMPLETED", "Completed", completedQueue],
              ] as Array<[QueueFilter, string, number]>
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                onClick={() => setQueueFilter(value)}
                aria-pressed={queueFilter === value}
                className={`inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-medium transition ${queueFilter === value ? "border-(--brand-red) text-(--brand-red)" : "border-transparent text-(--brand-text-secondary) hover:border-(--brand-border-strong) hover:text-(--brand-navy)"}`}
              >
                {label}
                <span
                  className={`min-w-5 rounded px-1.5 py-0.5 text-center text-[10px] tabular-nums ${queueFilter === value ? "bg-(--brand-red-pale)" : "bg-(--brand-surface-active)"}`}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
        </header>
        {loading ? (
          <p className="py-16 text-center text-sm text-(--brand-text-muted)">
            Loading workflow...
          </p>
        ) : filteredTasks.length ? (
          <div className="divide-y divide-(--brand-border) border-b border-(--brand-border) bg-white">
            {filteredTasks.map((task) => {
              const children = subtasks.filter(
                (item) => item.parentTaskId === task._id,
              );
              const completed = children.filter(
                (item) => item.workflowStage === "COMPLETED",
              ).length;
              const ownsTask =
                isExecutive || personId(task.currentOwner) === currentUser?.user_id;
              const canPlan =
                (isAdmin && task.workflowStage === "ADMIN_REVIEW") ||
                (ownsTask &&
                  ((isHead && task.workflowStage === "HEAD_PLANNING") ||
                    (isManager &&
                      ["MANAGER_PLANNING", "DELEGATED"].includes(
                        task.workflowStage ?? "",
                      ))));
              const canReview = Boolean(
                ownsTask &&
                task.workflowStage &&
                reviewStages.includes(task.workflowStage) &&
                ((isManager && task.workflowStage === "MANAGER_REVIEW") ||
                  (isHead && task.workflowStage === "HEAD_REVIEW") ||
                  (isAdmin && task.workflowStage === "ADMIN_FINAL_REVIEW") ||
                  (isExecutive && task.workflowStage === "CEO_REVIEW")),
              );
              const actionable = canPlan || canReview;
              const overdue =
                task.workflowStage !== "COMPLETED" &&
                new Date(task.deadline).getTime() < loadedAt;
              return (
                <article
                  key={task._id}
                  className={`group grid gap-4 px-4 py-4 transition-colors hover:bg-[#fbfcfe] sm:px-5 lg:grid-cols-[minmax(0,1fr)_180px_150px] lg:items-center ${actionable ? "border-l-2 border-l-(--brand-red)" : "border-l-2 border-l-transparent"}`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-2 py-1 text-[10px] font-extrabold uppercase ${actionable ? "bg-red-50 text-(--brand-red)" : task.workflowStage === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}
                      >
                        {stageLabel[task.workflowStage ?? "ASSIGNED"]}
                      </span>
                      <span className="text-[11px] font-semibold text-(--brand-text-muted)">
                        {task.department ?? "Cross-functional"}
                      </span>
                      {actionable ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-(--brand-red)">
                          <CircleAlert size={11} /> Your action
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-2 wrap-break-word text-sm font-semibold text-(--brand-navy)">
                      {task.title}
                    </h3>
                    {task.productId && typeof task.productId !== "string" ? <p className="mt-1 wrap-break-word text-xs font-medium text-(--brand-red)">Product: {task.productId.title}{task.productId.deletedAt ? " (deleted)" : ""}</p> : null}
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-(--brand-text-secondary)">
                      {task.description}
                    </p>
                    {children.length ? (
                      <div className="mt-3 flex max-w-md items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--brand-surface)">
                          <div
                            className="h-full rounded-full bg-[#00a978] transition-all"
                            style={{
                              width: `${(completed / children.length) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="shrink-0 text-[10px] font-bold text-(--brand-text-muted)">
                          {completed}/{children.length} done
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-2 text-xs text-(--brand-text-secondary)">
                    <p className="flex items-center gap-2">
                      <Users size={14} className="text-(--brand-text-muted)" />
                      <span className="truncate font-semibold">
                        {personName(task.currentOwner) ?? "Admin queue"}
                      </span>
                    </p>
                    <p
                      className={`flex items-center gap-2 font-semibold ${overdue ? "text-red-600" : ""}`}
                    >
                      <CalendarDays
                        size={14}
                        className={
                          overdue ? "text-red-500" : "text-(--brand-text-muted)"
                        }
                      />
                      {overdue ? "Overdue · " : "Due · "}
                      {new Date(task.deadline).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    {task.workflowHistory?.length ? (
                      <p className="flex items-center gap-2 text-[10px] text-(--brand-text-muted)">
                        <History size={13} />
                        {task.workflowHistory.length} workflow events
                      </p>
                    ) : null}
                  </div>
                  {actionable ? (
                    <button
                      type="button"
                      onClick={() => void openTask(task)}
                      className="inline-flex h-10 items-center justify-center gap-2 self-center rounded-md bg-(--brand-red) px-4 text-xs font-bold text-white transition hover:brightness-95"
                    >
                      {canReview
                        ? "Review"
                        : task.workflowStage === "DELEGATED"
                          ? "Add work"
                          : "Continue"}{" "}
                      <ArrowRight size={16} />
                    </button>
                  ) : (
                    <span className="inline-flex h-10 items-center justify-center gap-2 self-center text-xs text-(--brand-text-muted)">
                      <LayoutList size={14} />
                      No action
                    </span>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="py-4">
            <DashboardEmptyState
              title={
                tasks.length ? "No matching tasks" : "Workflow queue is clear"
              }
              description={
                tasks.length
                  ? "Adjust the search or choose another queue filter."
                  : "Tasks relevant to your role will appear here."
              }
            />
          </div>
        )}
      </section>

      {createOpen ? (
        <Modal
          title="Create executive brief"
          subtitle="Admin receives the outcome, context, and deadline."
          onClose={() => setCreateOpen(false)}
        >
          <form onSubmit={createBrief} className="space-y-4">
            <Field label="Title">
              <input
                required
                value={brief.title}
                onChange={(event) =>
                  setBrief({ ...brief, title: event.target.value })
                }
                className={inputClass}
                placeholder="What needs to be delivered?"
              />
            </Field>
            <Field label="Description">
              <textarea
                required
                rows={5}
                value={brief.description}
                onChange={(event) =>
                  setBrief({ ...brief, description: event.target.value })
                }
                className={areaClass}
                placeholder="Business outcome and context"
              />
            </Field>
            <Field label="Deadline">
              <input
                required
                type="datetime-local"
                value={brief.deadline}
                onChange={(event) =>
                  setBrief({ ...brief, deadline: event.target.value })
                }
                className={inputClass}
              />
            </Field>
            <Field label="Priority">
              <select
                value={brief.priority}
                onChange={(event) =>
                  setBrief({ ...brief, priority: event.target.value as TaskPriorityValue })
                }
                className={inputClass}
              >
                {taskPriorityOptions.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Submit saving={saving}>Send to admin</Submit>
          </form>
        </Modal>
      ) : null}
      {selected && isAdmin && selected.workflowStage === "ADMIN_REVIEW" ? (
        <Modal
          title="Route to department"
          subtitle="Assign delivery responsibility"
          onClose={() => setSelected(null)}
        >
          <form onSubmit={routeToHead} className="space-y-4">
            {!lockedDepartment ? (
              <Field label="Department">
                <select
                  required
                  value={route.department}
                  onChange={(event) =>
                    setRoute({ ...route, department: event.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">Select department</option>
                  {departments.map((department) => (
                    <option key={department}>{department}</option>
                  ))}
                </select>
              </Field>
            ) : null}
            <Field label="Delivery assignee">
              <select required value={candidates.some((candidate) => candidate._id === headId && candidate.department === (lockedDepartment ?? route.department)) ? headId : ""} onChange={(event) => setHeadId(event.target.value)} className={inputClass}>
                <option value="">Select assignee</option>
                {candidates.filter((candidate) => candidate.level !== "CEO" && candidate.department === (lockedDepartment ?? route.department)).map((candidate) => <option key={candidate._id} value={candidate._id}>{candidate.name} ({candidate.level.toLowerCase()})</option>)}
              </select>
            </Field>
            <Field label="Routing note (optional)">
              <textarea
                rows={3}
                value={route.note}
                onChange={(event) =>
                  setRoute({ ...route, note: event.target.value })
                }
                className={areaClass}
              />
            </Field>
            <Submit saving={saving}>Assign Responsibility</Submit>
          </form>
        </Modal>
      ) : null}
      {selected && isHead && selected.workflowStage === "HEAD_PLANNING" && !headDirectDelivery && !canSubmitSeniorReport ? (
        <Modal
          title="Build the delivery plan"
          subtitle="Translate the brief into precise implementation guidance."
          onClose={() => setSelected(null)}
          wide
        >
          <form onSubmit={routeToManager} className="grid gap-4 md:grid-cols-2">
            <Field label="Project objective">
              <textarea
                required
                rows={5}
                value={details.projectObjective}
                onChange={(event) =>
                  setDetails({
                    ...details,
                    projectObjective: event.target.value,
                  })
                }
                className={areaClass}
              />
            </Field>
            <Field label="Recommended stack">
              <textarea
                rows={5}
                value={details.recommendedStack}
                onChange={(event) =>
                  setDetails({
                    ...details,
                    recommendedStack: event.target.value,
                  })
                }
                className={areaClass}
                placeholder="One item per line"
              />
            </Field>
            <Field label="Requirements">
              <textarea
                rows={6}
                value={details.requirements}
                onChange={(event) =>
                  setDetails({ ...details, requirements: event.target.value })
                }
                className={areaClass}
                placeholder="One item per line"
              />
            </Field>
            <Field label="Final deliverables">
              <textarea
                rows={6}
                value={details.finalDeliverables}
                onChange={(event) =>
                  setDetails({
                    ...details,
                    finalDeliverables: event.target.value,
                  })
                }
                className={areaClass}
                placeholder="One item per line"
              />
            </Field>
            <Field label="Learning resources">
              <textarea
                rows={3}
                value={details.learningResources}
                onChange={(event) =>
                  setDetails({
                    ...details,
                    learningResources: event.target.value,
                  })
                }
                className={areaClass}
                placeholder="One URL per line"
              />
            </Field>
            <Field label="Delivery manager">
              <select
                required
                value={details.managerId}
                onChange={(event) =>
                  setDetails({ ...details, managerId: event.target.value })
                }
                className={inputClass}
              >
                <option value="">Select direct-report manager</option>
                {candidates.map((candidate) => (
                  <option key={candidate._id} value={candidate._id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="md:col-span-2">
              <Submit saving={saving}>Hand off to manager</Submit>
            </div>
          </form>
        </Modal>
      ) : null}
      {selected && canCreateWorkItems ? (
        <Modal
          title={
            headDirectDelivery
              ? "Assign work to your team"
              : selected.workflowStage === "DELEGATED"
              ? "Add more work items"
              : "Break down the work"
          }
          subtitle={headDirectDelivery ? "No active Managers report to you, so assign work directly to your Members." : "Create focused pieces for interns and employees who report to you. Existing work remains unchanged."}
          onClose={() => setSelected(null)}
          wide
        >
          <form onSubmit={delegate} className="space-y-5">
            {workItems.map((item, index) => (
              <section
                key={index}
                className="rounded-lg border border-(--brand-border) bg-[#fbfcfe] p-4 sm:p-5"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-(--brand-navy) text-xs font-extrabold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-extrabold text-(--brand-navy)">
                        Work item
                      </p>
                      <p className="text-[10px] text-(--brand-text-muted)">
                        Define one clear, independently deliverable outcome.
                      </p>
                    </div>
                  </div>
                  {workItems.length > 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setWorkItems((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      aria-label="Remove work item"
                      className="rounded-md p-2 text-(--brand-text-muted) transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Task title">
                    <input
                      required
                      value={item.title}
                      onChange={(event) =>
                        setWorkItems((current) =>
                          current.map((value, itemIndex) =>
                            itemIndex === index
                              ? { ...value, title: event.target.value }
                              : value,
                          ),
                        )
                      }
                      className={inputClass}
                      placeholder="e.g. Build campaign performance report"
                    />
                  </Field>
                  <div>
                    <p className="text-sm font-bold text-(--brand-navy)">
                      Assign team members
                    </p>
                    <details className="relative mt-2 rounded-md border border-(--brand-border) bg-white">
                      <summary className="flex h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold text-(--brand-navy)">
                        <span className="truncate">
                          {item.assignedToIds.length
                            ? `${item.assignedToIds.length} team member${item.assignedToIds.length === 1 ? "" : "s"} selected`
                            : "Select interns or employees"}
                        </span>
                        <ChevronDown
                          size={15}
                          className="shrink-0 text-(--brand-text-muted)"
                        />
                      </summary>
                      <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-(--brand-border) bg-white p-2 shadow-xl">
                        {candidates.map((candidate) => (
                          <label
                            key={candidate._id}
                            className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2.5 text-xs transition hover:bg-(--brand-surface)"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 accent-(--brand-red)"
                              checked={item.assignedToIds.includes(
                                candidate._id,
                              )}
                              onChange={() =>
                                setWorkItems((current) =>
                                  current.map((value, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...value,
                                          assignedToIds:
                                            value.assignedToIds.includes(
                                              candidate._id,
                                            )
                                              ? value.assignedToIds.filter(
                                                  (userId) =>
                                                    userId !== candidate._id,
                                                )
                                              : [
                                                  ...value.assignedToIds,
                                                  candidate._id,
                                                ],
                                        }
                                      : value,
                                  ),
                                )
                              }
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-bold text-(--brand-navy)">
                                {candidate.name}
                              </span>
                              <span className="block truncate text-(--brand-text-muted)">
                                {candidate.roles?.includes(USER_ROLES.INTERN)
                                  ? "Intern"
                                  : "Employee"}
                                {candidate.email ? ` · ${candidate.email}` : ""}
                              </span>
                            </span>
                          </label>
                        ))}
                        {!candidates.length ? (
                          <p className="px-2 py-3 text-xs text-(--brand-text-muted)">
                            No active interns or employees report to this
                            Manager.
                          </p>
                        ) : null}
                      </div>
                    </details>
                  </div>
                  {item.assignedToIds.length ? (
                    <div className="flex flex-wrap gap-2 md:col-span-2">
                      {candidates
                        .filter((candidate) =>
                          item.assignedToIds.includes(candidate._id),
                        )
                        .map((candidate) => (
                          <span
                            key={candidate._id}
                            className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700"
                          >
                            {candidate.name}
                            <button
                              type="button"
                              aria-label={`Remove ${candidate.name}`}
                              onClick={() =>
                                setWorkItems((current) =>
                                  current.map((value, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...value,
                                          assignedToIds:
                                            value.assignedToIds.filter(
                                              (userId) =>
                                                userId !== candidate._id,
                                            ),
                                        }
                                      : value,
                                  ),
                                )
                              }
                              className="rounded hover:bg-blue-100"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                    </div>
                  ) : null}
                  <Field label="Scope and acceptance criteria">
                    <textarea
                      required
                      rows={4}
                      value={item.description}
                      onChange={(event) =>
                        setWorkItems((current) =>
                          current.map((value, itemIndex) =>
                            itemIndex === index
                              ? { ...value, description: event.target.value }
                              : value,
                          ),
                        )
                      }
                      className={areaClass}
                      placeholder="Describe what done looks like"
                    />
                  </Field>
                  <Field label="Deadline">
                    <input
                      required
                      type="datetime-local"
                      max={selected.deadline.slice(0, 16)}
                      value={item.deadline}
                      onChange={(event) =>
                        setWorkItems((current) =>
                          current.map((value, itemIndex) =>
                            itemIndex === index
                              ? { ...value, deadline: event.target.value }
                              : value,
                          ),
                        )
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Priority">
                    <select
                      value={item.priority}
                      onChange={(event) =>
                        setWorkItems((current) =>
                          current.map((value, itemIndex) =>
                            itemIndex === index
                              ? { ...value, priority: event.target.value as TaskPriorityValue }
                              : value,
                          ),
                        )
                      }
                      className={inputClass}
                    >
                      {taskPriorityOptions.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-[11px] font-semibold text-blue-800">
                  <Users size={14} className="shrink-0" />
                  {item.assignedToIds.length > 1
                    ? `One shared chat will be created for you and the ${item.assignedToIds.length} selected members.`
                    : "Select multiple people to automatically create a shared task chat."}
                </div>
              </section>
            ))}
            <button
              type="button"
              onClick={() =>
                setWorkItems((current) => [
                  ...current,
                  {
                    title: "",
                    description: "",
                    deadline: "",
                    assignedToIds: [],
                    priority: "P2",
                  },
                ])
              }
              className="inline-flex h-10 items-center gap-2 rounded-md border border-(--brand-border) bg-white px-3 text-sm font-bold text-(--brand-navy) transition hover:bg-(--brand-surface)"
            >
              <Plus size={16} />
              Add work item
            </button>
            <Submit saving={saving}>
              {selected.workflowStage === "DELEGATED"
                ? "Add to delivery"
                : "Delegate work package"}
            </Submit>
          </form>
        </Modal>
      ) : null}
      {selected && canSubmitSeniorReport ? (
        <Modal
          title="Send a task report"
          subtitle="There are no active direct reports at the next level. Forward your report to a senior reviewer."
          onClose={() => setSelected(null)}
        >
          <form onSubmit={submitWorkflowReport} className="space-y-4">
            <Field label="Senior reviewer">
              <select required value={reportRecipientId} onChange={(event) => setReportRecipientId(event.target.value)} className={inputClass}>
                <option value="">Select reviewer</option>
                {seniorCandidates.map((candidate) => <option key={candidate._id} value={candidate._id}>{candidate.name} ({candidate.level === "CEO" ? "CEO" : `${candidate.department} Head`})</option>)}
              </select>
            </Field>
            <Field label="Task report">
              <textarea required minLength={20} maxLength={4000} rows={7} value={workflowReport} onChange={(event) => setWorkflowReport(event.target.value)} className={areaClass} placeholder="Summarize progress, decisions, blockers, and the outcome." />
            </Field>
            <Submit saving={saving}>Send report</Submit>
          </form>
        </Modal>
      ) : null}
      {selected && canReviewSelected ? (
        <Modal
          title={stageLabel[selected.workflowStage ?? "ASSIGNED"]}
          subtitle="Review the completed work, forward it, or return it with a clear enhancement request."
          onClose={() => setSelected(null)}
          wide
        >
          <div className="space-y-5">
            {selected.submission ? (
              <section className="rounded-md border border-(--brand-border) bg-(--brand-surface) p-4">
                <h3 className="text-xs font-bold uppercase text-(--brand-text-muted)">Task report</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-(--brand-text-secondary)">{selected.submission.description}</p>
              </section>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              {selectedChildren.map((item) => (
                <article
                  key={item._id}
                  className="rounded-md border border-(--brand-border) bg-(--brand-surface) p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-(--brand-navy)">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-xs text-(--brand-text-secondary)">
                        {personName(item.assignedTo) ?? "Team member"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.workflowStage === "SUBMITTED" ? "bg-blue-50 text-blue-700" : item.workflowStage === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                    >
                      {item.workflowStage === "SUBMITTED"
                        ? "Awaiting review"
                        : item.workflowStage === "COMPLETED"
                          ? "CEO accepted"
                          : "Enhancement pending"}
                    </span>
                  </div>
                  {item.submission ? (
                    <div className="mt-3 border-t border-(--brand-border) pt-3">
                      <p className="text-xs leading-5 text-(--brand-text-secondary)">
                        {item.submission.description}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-[#1645a2]">
                        {item.submission.githubUrl ? (
                          <a
                            href={item.submission.githubUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            GitHub repository
                          </a>
                        ) : null}
                        {item.submission.liveUrl ? (
                          <a
                            href={item.submission.liveUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Live application
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {(selected.workflowStage === "MANAGER_REVIEW" || directHeadReview) &&
                  item.workflowStage === "SUBMITTED" ? (
                    <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-(--brand-text-secondary)">
                      <input
                        type="radio"
                        name="reviewSubtask"
                        value={item._id}
                        checked={reviewSubtaskId === item._id}
                        onChange={() => setReviewSubtaskId(item._id)}
                      />
                      Select for enhancement
                    </label>
                  ) : null}
                </article>
              ))}
            </div>
            <WorkflowTimeline events={selected.workflowHistory ?? []} />
            {selected.workflowStage === "MANAGER_REVIEW" &&
            !allChildrenSubmitted ? (
              <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
                Review submitted items now. Forwarding to the Department Head
                unlocks after every work item is submitted.
              </p>
            ) : null}
            <Field label="Review note">
              <textarea
                rows={4}
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                className={areaClass}
                placeholder="Add approval context or describe exactly what must be improved"
              />
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={
                  saving ||
                  ((selected.workflowStage === "MANAGER_REVIEW" || directHeadReview) &&
                    !reviewSubtaskId)
                }
                onClick={() => void review("ENHANCEMENT")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 text-sm font-bold text-amber-800 disabled:opacity-60"
              >
                <RotateCcw size={16} />
                Request enhancement
              </button>
              <button
                type="button"
                disabled={
                  saving ||
                  (selected.workflowStage === "MANAGER_REVIEW" &&
                    !allChildrenSubmitted)
                }
                onClick={() => void review("APPROVE")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-(--brand-red) px-4 text-sm font-bold text-white disabled:opacity-60"
              >
                <CheckCircle2 size={16} />
                {approveLabel}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function QueueMetric({
  label,
  value,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof Activity;
  tone: "red" | "blue" | "amber" | "green";
  active: boolean;
  onClick: () => void;
}) {
  const tones = {
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-emerald-50 text-emerald-600",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-w-0 border-b-2 px-4 py-5 text-left transition-colors sm:px-5 ${active ? "border-(--brand-red) bg-(--brand-red-subtle)" : "border-transparent hover:bg-white"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-(--brand-text-secondary)">
            {label}
          </p>
          <strong className="mt-2 block text-3xl font-semibold tabular-nums text-(--brand-navy)">
            {value}
          </strong>
        </div>
        <span className={`shrink-0 rounded-md p-1.5 ${tones[tone]}`}>
          <Icon size={17} />
        </span>
      </div>
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-bold text-(--brand-navy)">
      {label}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
function Submit({
  saving,
  children,
}: {
  saving: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      disabled={saving}
      type="submit"
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-(--brand-red) px-4 text-sm font-bold text-white disabled:opacity-60"
    >
      {saving ? "Saving..." : children}
      <CheckCircle2 size={16} />
    </button>
  );
}
function WorkflowTimeline({
  events,
}: {
  events: NonNullable<Task["workflowHistory"]>;
}) {
  return (
    <section className="rounded-md border border-(--brand-border) bg-white p-4">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase text-(--brand-text-muted)">
        <History size={14} />
        Workflow history
      </h3>
      <div className="mt-3 max-h-48 space-y-3 overflow-y-auto">
        {events
          .slice()
          .reverse()
          .map((event, index) => {
            const actor =
              typeof event.actorId === "string"
                ? "Team member"
                : event.actorId.name;
            const recipient = !event.recipientId
              ? null
              : typeof event.recipientId === "string"
                ? "next owner"
                : event.recipientId.name;
            return (
              <div
                key={`${event.createdAt}-${index}`}
                className="border-l-2 border-(--brand-border) pl-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-(--brand-navy)">
                    {event.action.replaceAll("_", " ").toLowerCase()}
                  </p>
                  <time className="text-[10px] text-(--brand-text-muted)">
                    {new Date(event.createdAt).toLocaleString()}
                  </time>
                </div>
                <p className="mt-1 text-[11px] text-(--brand-text-secondary)">
                  {actor}
                  {recipient ? ` → ${recipient}` : ""}
                </p>
                {event.note ? (
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    {event.note}
                  </p>
                ) : null}
              </div>
            );
          })}
      </div>
    </section>
  );
}
function Modal({
  title,
  subtitle,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0b1729]/55 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className={`mx-auto my-8 rounded-md bg-white shadow-2xl ${wide ? "max-w-4xl" : "max-w-xl"}`}
      >
        <div className="flex items-start justify-between border-b border-(--brand-border) p-6">
          <div>
            <div className="flex items-center gap-2 text-(--brand-red)">
              <Route size={18} />
              <span className="text-xs font-bold uppercase tracking-[0.12em]">
                Workflow action
              </span>
            </div>
            <h2 className="mt-2 text-xl font-bold text-(--brand-navy)">
              {title}
            </h2>
            <p className="mt-1 text-sm text-(--brand-text-secondary)">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-2 text-(--brand-text-muted) hover:bg-(--brand-surface)"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
