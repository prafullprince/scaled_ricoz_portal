"use client";

import { useEffect, useMemo, useState, type DragEvent, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Bug,
  ChevronDown,
  Clock3,
  Code2,
  FileText,
  GitPullRequest,
  Lightbulb,
  LoaderCircle,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useAppSelector } from "@/redux/hooks";
import { taskPriorityOptions, taskPriorityTier } from "@/lib/task-priority";
import { useSelectedDepartment } from "./DepartmentRail";
import {
  PRODUCT_ENGINEERING_STAGES,
  ProductEngineeringPipelineService,
  type CreateProductEngineeringPipelineItem,
  type ProductEngineeringDepartment,
  type ProductEngineeringEffort,
  type ProductEngineeringPipelineAccess,
  type ProductEngineeringPipelineItem,
  type ProductEngineeringStage,
  type ProductEngineeringPriority,
  type ProductEngineeringRating,
  type ProductEngineeringRequestType,
} from "@/services/product-engineering-pipeline.service";

const departmentOptions: Array<{ id: ProductEngineeringDepartment; label: string }> = [
  { id: "PRODUCT", label: "Product" },
  { id: "ENGINEERING", label: "Engineering" },
];
const requestTypes: Array<{ value: ProductEngineeringRequestType; label: string; icon: typeof Lightbulb }> = [
  { value: "IDEA", label: "Idea", icon: Lightbulb },
  { value: "BUG", label: "Bug", icon: Bug },
  { value: "REQUIREMENT", label: "Requirement", icon: FileText },
  { value: "REQUEST", label: "Request", icon: Sparkles },
];
const ratings: ProductEngineeringRating[] = ["LOW", "MEDIUM", "HIGH"];
const efforts: Array<{ value: ProductEngineeringEffort | ""; label: string }> = [
  { value: "", label: "Not estimated" },
  { value: "EXTRA_SMALL", label: "XS · under a day" },
  { value: "SMALL", label: "S · 1–2 days" },
  { value: "MEDIUM", label: "M · 3–5 days" },
  { value: "LARGE", label: "L · 1–2 weeks" },
  { value: "EXTRA_LARGE", label: "XL · over 2 weeks" },
];
const controlClass = "mt-1.5 h-10 w-full rounded-lg border border-(--brand-border) bg-(--input-background) px-3 text-sm text-(--brand-text) outline-none transition focus:border-(--brand-red) focus:ring-2 focus:ring-(--brand-red)/15";
const textAreaClass = "mt-1.5 min-h-24 w-full resize-y rounded-lg border border-(--brand-border) bg-(--input-background) px-3 py-2.5 text-sm text-(--brand-text) outline-none transition focus:border-(--brand-red) focus:ring-2 focus:ring-(--brand-red)/15";

const priorityStyle: Record<ProductEngineeringPriority, string> = {
  P1: "bg-(--status-danger-bg) text-(--status-danger)",
  P2: "bg-(--status-warning-bg) text-(--status-warning)",
  P3: "bg-(--status-info-bg) text-(--status-info)",
  LOW: "bg-(--brand-surface-hover) text-(--brand-text-secondary)",
  MEDIUM: "bg-(--status-info-bg) text-(--status-info)",
  HIGH: "bg-(--status-warning-bg) text-(--status-warning)",
  URGENT: "bg-(--status-danger-bg) text-(--status-danger)",
};

const requestIcon = {
  IDEA: Lightbulb,
  BUG: Bug,
  REQUIREMENT: FileText,
  REQUEST: Sparkles,
} satisfies Record<ProductEngineeringRequestType, typeof Lightbulb>;

function displayLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function personName(person: ProductEngineeringPipelineItem["createdBy"] | ProductEngineeringPipelineItem["stageHistory"][number]["actorId"]) {
  return person && typeof person !== "string" ? person.name : "Unknown";
}

function errorMessage(reason: unknown) {
  if (reason instanceof Error && reason.message) return reason.message;
  return "The Product & Engineering pipeline could not be updated.";
}

function mergeItems(current: ProductEngineeringPipelineItem[], incoming: ProductEngineeringPipelineItem[]) {
  const items = new Map(current.map((item) => [item._id, item]));
  incoming.forEach((item) => items.set(item._id, item));
  return [...items.values()].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export function ProductEngineeringPipelineWorkspace() {
  const user = useAppSelector((state) => state.auth.user);
  const requestedDepartment = useSelectedDepartment();
  const executive = Boolean(user?.roles.some((role) => role === "CEO" || role === "ADMIN"));
  const assignedDepartment = user?.organization_department === "PRODUCT" || user?.organization_department === "ENGINEERING"
    ? user.organization_department
    : null;
  const [departmentSelection, setDepartmentSelection] = useState<ProductEngineeringDepartment>(
    requestedDepartment === "ENGINEERING" ? "ENGINEERING" : "PRODUCT",
  );
  const department = executive ? departmentSelection : assignedDepartment ?? departmentSelection;
  const [items, setItems] = useState<ProductEngineeringPipelineItem[]>([]);
  const [access, setAccess] = useState<ProductEngineeringPipelineAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [creating, setCreating] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<ProductEngineeringPipelineItem | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [dragged, setDragged] = useState<ProductEngineeringPipelineItem | null>(null);

  useEffect(() => {
    let active = true;
    let refreshing = false;
    const controller = new AbortController();
    const loadFirstPage = async () => {
      try {
        const result = await ProductEngineeringPipelineService.list(executive ? department : undefined, 1, controller.signal);
        if (!active) return;
        setItems((current) => mergeItems(current, result.items));
        setAccess(result.access);
        setPage(1);
        setTotal(result.pagination.total);
        setError("");
      } catch (reason) {
        if (active && !controller.signal.aborted) setError(errorMessage(reason));
      } finally {
        if (active && !controller.signal.aborted) setLoading(false);
      }
    };
    const refresh = async () => {
      if (!active || refreshing || document.visibilityState === "hidden") return;
      refreshing = true;
      try {
        const result = await ProductEngineeringPipelineService.list(executive ? department : undefined, 1);
        if (!active) return;
        setItems((current) => mergeItems(current, result.items));
        setAccess(result.access);
        setTotal(result.pagination.total);
        setError("");
      } catch (reason) {
        if (active) setError(errorMessage(reason));
      } finally {
        refreshing = false;
      }
    };
    void loadFirstPage();
    const interval = window.setInterval(() => void refresh(), 5000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [department, executive]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => [
      item.title,
      item.description,
      item.requestType,
      item.priority,
      item.businessValue,
      ...item.acceptanceCriteria,
      ...item.dependencies,
    ].join(" ").toLowerCase().includes(query));
  }, [items, search]);

  const counts = useMemo(() => Object.fromEntries(
    PRODUCT_ENGINEERING_STAGES.map((stage) => [stage.key, items.filter((item) => item.stage === stage.key).length]),
  ) as Record<ProductEngineeringStage, number>, [items]);

  async function loadMore() {
    if (loadingMore || page * 100 >= total) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    setError("");
    try {
      const result = await ProductEngineeringPipelineService.list(executive ? department : undefined, nextPage);
      setItems((current) => mergeItems(current, result.items));
      setPage(nextPage);
      setTotal(result.pagination.total);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoadingMore(false);
    }
  }

  async function createItem(input: CreateProductEngineeringPipelineItem) {
    setCreating(true);
    setError("");
    try {
      const item = await ProductEngineeringPipelineService.create({
        ...input,
      });
      setItems((current) => mergeItems(current, [item]));
      setTotal((current) => current + 1);
      setCreateOpen(false);
      setNotice("Request added to Task Intake.");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setCreating(false);
    }
  }

  async function moveItem(item: ProductEngineeringPipelineItem, stage: ProductEngineeringStage) {
    if (!access?.canMoveStages || movingId || stage === item.stage) return;
    setMovingId(item._id);
    setError("");
    setNotice("");
    try {
      const updated = await ProductEngineeringPipelineService.move(item._id, stage);
      setItems((current) => mergeItems(current, [updated]));
      setSelected((current) => current?._id === updated._id ? updated : current);
      setNotice(`${item.title} moved to ${PRODUCT_ENGINEERING_STAGES.find((entry) => entry.key === stage)?.label ?? displayLabel(stage)}.`);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setMovingId(null);
    }
  }

  function dropOnStage(event: DragEvent<HTMLElement>, stage: ProductEngineeringStage) {
    event.preventDefault();
    if (dragged) void moveItem(dragged, stage);
    setDragged(null);
  }

  return (
    <main className="mx-auto w-full max-w-[1680px] space-y-5 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-(--brand-text-muted)">
            <span>Workspaces</span><span aria-hidden="true">/</span><span className="font-semibold text-(--brand-text-secondary)">Product &amp; Engineering</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-(--brand-red-pale) text-(--brand-red)"><GitPullRequest size={21}/></span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-(--brand-navy) sm:text-3xl">Product &amp; Engineering Pipeline</h1>
              <p className="mt-1 text-sm text-(--brand-text-secondary)">From new requests to verified production releases.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {access?.canSelectDepartment ? <label className="text-xs font-semibold text-(--brand-text-secondary)">
            <span className="sr-only">Pipeline department</span>
            <select value={department} onChange={(event) => { setLoading(true); setItems([]); setPage(1); setDepartmentSelection(event.target.value as ProductEngineeringDepartment); }} className="h-10 rounded-lg border border-(--brand-border) bg-(--input-background) px-3 text-sm text-(--brand-text)">
              {departmentOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label> : null}
          <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-(--brand-border) bg-(--brand-surface) px-3 text-xs font-medium text-(--brand-text-secondary)" title="Pipeline data refreshes automatically">
            <RefreshCw size={13}/>Live · 5 sec
          </span>
          {access?.canCreate ? <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-(--brand-red) px-4 text-sm font-semibold text-white transition hover:bg-(--brand-red-hover)">
            <Plus size={16}/>New request
          </button> : null}
        </div>
      </header>

      <section aria-label="Pipeline summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Open requests" value={items.filter((item) => item.stage !== "RELEASED_COMPLETED").length} icon={Activity}/>
        <SummaryCard label="In development" value={counts.IN_DEVELOPMENT} icon={Code2}/>
        <SummaryCard label="In review / QA" value={counts.CODE_REVIEW + counts.QA_TESTING} icon={ShieldCheck}/>
        <SummaryCard label="Ready to release" value={counts.READY_FOR_RELEASE} icon={Rocket}/>
        <SummaryCard label="Released" value={counts.RELEASED_COMPLETED} icon={BadgeCheck}/>
      </section>

      <section className="overflow-hidden rounded-xl border border-(--brand-border) bg-white shadow-(--shadow-sm)">
        <div className="flex flex-col gap-3 border-b border-(--brand-border) p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-(--brand-navy)">{department === "PRODUCT" ? "Product" : "Engineering"} delivery board</h2>
            <p className="mt-1 text-xs text-(--brand-text-muted)">{total} requests · {access?.canMoveStages ? "Drag a card or use its stage selector to move it" : "Read-only pipeline · stage movement is restricted to department heads and executives"}</p>
          </div>
          <label className="relative block w-full sm:w-72">
            <Search size={15} className="pointer-events-none absolute left-3 top-3 text-(--brand-text-muted)"/>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search requests" className="h-10 w-full rounded-lg border border-(--brand-border) bg-(--input-background) pl-9 pr-3 text-sm text-(--brand-text) outline-none focus:border-(--brand-red)"/>
          </label>
        </div>

        {error ? <p role="alert" className="border-b border-(--status-danger-border) bg-(--status-danger-bg) px-4 py-3 text-sm text-(--status-danger)">{error}</p> : null}
        {notice ? <p role="status" className="border-b border-(--status-success-border) bg-(--status-success-bg) px-4 py-2.5 text-xs font-medium text-(--status-success)">{notice}</p> : null}

        {loading ? (
          <div role="status" className="flex min-h-56 items-center justify-center gap-2 text-sm text-(--brand-text-secondary)"><LoaderCircle size={17} className="animate-spin"/>Loading pipeline…</div>
        ) : !items.length ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-(--brand-surface) text-(--brand-text-muted)"><GitPullRequest size={21}/></span>
            <h3 className="mt-3 text-sm font-semibold text-(--brand-navy)">No requests in this pipeline yet</h3>
            <p className="mt-1 max-w-md text-xs leading-5 text-(--brand-text-secondary)">Create an idea, bug, requirement, or request to start tracking Product and Engineering delivery.</p>
            {access?.canCreate ? <button type="button" onClick={() => setCreateOpen(true)} className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-(--brand-red) px-3 text-xs font-semibold text-white"><Plus size={14}/>Create request</button> : null}
          </div>
        ) : !visibleItems.length ? (
          <div className="p-12 text-center text-sm text-(--brand-text-secondary)">No requests match “{search}”.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="flex min-h-[520px] items-start gap-3 p-4">
                {PRODUCT_ENGINEERING_STAGES.map((stage, index) => {
                  const stageItems = visibleItems.filter((item) => item.stage === stage.key);
                  return (
                    <section
                      key={stage.key}
                      aria-label={`${stage.label} stage`}
                      onDragOver={(event) => { if (access?.canMoveStages) event.preventDefault(); }}
                      onDrop={(event) => dropOnStage(event, stage.key)}
                      className="flex max-h-[calc(100vh-320px)] min-h-[460px] w-[286px] shrink-0 flex-col rounded-lg border border-(--brand-border) bg-(--brand-surface)"
                    >
                      <header className="sticky top-0 z-10 rounded-t-lg border-b border-(--brand-border) bg-(--brand-surface) px-3 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={`size-2.5 shrink-0 rounded-full ${stageDotClass(index)}`}/>
                            <h3 className="truncate text-xs font-bold text-(--brand-navy)" title={stage.label}>{stage.label}</h3>
                          </div>
                          <span className="rounded-full bg-(--brand-surface-hover) px-2 py-0.5 text-[10px] font-bold text-(--brand-text-secondary)">{stageItems.length}</span>
                        </div>
                        <p className="mt-1.5 min-h-8 text-[10px] leading-4 text-(--brand-text-muted)">{stage.hint}</p>
                      </header>
                      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-2.5">
                        {stageItems.map((item) => (
                          <PipelineCard
                            key={item._id}
                            item={item}
                            canMove={Boolean(access?.canMoveStages)}
                            moving={movingId === item._id}
                            onOpen={() => setSelected(item)}
                            onMove={(nextStage) => void moveItem(item, nextStage)}
                            onDragStart={() => setDragged(item)}
                            onDragEnd={() => setDragged(null)}
                          />
                        ))}
                        {!stageItems.length ? <p className="rounded-lg border border-dashed border-(--brand-border-strong) px-3 py-7 text-center text-[10px] text-(--brand-text-muted)">No work at this stage</p> : null}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
            {page * 100 < total ? <div className="flex justify-center border-t border-(--brand-border) p-3">
              <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="inline-flex h-9 items-center gap-2 rounded-lg border border-(--brand-border) px-3 text-xs font-semibold text-(--brand-text-secondary) transition hover:bg-(--brand-surface-hover) disabled:opacity-50">
                {loadingMore ? <LoaderCircle size={14} className="animate-spin"/> : <ChevronDown size={14}/>}
                Load older requests
              </button>
            </div> : null}
          </>
        )}
      </section>

      {createOpen ? <CreatePipelineItemDialog department={department} executive={Boolean(access?.canSelectDepartment)} busy={creating} error={error} onClose={() => !creating && setCreateOpen(false)} onSubmit={createItem}/> : null}
      {selected ? <PipelineItemDialog item={selected} onClose={() => setSelected(null)}/> : null}
    </main>
  );
}

function stageDotClass(index: number) {
  if (index < 3) return "bg-(--status-info)";
  if (index < 5) return "bg-(--status-warning)";
  if (index < 8) return "bg-(--brand-red)";
  return "bg-(--status-success)";
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Activity }) {
  return (
    <article className="flex items-center justify-between rounded-xl border border-(--brand-border) bg-white px-4 py-3 shadow-(--shadow-sm)">
      <div><p className="text-[11px] font-semibold text-(--brand-text-secondary)">{label}</p><p className="mt-1 text-2xl font-bold text-(--brand-navy)">{value}</p></div>
      <span className="flex size-9 items-center justify-center rounded-lg bg-(--brand-surface) text-(--brand-red)"><Icon size={17}/></span>
    </article>
  );
}

function PipelineCard({ item, canMove, moving, onOpen, onMove, onDragStart, onDragEnd }: {
  item: ProductEngineeringPipelineItem;
  canMove: boolean;
  moving: boolean;
  onOpen: () => void;
  onMove: (stage: ProductEngineeringStage) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const RequestIcon = requestIcon[item.requestType];
  const currentStageIndex = PRODUCT_ENGINEERING_STAGES.findIndex((stage) => stage.key === item.stage);
  return (
    <article
      draggable={canMove && !moving}
      onDragStart={(event) => { event.dataTransfer.setData("text/plain", item._id); event.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      className={`group rounded-lg border border-(--brand-border) bg-white p-3 shadow-(--shadow-sm) transition hover:border-(--brand-border-strong) hover:shadow-(--shadow-md) ${canMove ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        <span className={`flex size-7 shrink-0 items-center justify-center rounded-md ${item.requestType === "BUG" ? "bg-(--status-danger-bg) text-(--status-danger)" : item.requestType === "IDEA" ? "bg-(--status-warning-bg) text-(--status-warning)" : "bg-(--status-info-bg) text-(--status-info)"}`}><RequestIcon size={14}/></span>
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <span className="block break-words text-xs font-semibold leading-5 text-(--brand-navy)">{item.title}</span>
          <span className="mt-1 line-clamp-2 block text-[10px] leading-4 text-(--brand-text-secondary)">{item.description}</span>
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold text-(--brand-text-secondary)">{displayLabel(item.requestType)}</span>
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${priorityStyle[item.priority]}`}>{taskPriorityTier(item.priority) ?? item.priority}</span>
        {item.effortEstimate ? <span className="rounded bg-(--brand-surface-hover) px-1.5 py-0.5 text-[9px] font-semibold text-(--brand-text-secondary)">{displayLabel(item.effortEstimate)}</span> : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-(--brand-border) pt-2.5">
        <span className="min-w-0 truncate text-[10px] text-(--brand-text-muted)" title={`Created by ${personName(item.createdBy)}`}>{personName(item.createdBy)}</span>
        <time className="shrink-0 text-[10px] text-(--brand-text-muted)" dateTime={item.updatedAt}>{new Date(item.updatedAt).toLocaleDateString()}</time>
      </div>
      {canMove ? <label className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-(--brand-text-muted)">
        <span className="sr-only">Move {item.title}</span>
        {moving ? <LoaderCircle size={12} className="animate-spin"/> : <ArrowRight size={12}/>}
        <select aria-label={`Move ${item.title} to a stage`} disabled={moving} value={item.stage} onChange={(event) => onMove(event.target.value as ProductEngineeringStage)} className="min-w-0 flex-1 rounded border border-(--brand-border) bg-(--input-background) px-1.5 py-1 text-[10px] text-(--brand-text)">
          {PRODUCT_ENGINEERING_STAGES.map((stage) => <option key={stage.key} value={stage.key}>{stage.label}</option>)}
        </select>
      </label> : null}
      <span className="sr-only">Stage {currentStageIndex + 1} of {PRODUCT_ENGINEERING_STAGES.length}</span>
    </article>
  );
}

function CreatePipelineItemDialog({ department, executive, busy, error, onClose, onSubmit }: {
  department: ProductEngineeringDepartment;
  executive: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (input: CreateProductEngineeringPipelineItem) => Promise<void>;
}) {
  const [targetDepartment, setTargetDepartment] = useState(department);
  const [requestType, setRequestType] = useState<ProductEngineeringRequestType>("IDEA");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<ProductEngineeringPriority>("P2");
  const [impact, setImpact] = useState<ProductEngineeringRating>("MEDIUM");
  const [urgency, setUrgency] = useState<ProductEngineeringRating>("MEDIUM");
  const [effortEstimate, setEffortEstimate] = useState<ProductEngineeringEffort | "">("");
  const [businessValue, setBusinessValue] = useState("");
  const [feasibilityNotes, setFeasibilityNotes] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [dependencies, setDependencies] = useState("");
  const [designUrl, setDesignUrl] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      ...(executive ? { department: targetDepartment } : {}),
      requestType,
      title: title.trim(),
      description: description.trim(),
      priority,
      impact,
      urgency,
      effortEstimate: effortEstimate || null,
      businessValue: businessValue.trim(),
      feasibilityNotes: feasibilityNotes.trim(),
      acceptanceCriteria: acceptanceCriteria.split("\n").map((value) => value.trim()).filter(Boolean),
      dependencies: dependencies.split("\n").map((value) => value.trim()).filter(Boolean),
      designUrl: designUrl.trim(),
    });
  }

  return (
    <DialogShell title="Create pipeline request" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {executive ? <label className="text-xs font-semibold text-(--brand-text-secondary)">Department
            <select value={targetDepartment} onChange={(event) => setTargetDepartment(event.target.value as ProductEngineeringDepartment)} className={controlClass}>{departmentOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
          </label> : <p className="rounded-lg bg-(--brand-surface) p-3 text-xs text-(--brand-text-secondary)">{department === "PRODUCT" ? "Product" : "Engineering"} department request</p>}
          <label className="text-xs font-semibold text-(--brand-text-secondary)">Request type
            <select value={requestType} onChange={(event) => setRequestType(event.target.value as ProductEngineeringRequestType)} className={controlClass}>{requestTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
          </label>
        </div>
        <label className="block text-xs font-semibold text-(--brand-text-secondary)">Title
          <input required minLength={2} maxLength={160} autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Summarize the request" className={controlClass}/>
        </label>
        <label className="block text-xs font-semibold text-(--brand-text-secondary)">Description
          <textarea required minLength={2} maxLength={4000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What should be built, fixed, or investigated?" className={textAreaClass}/>
        </label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold text-(--brand-text-secondary)">Priority
            <select value={priority} onChange={(event) => setPriority(event.target.value as ProductEngineeringPriority)} className={controlClass}>{taskPriorityOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select>
          </label>
          <label className="text-xs font-semibold text-(--brand-text-secondary)">Impact
            <select value={impact} onChange={(event) => setImpact(event.target.value as ProductEngineeringRating)} className={controlClass}>{ratings.map((value) => <option key={value} value={value}>{displayLabel(value)}</option>)}</select>
          </label>
          <label className="text-xs font-semibold text-(--brand-text-secondary)">Urgency
            <select value={urgency} onChange={(event) => setUrgency(event.target.value as ProductEngineeringRating)} className={controlClass}>{ratings.map((value) => <option key={value} value={value}>{displayLabel(value)}</option>)}</select>
          </label>
          <label className="text-xs font-semibold text-(--brand-text-secondary)">Effort
            <select value={effortEstimate} onChange={(event) => setEffortEstimate(event.target.value as ProductEngineeringEffort | "")} className={controlClass}>{efforts.map((value) => <option key={value.value} value={value.value}>{value.label}</option>)}</select>
          </label>
        </div>
        <details className="rounded-lg border border-(--brand-border) bg-(--brand-surface) p-3">
          <summary className="cursor-pointer text-xs font-semibold text-(--brand-text-secondary)">Analysis and readiness details <span className="font-normal text-(--brand-text-muted)">(optional)</span></summary>
          <div className="mt-3 space-y-3">
            <label className="block text-xs font-semibold text-(--brand-text-secondary)">Business value
              <textarea value={businessValue} onChange={(event) => setBusinessValue(event.target.value)} maxLength={1200} rows={2} className={textAreaClass}/>
            </label>
            <label className="block text-xs font-semibold text-(--brand-text-secondary)">Feasibility notes
              <textarea value={feasibilityNotes} onChange={(event) => setFeasibilityNotes(event.target.value)} maxLength={2000} rows={2} className={textAreaClass}/>
            </label>
            <label className="block text-xs font-semibold text-(--brand-text-secondary)">Acceptance criteria <span className="font-normal text-(--brand-text-muted)">· one per line</span>
              <textarea value={acceptanceCriteria} onChange={(event) => setAcceptanceCriteria(event.target.value)} maxLength={4000} rows={3} className={textAreaClass}/>
            </label>
            <label className="block text-xs font-semibold text-(--brand-text-secondary)">Dependencies <span className="font-normal text-(--brand-text-muted)">· one per line</span>
              <textarea value={dependencies} onChange={(event) => setDependencies(event.target.value)} maxLength={4000} rows={2} className={textAreaClass}/>
            </label>
            <label className="block text-xs font-semibold text-(--brand-text-secondary)">Design or specification URL
              <input type="url" value={designUrl} onChange={(event) => setDesignUrl(event.target.value)} placeholder="https://" className={controlClass}/>
            </label>
          </div>
        </details>
        {error ? <p role="alert" className="rounded-lg bg-(--status-danger-bg) px-3 py-2 text-xs text-(--status-danger)">{error}</p> : null}
        <div className="flex justify-end gap-2 border-t border-(--brand-border) pt-3">
          <button type="button" onClick={onClose} disabled={busy} className="h-10 rounded-lg border border-(--brand-border) px-4 text-xs font-semibold text-(--brand-text-secondary) hover:bg-(--brand-surface-hover)">Cancel</button>
          <button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg bg-(--brand-red) px-4 text-xs font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle size={14} className="animate-spin"/> : <Plus size={14}/>}Add to intake</button>
        </div>
      </form>
    </DialogShell>
  );
}

function PipelineItemDialog({ item, onClose }: { item: ProductEngineeringPipelineItem; onClose: () => void }) {
  const stage = PRODUCT_ENGINEERING_STAGES.find((entry) => entry.key === item.stage);
  return (
    <DialogShell title={item.title} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-(--brand-surface) px-2 py-1 text-[10px] font-bold text-(--brand-text-secondary)">{displayLabel(item.requestType)}</span>
          <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${priorityStyle[item.priority]}`}>{taskPriorityTier(item.priority) ?? item.priority} priority</span>
          <span className="rounded-md bg-(--status-info-bg) px-2 py-1 text-[10px] font-bold text-(--status-info)">{stage?.label}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-6 text-(--brand-text-secondary)">{item.description}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Detail label="Impact" value={displayLabel(item.impact)}/>
          <Detail label="Urgency" value={displayLabel(item.urgency)}/>
          <Detail label="Effort" value={item.effortEstimate ? displayLabel(item.effortEstimate) : "Not estimated"}/>
        </div>
        {item.businessValue ? <Detail label="Business value" value={item.businessValue}/> : null}
        {item.feasibilityNotes ? <Detail label="Feasibility" value={item.feasibilityNotes}/> : null}
        {item.acceptanceCriteria.length ? <div><h3 className="text-xs font-bold text-(--brand-navy)">Acceptance criteria</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-(--brand-text-secondary)">{item.acceptanceCriteria.map((criterion, index) => <li key={`${criterion}-${index}`}>{criterion}</li>)}</ul></div> : null}
        {item.dependencies.length ? <div><h3 className="text-xs font-bold text-(--brand-navy)">Dependencies</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-(--brand-text-secondary)">{item.dependencies.map((dependency, index) => <li key={`${dependency}-${index}`}>{dependency}</li>)}</ul></div> : null}
        {item.designUrl ? <a href={item.designUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-(--brand-red) hover:underline">Open design or specification<ArrowRight size={13}/></a> : null}
        <section className="border-t border-(--brand-border) pt-4">
          <h3 className="flex items-center gap-2 text-xs font-bold text-(--brand-navy)"><Clock3 size={14}/>Stage history</h3>
          <ol className="mt-3 space-y-3">
            <li className="flex gap-3 text-xs"><span className="mt-1 size-2 shrink-0 rounded-full bg-(--status-info)"/><div><p className="font-semibold text-(--brand-text)">{displayLabel(item.stage)} · current</p><p className="mt-0.5 text-(--brand-text-muted)">Updated {new Date(item.updatedAt).toLocaleString()}</p></div></li>
            {[...item.stageHistory].reverse().map((event, index) => (
              <li key={`${event.createdAt}-${index}`} className="flex gap-3 text-xs">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-(--brand-border-strong)"/>
                <div><p className="font-semibold text-(--brand-text-secondary)">{event.fromStage ? displayLabel(event.fromStage) : "Created"} → {displayLabel(event.toStage)}</p><p className="mt-0.5 text-(--brand-text-muted)">{personName(event.actorId)} · {new Date(event.createdAt).toLocaleString()}</p>{event.note ? <p className="mt-1 text-(--brand-text-secondary)">{event.note}</p> : null}</div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </DialogShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-(--brand-surface) p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-(--brand-text-muted)">{label}</p><p className="mt-1 whitespace-pre-wrap text-xs text-(--brand-text)">{value}</p></div>;
}

function DialogShell({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={title} className={`max-h-[92dvh] w-full ${wide ? "max-w-2xl" : "max-w-xl"} overflow-y-auto rounded-2xl border border-(--brand-border) bg-white p-5 shadow-(--shadow-xl) sm:p-6`}>
        <header className="mb-4 flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--brand-red)">Product &amp; Engineering</p><h2 className="mt-1 text-lg font-bold text-(--brand-navy)">{title}</h2></div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="flex size-8 shrink-0 items-center justify-center rounded-lg text-(--brand-text-muted) hover:bg-(--brand-surface-hover)"><X size={17}/></button>
        </header>
        {children}
      </section>
    </div>
  );
}
