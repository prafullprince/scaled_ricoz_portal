"use client";

import { useEffect, useEffectEvent, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Link from "next/link";
import axios from "axios";
import { ArrowRight, BarChart3, Check, CheckCheck, CheckCircle2, ChevronDown, Clock3, ExternalLink, GitBranch, GitPullRequest, GripVertical, LayoutGrid, LoaderCircle, Network, Plus, RefreshCw, Search, ShieldCheck, Users, X } from "lucide-react";
import { useAppSelector } from "@/redux/hooks";
import { useHydrated } from "@/lib/useHydrated";
import { MarkdownContent } from "@/components/dashboard/MarkdownContent";
import { useSelectedDepartment } from "../DepartmentRail";
import {
  EngineeringDeliveryService,
  deliveryDepartmentLabel,
  type DeliveryAccess, type DeliveryAction, type DeliveryBrief, type DeliveryDepartment,
  type DeliveryPackage, type DeliveryPerson, type DeliveryStatus, type DeliveryTransition,
} from "@/services/engineering-delivery.service";
import {
  DELIVERY_COLUMNS, actionForColumn, boardStage, cardActions, cardChildren, cardId, cardKey,
  cardOwner, cardTitle, isApproved, myDeliveryCards, personName,
  type DeliveryCard, type DeliveryCardKey,
} from "@/lib/tasks/delivery-board";
import styles from "./EngineeringDeliveryWorkspace.module.css";

const isDeliveryDepartment = (value: string | null | undefined): value is DeliveryDepartment =>
  value === "PRODUCT" || value === "ENGINEERING" || value === "IT";

function message(error: unknown) {
  if (axios.isAxiosError<{ message?: string; errors?: Array<{ message: string }> }>(error)) {
    const data = error.response?.data;
    return [data?.message, ...(data?.errors?.map((issue) => issue.message) ?? [])].filter(Boolean).join(" ") || "The server could not be reached. Please try again.";
  }
  return error instanceof Error ? error.message : "The delivery workflow could not be updated.";
}
const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const blankBrief = (): DeliveryBrief => ({ title: "", description: "", deadline: "", githubUrl: "", contributionInstructions: "" });
const textId = (card: DeliveryCardKey) => `${card.packageId}:${card.nodeId ?? "root"}`;

export function EngineeringDeliveryWorkspace() {
  const user = useAppSelector((state) => state.auth.user);
  const userDepartment = user?.organization_department;
  const selectedDepartment = useSelectedDepartment();
  const router = useRouter();
  const canSelect = Boolean(user?.roles.some((role) => role === "CEO" || role === "ADMIN") || (user?.roles.includes("HR") && user.permissions?.includes("TASK_ASSIGN")));
  const department: DeliveryDepartment = canSelect
    ? isDeliveryDepartment(selectedDepartment) ? selectedDepartment : "PRODUCT"
    : isDeliveryDepartment(userDepartment) ? userDepartment : "ENGINEERING";
  return <DeliveryBoard key={department} department={department} onDepartmentChange={(next) => router.replace(`/dashboard/product-engineering-pipeline?department=${next}`)} />;
}

function DeliveryBoard({ department, onDepartmentChange }: { department: DeliveryDepartment; onDepartmentChange: (department: DeliveryDepartment) => void }) {
  const [packages, setPackages] = useState<DeliveryPackage[]>([]);
  const [people, setPeople] = useState<DeliveryPerson[]>([]);
  const [access, setAccess] = useState<DeliveryAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [total, setTotal] = useState(0);
  const [observedAt, setObservedAt] = useState(0);
  const [loadedPages, setLoadedPages] = useState(1);
  const [view, setView] = useState<"BOARD" | "TREE">("BOARD");
  const [scope, setScope] = useState<"MINE" | "TEAM">("MINE");
  const [query, setQuery] = useState("");
  const [packageFilter, setPackageFilter] = useState("");
  const [selected, setSelected] = useState<DeliveryCardKey | null>(null);
  const [assigning, setAssigning] = useState<(DeliveryCardKey & { revision: number }) | null>(null);
  const [transition, setTransition] = useState<(DeliveryCardKey & { action: DeliveryAction; revision: number }) | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [dragged, setDragged] = useState<DeliveryCardKey | null>(null);
  const [over, setOver] = useState<DeliveryStatus | null>(null);
  const mutationLock = useRef(false);
  const fetchLock = useRef<number | null>(null);
  const generation = useRef(0);
  const active = useRef(true);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragX = useRef<number | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    active.current = true;
    const abort = new AbortController();
    async function refresh() {
      if (fetchLock.current !== null || mutationLock.current) return;
      const currentGeneration = ++generation.current;
      fetchLock.current = currentGeneration;
      setRefreshing(true);
      try {
        const results = await Promise.all(Array.from({ length: loadedPages }, (_, index) => EngineeringDeliveryService.list(department, index + 1, abort.signal)));
        if (abort.signal.aborted || generation.current !== currentGeneration) return;
        const first = results[0];
        setPackages([...new Map(results.flatMap((result) => result.packages).map((item) => [item._id, item])).values()]);
        setPeople([...new Map(results.flatMap((result) => result.people).map((person) => [person.id, person])).values()]);
        setAccess(first.access);
        setTotal(first.pagination.total);
        setObservedAt(Date.now());
        setLoadError("");
      } catch (caught) {
        if (!abort.signal.aborted) setLoadError(message(caught));
      } finally {
        if (fetchLock.current === currentGeneration) fetchLock.current = null;
        if (!abort.signal.aborted && generation.current === currentGeneration) {
          setRefreshing(false);
          setLoading(false);
        }
      }
    }
    void refresh();
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 5000);
    const onVisibility = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active.current = false;
      abort.abort();
      fetchLock.current = null;
      generation.current += 1;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [department, loadedPages, retry]);

  useEffect(() => {
    if (!dragged) return;
    let frame = 0;
    let lastTime = 0;
    const scroll = (time: number) => {
      const board = boardRef.current;
      const x = dragX.current;
      if (board && x !== null) {
        const bounds = board.getBoundingClientRect();
        const direction = x > bounds.right - 48 ? 1 : x < bounds.left + 48 ? -1 : 0;
        board.scrollLeft += direction * Math.min(time - lastTime, 32) * 0.5;
      }
      lastTime = time;
      frame = window.requestAnimationFrame(scroll);
    };
    frame = window.requestAnimationFrame(scroll);
    return () => { window.cancelAnimationFrame(frame); dragX.current = null; };
  }, [dragged]);

  const filteredPackages = useMemo(() => packages.filter((item) => !packageFilter || item._id === packageFilter), [packages, packageFilter]);
  const cards = useMemo(() => {
    if (!access) return [];
    const source: DeliveryCard[] = scope === "MINE" ? myDeliveryCards(filteredPackages, access) : filteredPackages.flatMap((delivery) => [{ delivery, node: null }, ...delivery.workItems.map((node) => ({ delivery, node }))]);
    const search = query.trim().toLowerCase();
    return source.filter((card) => !search || [cardTitle(card), card.node?.description ?? card.delivery.description, personName(people, cardOwner(card)), card.delivery.title].join(" ").toLowerCase().includes(search));
  }, [access, filteredPackages, scope, people, query]);
  function findCard(key: DeliveryCardKey | null): DeliveryCard | null {
    if (!key) return null;
    const delivery = packages.find((item) => item._id === key.packageId);
    if (!delivery) return null;
    const node = key.nodeId ? delivery.workItems.find((item) => item.id === key.nodeId) : null;
    return key.nodeId && !node ? null : { delivery, node: node ?? null };
  }
  const selectedCard = findCard(selected);
  const assignCard = findCard(assigning);
  const transitionCard = findCard(transition);

  async function mutate(operation: () => Promise<DeliveryPackage>, success: string) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    generation.current += 1;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await operation();
      if (!active.current) return;
      setPackages((current) => [updated, ...current.filter((item) => item._id !== updated._id)].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)));
      setNotice(success);
      setCreateOpen(false);
      setAssigning(null);
      setTransition(null);
      setRetry((value) => value + 1);
    } catch (caught) {
      if (active.current) {
        setError(message(caught));
        if (axios.isAxiosError(caught) && caught.response?.status === 409) setRetry((value) => value + 1);
      }
    } finally {
      mutationLock.current = false;
      if (active.current) { setBusy(false); setRefreshing(false); }
    }
  }

  function requestAction(card: DeliveryCard, action: DeliveryAction) {
    if (busy || !cardActions(card).includes(action)) return;
    if (action === "START") {
      void mutate(() => EngineeringDeliveryService.transition(card.delivery._id, { nodeId: card.node?.id ?? null, revision: card.delivery.revision, action }), "Work moved to In progress.");
    } else {
      setError("");
      setSelected(null);
      setTransition({ ...cardKey(card), action, revision: card.delivery.revision });
    }
  }
  function moveCard(key: DeliveryCardKey, target: DeliveryStatus) {
    const card = findCard(key);
    if (!card || !access || busy) return;
    const action = actionForColumn(card, target, access);
    if (action) requestAction(card, action);
    else if (boardStage(card, access) !== target) setError("That stage is not available for this task. Use its permitted actions; only CEO can mark the package completed.");
  }

  return <main className={styles.workspace}>
    <header className={styles.spaceHeader}>
      <div className={styles.spaceIdentity}>
        <span className={styles.spaceMark}><GitBranch size={17} /></span>
        <div><p className={styles.eyebrow}>Workspace</p><h1 className={styles.heading}>{deliveryDepartmentLabel(department)} delivery</h1></div>
      </div>
      <div className={styles.actions}>
        {access?.canSelectDepartment && <select aria-label="Department" value={department} onChange={(event) => onDepartmentChange(event.target.value as DeliveryDepartment)} className={styles.control} style={{ width: "auto" }}><option value="PRODUCT">Product</option><option value="ENGINEERING">Engineering</option><option value="IT">IT / DevOps</option></select>}
        <button className={styles.button} disabled={refreshing || busy} onClick={() => setRetry((value) => value + 1)}><RefreshCw size={14} className={refreshing ? styles.spinner : ""} />Refresh</button>
        {access?.canCreate && <button className={styles.primary} disabled={busy} onClick={() => { setError(""); setCreateOpen(true); }}><Plus size={15} />New delivery</button>}
      </div>
    </header>
    {error && <div className={styles.error} role="alert">{error} <button className={styles.quiet} onClick={() => setRetry((value) => value + 1)} disabled={busy}>Retry refresh</button></div>}
    {loadError && <div className={styles.error} role="alert">Board refresh failed: {loadError} <button className={styles.quiet} onClick={() => setRetry((value) => value + 1)} disabled={busy}>Retry refresh</button></div>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    <section className={styles.panel}>
      <nav className={styles.workspaceNav} aria-label="Delivery workspace views">
        <button aria-pressed={view === "BOARD"} onClick={() => setView("BOARD")}><LayoutGrid size={14} />Board</button>
        <button aria-pressed={view === "TREE"} onClick={() => setView("TREE")}><Network size={14} />Hierarchy</button>
      </nav>
      <div className={styles.boardToolbar}>
        <label className={styles.search}><Search size={15} /><input className={styles.control} aria-label="Search tasks" placeholder="Search tasks or assignees..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className={styles.actions}>
          <select aria-label="Board visibility" value={scope} onChange={(event) => setScope(event.target.value as "MINE" | "TEAM")} className={styles.control} style={{ width: "auto" }}><option value="MINE">My work & reviews</option><option value="TEAM">Department visibility</option></select>
          <select aria-label="Delivery package" value={packageFilter} onChange={(event) => setPackageFilter(event.target.value)} className={styles.control} style={{ width: "200px" }}><option value="">All loaded packages</option>{packages.map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}</select>
        </div>
      </div>
      <div className={styles.boardInfo}>
        <div className={styles.boardCounts} aria-label="Delivery summary">
          {[["Packages", packages.length], ["Your reviews", access ? myDeliveryCards(packages, access).filter((card) => boardStage(card, access) === "REVIEW" && cardActions(card).some((action) => action === "APPROVE" || action === "SUBMIT")).length : 0], ["Awaiting CEO", packages.filter((item) => item.phase === "CEO_REVIEW").length], ["Completed", packages.filter((item) => item.phase === "COMPLETED").length]].map(([title, value]) => <span className={styles.boardCount} key={title}><strong>{value}</strong>{title}</span>)}
        </div>
        <div className={styles.actions}>
          <span className={styles.dragGuide}>Drag enabled stages; backward moves require reviewer feedback.</span>
          <Link className={styles.link} href={`/dashboard/product-engineering-pipeline/reports?department=${department}`}>Progress reports<BarChart3 size={12} /></Link>
          {!access?.authorizedHr && department !== "IT" && <Link className={styles.link} href={`/dashboard/product-engineering-pipeline/technical?department=${department}`}>Technical pipeline<ExternalLink size={12} /></Link>}
          <details className={styles.workflowDetails}><summary>Review path</summary><div className={styles.flow} aria-label="Approval flow">
            {[{ text: "Intern / Employee", icon: Users }, { text: "Manager", icon: GitBranch }, { text: "Department Head", icon: Network }, { text: "Admin or authorized HR", icon: ShieldCheck }, { text: "CEO", icon: CheckCheck }].map(({ text, icon: Icon }, index) => <span key={text} className={styles.actions}>{index > 0 && <ArrowRight size={12} />}<span className={styles.flowStep}><Icon size={13} />{text}</span></span>)}
            <span className={styles.muted}>Direct head assignments skip manager review.</span>
          </div></details>
        </div>
      </div>
      {createOpen && access && (
        <CreateDelivery
          department={department}
          people={people}
          busy={busy}
          error={error}
          onClose={() => !busy && setCreateOpen(false)}
          onSubmit={(brief, assigneeId) =>
            void mutate(
              () =>
                EngineeringDeliveryService.create({
                  ...brief,
                  department,
                  assigneeId,
                }),
              "Delivery task created and assigned directly to the selected person.",
            )
          }
        />
      )}
      {assigning && assignCard && access && (
        <AssignWork
          card={assignCard}
          people={people}
          access={access}
          busy={busy}
          error={error}
          stale={assigning.revision !== assignCard.delivery.revision}
          onClose={() => !busy && setAssigning(null)}
          onSubmit={(items) =>
            void mutate(
              () =>
                EngineeringDeliveryService.delegate(assigning.packageId, {
                  parentId: assigning.nodeId,
                  revision: assigning.revision,
                  workItems: items,
                }),
              "Work assigned directly to the selected team members.",
            )
          }
        />
      )}
      {loading ? <div role="status" className={styles.loading}><LoaderCircle size={18} className={styles.spinner} />Loading delivery workspace...</div> : view === "TREE" ? <Hierarchy packages={filteredPackages.filter((item) => !query.trim() || [item.title, ...item.workItems.map((node) => node.title)].join(" ").toLowerCase().includes(query.trim().toLowerCase()))} people={people} onOpen={setSelected} /> : <div ref={boardRef} className={styles.board} aria-label="Task delivery pipeline" onDragOver={(event) => { dragX.current = event.clientX; }}>
        {DELIVERY_COLUMNS.map((column) => {
          const columnCards = cards.filter((card) => access && boardStage(card, access) === column.id);
          const draggedCard = findCard(dragged);
          const canDrop = Boolean(draggedCard && access && actionForColumn(draggedCard, column.id, access) && !busy);
          return <section key={column.id} className={styles.column} data-stage={column.id} data-over={over === column.id} aria-label={`${column.label} stage`}
            data-drop-target={canDrop}
            onDragOver={(event) => { if (canDrop) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setOver(column.id); } }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null); }}
            onDrop={(event) => { event.preventDefault(); if (dragged && canDrop) moveCard(dragged, column.id); setDragged(null); setOver(null); }}>
            <header className={styles.columnHeader}><div className={styles.row}><h3>{column.label}</h3><span className={styles.count}>{columnCards.length}</span></div><p className={styles.muted}>{column.hint}</p></header>
            <div className={styles.cards}>{columnCards.map((card) => <TaskCard key={cardId(card)} card={card} access={access!} people={people} observedAt={observedAt} busy={busy} onOpen={() => setSelected(cardKey(card))} onAction={(action) => requestAction(card, action)} onDrag={(key) => { setDragged(key); if (!key) setOver(null); }} />)}{!columnCards.length && <p className={styles.empty}>{column.id === "REVIEW" ? "Nothing awaiting your review" : "No tasks at this stage"}</p>}</div>
          </section>;
        })}
      </div>}
      {!loading && !packages.length && <div className={styles.loading}><p>No deliveries yet. A department head, Admin, authorized HR, or CEO can create the first package.</p></div>}
      {!loading && packages.length > 0 && cards.length === 0 && view === "BOARD" && <p className={styles.empty}>No matching work in this view. Switch to Department visibility or select another package.</p>}
      {loadedPages * 20 < total && <div className={styles.toolbar}><span className={styles.muted}>Showing {packages.length} of {total} packages</span><button className={styles.button} disabled={refreshing || busy} onClick={() => setLoadedPages((value) => value + 1)}><ChevronDown size={14} />Load more packages</button></div>}
    </section>
    {selectedCard && access && <TaskDetails card={selectedCard} access={access} people={people} busy={busy} error={error} onClose={() => setSelected(null)} onAction={(action) => requestAction(selectedCard, action)} onAssign={() => { setError(""); setAssigning({ ...cardKey(selectedCard), revision: selectedCard.delivery.revision }); setSelected(null); }} />}
    {transition && transitionCard && <TransitionDialog card={transitionCard} action={transition.action} busy={busy} error={error} stale={transition.revision !== transitionCard.delivery.revision} onClose={() => !busy && setTransition(null)} onSubmit={(fields) => void mutate(() => EngineeringDeliveryService.transition(transition.packageId, { ...fields, action: transition.action, nodeId: transition.nodeId, revision: transition.revision }), transition.action === "REQUEST_REWORK" ? "Changes requested and returned to the responsible delivery owner." : transitionCard.delivery.phase === "CEO_REVIEW" ? "CEO approved the delivery. All tasks are now completed." : "Submission forwarded to the next reviewer.")} />}
  </main>;
}

function TaskCard({ card, access, people, observedAt, busy, onOpen, onAction, onDrag }: { card: DeliveryCard; access: DeliveryAccess; people: DeliveryPerson[]; observedAt: number; busy: boolean; onOpen: () => void; onAction: (action: DeliveryAction) => void; onDrag: (key: DeliveryCardKey | null) => void }) {
  const actions = cardActions(card);
  const canDrag = actions.length > 0 && !busy;
  const children = cardChildren(card);
  const approved = children.filter(isApproved).length;
  const owner = personName(people, cardOwner(card));
  const deadline = card.node?.deadline ?? card.delivery.deadline;
  const overdue = Date.parse(deadline) < observedAt && card.delivery.phase !== "COMPLETED";
  const blockedHint = !canDrag && !card.node && access.level === "HEAD" && children.some((child) => !isApproved(child))
    ? "Forwarding unlocks after every assigned branch is approved."
    : !canDrag && card.node && access.level === "HEAD" && card.node.assigneeId !== access.id
      ? "The assigned owner must submit this work before head review."
      : "";
  return <article className={styles.card} draggable={canDrag} data-draggable={canDrag} title={canDrag ? "Drag this card to an allowed stage" : undefined} onDragStart={(event) => { event.dataTransfer.setData("text/plain", textId(cardKey(card))); event.dataTransfer.effectAllowed = "move"; onDrag(cardKey(card)); }} onDragEnd={() => onDrag(null)}>
    <div className={styles.cardTop}><span className={styles.tag}>{card.node ? card.node.kind === "HEAD" ? <Network size={11} /> : card.node.kind === "MANAGER" ? <GitBranch size={11} /> : <Users size={11} /> : <Network size={11} />}{card.node ? workItemKindLabel(card.node.kind) : "Department delivery"}</span><span className={canDrag ? styles.dragHandle : styles.dragLocked} aria-label={canDrag ? "Draggable task" : undefined} title={blockedHint || (canDrag ? "Drag to an allowed stage" : "No stage change is currently available")}><GripVertical size={14} /></span></div>
    <button className={styles.cardButton} onClick={onOpen}>{cardTitle(card)}</button>
    {card.node && <p className={styles.muted} style={{ marginTop: 4 }}>{card.delivery.title}</p>}
    {!card.node && <p className={styles.muted} style={{ marginTop: 5 }}>{card.delivery.phase === "ADMIN_REVIEW" ? "Awaiting Admin / HR review" : card.delivery.phase === "CEO_REVIEW" ? "Awaiting final CEO approval" : card.delivery.phase === "COMPLETED" ? "CEO-approved delivery" : "Department delivery & review"}</p>}
    <div style={{ marginTop: 10 }}><div className={styles.row}><span className={styles.muted}>Progress</span><strong className={styles.muted}>{card.node?.progress ?? card.delivery.progress}%</strong></div><div className={styles.progress}><span style={{ width: `${card.node?.progress ?? card.delivery.progress}%` }} /></div></div>
    {children.length > 0 && <div style={{ marginTop: 12 }}><div className={styles.row}><span className={styles.muted}>{approved}/{children.length} branches approved</span><CheckCircle2 size={12} /></div><div className={styles.progress}><span style={{ width: `${approved / children.length * 100}%` }} /></div></div>}
    {blockedHint && <p className={styles.dragHint}>{blockedHint}</p>}
    <div className={styles.cardFooter}><span className={styles.actions}><span className={styles.avatar}>{owner.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>{owner}</span><span style={overdue ? { color: "var(--status-danger)" } : undefined}><Clock3 size={11} className="inline mr-1" />{date(deadline)}</span></div>
    {actions.length > 0 && <select aria-label={`Move ${cardTitle(card)} to stage`} className={styles.control} style={{ marginTop: 10, fontSize: 11 }} disabled={busy} value="" onChange={(event) => { if (event.target.value) onAction(event.target.value as DeliveryAction); }}><option value="">{DELIVERY_COLUMNS.find((column) => column.id === boardStage(card, access))?.label} - move to...</option>{actions.map((action) => <option key={action} value={action}>{action === "START" ? "In progress" : action === "REQUEST_REWORK" ? "Changes requested" : action === "APPROVE" && card.delivery.phase === "CEO_REVIEW" ? "Complete delivery (CEO)" : "Submit to next reviewer"}</option>)}</select>}
  </article>;
}

function Hierarchy({ packages, people, onOpen }: { packages: DeliveryPackage[]; people: DeliveryPerson[]; onOpen: (key: DeliveryCardKey) => void }) {
  return <div className={styles.tree}>{packages.map((delivery) => <article key={delivery._id} className={styles.treePackage}>
    <div className={styles.row}><button className={styles.cardButton} onClick={() => onOpen({ packageId: delivery._id, nodeId: null })}>{delivery.title}</button><span className={styles.tag}>{label(delivery.phase === "DELIVERY" ? delivery.status : delivery.phase)}</span></div>
    <p className={styles.muted}>Head: {personName(people, delivery.headId)} · Deadline {date(delivery.deadline)} · {delivery.progress}% complete</p>
    {delivery.workItems.filter((node) => !node.parentId).map((node) => <div className={styles.treeBranch} key={node.id}><div className={styles.treeNode}><div className={styles.row}><button onClick={() => onOpen({ packageId: delivery._id, nodeId: node.id })}>{node.kind === "HEAD" ? <Network size={13} className="inline mr-1.5" /> : node.kind === "MANAGER" ? <GitBranch size={13} className="inline mr-1.5" /> : <Users size={13} className="inline mr-1.5" />}{node.title}</button><span className={styles.tag}>{label(node.status)} · {node.progress}%</span></div><p className={styles.muted}>{personName(people, node.assigneeId)} · {workItemKindLabel(node.kind)}</p></div>
      {delivery.workItems.filter((child) => child.parentId === node.id).map((child) => <div key={child.id} className={styles.treeBranch}><div className={styles.treeNode}><div className={styles.row}><button onClick={() => onOpen({ packageId: delivery._id, nodeId: child.id })}>{child.title}</button><span className={styles.tag}>{label(child.status)}</span></div><p className={styles.muted}>{personName(people, child.assigneeId)}</p></div></div>)}
    </div>)}
    {!delivery.workItems.length && <p className={styles.muted} style={{ marginTop: 10 }}>The head can split this delivery across managers or directly assign interns and employees.</p>}
  </article>)}{!packages.length && <p className={styles.empty}>No matching delivery packages.</p>}</div>;
}

function TaskDetails({ card, access, people, busy, error, onClose, onAction, onAssign }: { card: DeliveryCard; access: DeliveryAccess; people: DeliveryPerson[]; busy: boolean; error: string; onClose: () => void; onAction: (action: DeliveryAction) => void; onAssign: () => void }) {
  const task = card.node ?? card.delivery;
  const children = cardChildren(card);
  const actions = cardActions(card);
  const canDelegate = card.node?.canDelegate ?? card.delivery.canDelegate;
  const workflowNote = !card.node && card.delivery.phase === "DELIVERY" && children.some((child) => !isApproved(child))
    ? "The department head can submit this delivery after every manager and direct assignment is approved."
    : card.node && cardOwner(card) !== access.id && ["TODO", "IN_PROGRESS", "REWORK"].includes(card.node.status)
      ? "The assigned owner must submit this work before it enters your review queue."
      : card.node && cardOwner(card) === access.id && card.node.status === "IN_PROGRESS"
        ? "To move this work backward, ask its reviewer to request changes. Owners cannot bypass review."
        : "";
  const events = [...card.delivery.history].reverse().filter((event) => card.node ? event.nodeId === card.node.id || event.nodeId === null : true);
  return <Dialog title={cardTitle(card)} onClose={onClose} variant="task">
    <div className={styles.taskLayout}>
      <div className={styles.taskMain}>
        <div className={styles.taskType}>{card.node ? workItemKindLabel(card.node.kind) : "Department delivery"}<span aria-hidden="true">·</span>{card.delivery.title}</div>
        <section className={styles.taskSection}><h3>Description</h3><MarkdownContent className={`${styles.description} ${styles.markdown}`}>{task.description || "No description added yet."}</MarkdownContent></section>
        {task.contributionInstructions && <section className={styles.taskSection}><h3>Contribution instructions</h3><MarkdownContent className={`${styles.description} ${styles.markdown}`}>{task.contributionInstructions}</MarkdownContent></section>}
        {task.githubUrl && <section className={styles.taskSection}><h3>Linked work</h3><a href={task.githubUrl} target="_blank" rel="noreferrer" className={styles.link}><GitPullRequest size={13} />Contribution repository<ExternalLink size={12} /></a></section>}
        {task.submission && <section className={styles.taskSection}><h3>Delivery submission</h3><MarkdownContent className={`${styles.description} ${styles.markdown}`}>{task.submission.summary}</MarkdownContent><div className={styles.actions} style={{ marginTop: 10 }}>{task.submission.liveUrl && <a href={task.submission.liveUrl} target="_blank" rel="noreferrer" className={styles.link}>Live website<ExternalLink size={12} /></a>}{task.submission.githubUrl && <a href={task.submission.githubUrl} target="_blank" rel="noreferrer" className={styles.link}>Submitted source code<ExternalLink size={12} /></a>}</div></section>}
        {children.length > 0 && <section className={styles.taskSection}><h3>Delegated work <span className={styles.muted}>{children.filter(isApproved).length}/{children.length} approved</span></h3>{children.map((child) => <div className={styles.treeNode} key={child.id}><div className={styles.row}><strong style={{ fontSize: 12 }}>{child.title}</strong><span className={styles.tag}>{label(child.status)}</span></div><p className={styles.muted}>{personName(people, child.assigneeId)}</p>{child.submission && <><MarkdownContent className={`${styles.description} ${styles.markdown}`}>{child.submission.summary}</MarkdownContent><div className={styles.actions}>{child.submission.liveUrl && <a href={child.submission.liveUrl} target="_blank" rel="noreferrer" className={styles.link}>Live preview<ExternalLink size={11} /></a>}{child.submission.githubUrl && <a href={child.submission.githubUrl} target="_blank" rel="noreferrer" className={styles.link}>Source code<ExternalLink size={11} /></a>}</div></>}</div>)}</section>}
        {!actions.includes("SUBMIT") && card.delivery.phase === "DELIVERY" && children.some((child) => !isApproved(child)) && <p className={styles.muted} style={{ marginTop: 16 }}>Forwarding is locked until every assigned branch is submitted and approved. Reporting completion alone does not bypass review.</p>}
        {error && <p className={styles.error} role="alert" style={{ marginTop: 16 }}>{error}</p>}
        <section className={styles.taskSection}><h3>Activity</h3><p className={styles.activityLabel}>History</p><ol className={styles.history}>{events.map((event, index) => <li key={`${event.createdAt}-${index}`}><strong>{label(event.action)}</strong> · {personName(people, event.actorId)}<p>{new Date(event.createdAt).toLocaleString()}{event.note ? ` · ${event.note}` : ""}</p></li>)}</ol>{!events.length && <p className={styles.muted}>No activity recorded yet.</p>}</section>
      </div>
      <aside className={styles.taskSidebar} aria-label="Task details">
        <h3 className={styles.detailsTitle}>Details</h3>
        <dl className={styles.detailsList}>
          <div><dt>Status</dt><dd><span className={styles.tag}>{card.node ? label(card.node.status) : label(card.delivery.phase === "DELIVERY" ? card.delivery.status : card.delivery.phase)}</span></dd></div>
          <div><dt>Assignee</dt><dd><span className={styles.assignee}><span className={styles.avatar}>{personName(people, cardOwner(card)).split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>{personName(people, cardOwner(card))}</span></dd></div>
          <div><dt>Due date</dt><dd>{date(task.deadline)}</dd></div>
          <div><dt>Work type</dt><dd>{card.node ? workItemKindLabel(card.node.kind) : "Department delivery"}</dd></div>
          <div><dt>Department</dt><dd>{label(card.delivery.department)}</dd></div>
        </dl>
        {workflowNote && <p className={styles.workflowNote}><ShieldCheck size={14} />{workflowNote}</p>}
        {(actions.length > 0 || canDelegate) && <section className={styles.taskActions}>
          {canDelegate && <button className={styles.button} onClick={onAssign} disabled={busy}><Plus size={14} />{card.node ? "Assign team tasks" : "Assign manager / direct tasks"}</button>}
          {actions.map((action) => <button key={action} className={action === "REQUEST_REWORK" ? styles.button : styles.primary} disabled={busy} onClick={() => onAction(action)}>{action === "START" ? "Start work" : action === "REQUEST_REWORK" ? "Request changes" : action === "APPROVE" && card.delivery.phase === "CEO_REVIEW" ? "Approve & complete" : action === "APPROVE" ? "Approve & submit" : "Submit delivery"}<ArrowRight size={13} /></button>)}
        </section>}
      </aside>
    </div>
  </Dialog>;
}

function BriefFields({ brief, onChange, maxDeadline, descriptionError }: { brief: DeliveryBrief; onChange: (brief: DeliveryBrief) => void; maxDeadline?: string; descriptionError?: string }) {
  const field = (key: keyof DeliveryBrief, value: string) => onChange({ ...brief, [key]: value });
  return <>
    <label>Task title<input className={styles.control} required minLength={2} maxLength={160} value={brief.title} onChange={(event) => field("title", event.target.value)} placeholder="e.g. Frontend dashboard delivery" /></label>
    <MarkdownEditorField
      label="Description & acceptance criteria"
      value={brief.description}
      onChange={(value) => field("description", value)}
      placeholder="Describe the expected outcome and how it should be verified."
      required
      error={descriptionError}
    />
    <label>Deadline<input className={styles.control} type="datetime-local" required max={maxDeadline ? localDatetime(maxDeadline) : undefined} value={brief.deadline} onChange={(event) => field("deadline", event.target.value)} /></label>
    <div className={styles.grid}><label>GitHub repository (optional)<input className={styles.control} type="url" maxLength={500} value={brief.githubUrl} onChange={(event) => field("githubUrl", event.target.value)} placeholder="https://github.com/org/repo" /></label><MarkdownEditorField label="Contribution instructions (optional)" value={brief.contributionInstructions} onChange={(value) => field("contributionInstructions", value)} placeholder="Branch, setup, contribution and PR guidelines" /></div>
  </>;
}

function MarkdownEditorField({ label, value, onChange, placeholder, required = false, error }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean; error?: string }) {
  const [preview, setPreview] = useState(false);
  const id = useId();
  return <div className={styles.markdownField}>
    <div className={styles.markdownFieldHeader}><label htmlFor={id}>{label}</label><span>Markdown supported</span></div>
    <div className={styles.markdownToolbar} role="group" aria-label={`${label} editor view`}>
      <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>Write</button>
      <button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>Preview</button>
    </div>
    {preview
      ? <div className={`${styles.markdownPreview} ${styles.markdown}`}><MarkdownContent>{value || "_Nothing to preview yet._"}</MarkdownContent></div>
      : <textarea id={id} className={styles.textarea} required={required} minLength={required ? 2 : undefined} maxLength={4000} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />}
    {error && <p className={styles.error} role="alert">{error}</p>}
    <p className={styles.markdownHint}>Use **bold**, headings, bullet lists and links to make details easy to scan.</p>
  </div>;
}
function localDatetime(iso: string) {
  const value = new Date(iso);
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function apiBrief(brief: DeliveryBrief) { return { ...brief, deadline: new Date(brief.deadline).toISOString() }; }

type AssigneeTab = "DEPARTMENT" | "INTERN" | "EMPLOYEE" | "ALL";
const ASSIGNEE_TABS: Array<{ id: AssigneeTab; label: string }> = [
  { id: "DEPARTMENT", label: "Department" },
  { id: "INTERN", label: "Interns" },
  { id: "EMPLOYEE", label: "Employees" },
  { id: "ALL", label: "All" },
];
function assigneeLabel(person: DeliveryPerson) {
  if (person.level === "HEAD") return "Department head";
  if (person.level === "MANAGER") return "Department manager";
  return person.employmentType === "INTERN" ? "Intern" : "Employee";
}
function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
function workItemKindLabel(kind: "HEAD" | "MANAGER" | "MEMBER") {
  return kind === "HEAD"
    ? "Department head task"
    : kind === "MANAGER"
      ? "Manager branch"
      : "Individual task";
}

function AssigneePicker({ people, value, onChange, disabled }: { people: DeliveryPerson[]; value: string; onChange: (id: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<AssigneeTab>("ALL");
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = people.find((person) => person.id === value);
  const counts = {
    DEPARTMENT: people.filter((person) => person.active && person.level !== "MEMBER").length,
    INTERN: people.filter((person) => person.active && person.employmentType === "INTERN").length,
    EMPLOYEE: people.filter((person) => person.active && person.employmentType === "EMPLOYEE").length,
    ALL: people.filter((person) => person.active).length,
  };
  const options = people.filter((person) => {
    if (!person.active) return false;
    if (tab === "DEPARTMENT" && person.level === "MEMBER") return false;
    if (tab === "INTERN" && person.employmentType !== "INTERN") return false;
    if (tab === "EMPLOYEE" && person.employmentType !== "EMPLOYEE") return false;
    const normalized = search.trim().toLowerCase();
    return !normalized || `${person.name} ${assigneeLabel(person)}`.toLowerCase().includes(normalized);
  });
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  return (
    <div ref={rootRef} className={styles.assigneePicker}>
      <button
        type="button"
        className={styles.assigneeTrigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        {selected ? (
          <>
            <span className={styles.assigneeAvatar}>{initials(selected.name)}</span>
            <span className={styles.assigneeSelected}>
              <strong>{selected.name}</strong>
              <small>{assigneeLabel(selected)}</small>
            </span>
          </>
        ) : (
          <span className={styles.assigneePlaceholder}>Search and select a teammate</span>
        )}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open ? (
        <div className={styles.assigneeMenu}>
          <label className={styles.assigneeSearch}>
            <Search size={15} aria-hidden="true" />
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search people by name or role"
              aria-label="Search assignees"
            />
          </label>
          <div className={styles.assigneeTabs} role="tablist" aria-label="Team filters">
            {ASSIGNEE_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
              >
                {item.label}<span>{counts[item.id]}</span>
              </button>
            ))}
          </div>
          <div className={styles.assigneeOptions} role="listbox" aria-label="Available team members">
            {options.map((person) => (
              <button
                key={person.id}
                type="button"
                role="option"
                aria-selected={value === person.id}
                onClick={() => {
                  onChange(person.id);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <span className={styles.assigneeAvatar}>{initials(person.name)}</span>
                <span className={styles.assigneeSelected}>
                  <strong>{person.name}</strong>
                  <small>{assigneeLabel(person)}</small>
                </span>
                {value === person.id ? <Check size={16} /> : null}
              </button>
            ))}
            {!options.length ? <p className={styles.assigneeEmpty}>No matching active teammates.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CreateDelivery({ department, people, busy, error, onClose, onSubmit }: { department: DeliveryDepartment; people: DeliveryPerson[]; busy: boolean; error: string; onClose: () => void; onSubmit: (brief: DeliveryBrief, assigneeId: string) => void }) {
  const [brief, setBrief] = useState(blankBrief);
  const [assigneeId, setAssigneeId] = useState("");
  const [assigneeError, setAssigneeError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");
  return (
    <section className={styles.assignmentPanel} aria-labelledby="create-delivery-title">
      <header className={styles.assignmentHeader}>
        <div>
          <p className={styles.eyebrow}>Direct assignment</p>
          <h2 id="create-delivery-title">New {deliveryDepartmentLabel(department)} delivery</h2>
          <p className={styles.muted}>Assign the task straight to any active person in this department. A department head is not required.</p>
        </div>
        <button type="button" className={styles.quiet} aria-label="Close task form" disabled={busy} onClick={onClose}><X size={18} /></button>
      </header>
      <form className={styles.assignmentForm} onSubmit={(event) => {
        event.preventDefault();
        if (!assigneeId) {
          setAssigneeError("Select a teammate before creating the task.");
          return;
        }
        if (brief.description.trim().length < 2) {
          setDescriptionError("Add a description with at least 2 characters.");
          return;
        }
        setAssigneeError("");
        setDescriptionError("");
        onSubmit(apiBrief(brief), assigneeId);
      }}>
        <label>Assign to<AssigneePicker people={people} value={assigneeId} disabled={busy} onChange={(id) => { setAssigneeId(id); setAssigneeError(""); }} /></label>
        {assigneeError ? <p className={styles.error} role="alert">{assigneeError}</p> : null}
        {!people.some((person) => person.active) ? <p className={styles.error}>No active teammates are assigned to this department yet.</p> : null}
        <BriefFields brief={brief} descriptionError={descriptionError} onChange={(next) => {
          setBrief(next);
          if (next.description.trim().length >= 2) setDescriptionError("");
        }} />
        <FormFooter busy={busy} error={error} onClose={onClose} submitLabel="Create and assign task" disabled={!people.some((person) => person.active)} />
      </form>
    </section>
  );
}

function AssignWork({ card, people, access, busy, error, stale, onClose, onSubmit }: { card: DeliveryCard; people: DeliveryPerson[]; access: DeliveryAccess; busy: boolean; error: string; stale: boolean; onClose: () => void; onSubmit: (items: Array<DeliveryBrief & { assigneeId: string }>) => void }) {
  const [items, setItems] = useState<Array<DeliveryBrief & { assigneeId: string }>>([{ ...blankBrief(), assigneeId: "", githubUrl: card.node?.githubUrl ?? card.delivery.githubUrl, contributionInstructions: card.node?.contributionInstructions ?? card.delivery.contributionInstructions }]);
  const [descriptionErrors, setDescriptionErrors] = useState<Record<number, string>>({});
  const companyReviewer = access.ceo || access.admin || access.authorizedHr;
  const candidates = people.filter((person) => person.active && (
    !card.node && companyReviewer
      ? true
      : card.node
        ? person.level === "MEMBER" && person.reportsTo === access.id
        : person.level === "MEMBER" || (person.level === "MANAGER" && person.reportsTo === card.delivery.headId)
  ));
  const missingAssignee = items.some((item) => !item.assigneeId);
  return (
    <section className={styles.assignmentPanel} aria-labelledby="assign-work-title">
      <header className={styles.assignmentHeader}>
        <div>
          <p className={styles.eyebrow}>Team assignment</p>
          <h2 id="assign-work-title">{card.node ? "Assign work to a teammate" : "Assign department work"}</h2>
          <p className={styles.muted}>Search by name, then browse Department, Intern, Employee, or All.</p>
        </div>
        <button type="button" className={styles.quiet} aria-label="Close assignment form" disabled={busy} onClick={onClose}><X size={18} /></button>
      </header>
      <form className={styles.assignmentForm} onSubmit={(event) => {
        event.preventDefault();
        if (missingAssignee) return;
        const invalidDescriptions = items.reduce<Record<number, string>>((errors, item, index) => {
          if (item.description.trim().length < 2) errors[index] = "Add a description with at least 2 characters.";
          return errors;
        }, {});
        if (Object.keys(invalidDescriptions).length) {
          setDescriptionErrors(invalidDescriptions);
          return;
        }
        setDescriptionErrors({});
        onSubmit(items.map((item) => ({ ...apiBrief(item), assigneeId: item.assigneeId })));
      }}>
        {items.map((item, index) => <section key={index} className={index > 0 ? styles.assignmentItem : undefined}>
          <div className={styles.row}>
            <h3>Work item {index + 1}</h3>
            {items.length > 1 && <button type="button" className={styles.quiet} disabled={busy} onClick={() => setItems((current) => current.filter((_, itemIndex) => index !== itemIndex))}>Remove</button>}
          </div>
          <div className={styles.form}>
            <label>Assign to<AssigneePicker people={candidates} value={item.assigneeId} disabled={busy} onChange={(id) => setItems((current) => current.map((work, workIndex) => workIndex === index ? { ...work, assigneeId: id } : work))} /></label>
            <BriefFields brief={item} maxDeadline={card.node?.deadline ?? card.delivery.deadline} descriptionError={descriptionErrors[index]} onChange={(brief) => {
              setItems((current) => current.map((work, workIndex) => workIndex === index ? { ...brief, assigneeId: work.assigneeId } : work));
              if (brief.description.trim().length >= 2) setDescriptionErrors((current) => {
                const next = { ...current };
                delete next[index];
                return next;
              });
            }} />
          </div>
        </section>)}
        {!candidates.length && <p className={styles.error}>No eligible active teammates are available in this department.</p>}
        <button type="button" className={styles.button} disabled={items.length >= 30 || busy} onClick={() => setItems((current) => [...current, { ...blankBrief(), assigneeId: "", githubUrl: card.node?.githubUrl ?? card.delivery.githubUrl, contributionInstructions: card.node?.contributionInstructions ?? card.delivery.contributionInstructions }])}><Plus size={14} />Add another work item</button>
        {missingAssignee && items.some((item) => item.title.trim() || item.description.trim()) ? <p className={styles.error} role="alert">Choose an assignee for every work item.</p> : null}
        {stale && <p role="alert" className={styles.error}>This package has changed. Close and reopen the assignment form after reviewing the latest work.</p>}
        <FormFooter busy={busy} error={error} onClose={onClose} submitLabel="Assign work" disabled={!candidates.length || missingAssignee || stale} />
      </form>
    </section>
  );
}

function TransitionDialog({ card, action, busy, error, stale, onClose, onSubmit }: { card: DeliveryCard; action: DeliveryAction; busy: boolean; error: string; stale: boolean; onClose: () => void; onSubmit: (fields: Pick<DeliveryTransition, "summary" | "note" | "liveUrl" | "githubUrl">) => void }) {
  const [summary, setSummary] = useState("");
  const [note, setNote] = useState("");
  const [liveUrl, setLiveUrl] = useState(card.node?.submission?.liveUrl ?? card.delivery.submission?.liveUrl ?? "");
  const [githubUrl, setGithubUrl] = useState(card.node?.submission?.githubUrl ?? card.node?.githubUrl ?? card.delivery.githubUrl);
  const finalApproval = action === "APPROVE" && card.delivery.phase === "CEO_REVIEW";
  const title = action === "SUBMIT" ? "Submit delivery for review" : action === "REQUEST_REWORK" ? "Request changes" : finalApproval ? "CEO final approval" : "Approve & submit to next reviewer";
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ ...(action === "SUBMIT" ? { summary, liveUrl, githubUrl } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
  }
  return <Dialog title={title} onClose={onClose} busy={busy}><form className={styles.form} onSubmit={submit}>
    <p className={styles.muted}>{cardTitle(card)}</p>
    {action === "SUBMIT" ? <>
      <label>Delivery summary<textarea required minLength={20} maxLength={4000} className={styles.textarea} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Explain what was delivered, tested, and how to verify it." /></label>
      <label>Live website URL {card.node ? "(optional)" : "(required for department delivery)"}<input type="url" required={!card.node} maxLength={500} className={styles.control} value={liveUrl} onChange={(event) => setLiveUrl(event.target.value)} placeholder="https://your-live-website.com" /></label>
      <label>GitHub source code (optional)<input type="url" maxLength={500} className={styles.control} value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} placeholder="https://github.com/org/repo" /></label>
    </> : <><p className={styles.description}>{action === "REQUEST_REWORK" ? "The task returns to its responsible assignee. Senior-review rework goes back to the department head and must pass Admin/HR and CEO review again." : finalApproval ? "This completes the entire package and every manager and individual task. The completed state is shared with all department members." : card.node ? "Approve this contribution. Once all work in a manager branch is approved, that branch moves to the head's review queue automatically." : "Approve the department delivery and send it to CEO for final review."}</p>
      <label>{action === "REQUEST_REWORK" ? "Required changes" : "Review note (optional)"}<textarea required={action === "REQUEST_REWORK"} minLength={action === "REQUEST_REWORK" ? 2 : undefined} maxLength={500} className={styles.textarea} value={note} onChange={(event) => setNote(event.target.value)} /></label></>}
    {stale && <p role="alert" className={styles.error}>This package has changed. Close this dialog, review the latest tasks, and reopen the action.</p>}
    <FormFooter busy={busy} error={error} onClose={onClose} submitLabel={action === "REQUEST_REWORK" ? "Return for changes" : finalApproval ? "Approve & complete" : "Confirm submission"} disabled={stale} />
  </form></Dialog>;
}

function FormFooter({ busy, error, onClose, submitLabel, disabled }: { busy: boolean; error: string; onClose: () => void; submitLabel: string; disabled?: boolean }) {
  return <>{error && <p className={styles.error} role="alert">{error}</p>}<footer className={styles.dialogFooter}><button type="button" className={styles.button} disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className={styles.primary} disabled={busy || disabled}>{busy ? <LoaderCircle size={14} className={styles.spinner} /> : <ArrowRight size={14} />}{submitLabel}</button></footer></>;
}

function Dialog({ title, children, busy = false, onClose, variant = "default" }: { title: string; children: ReactNode; busy?: boolean; onClose: () => void; variant?: "default" | "task" }) {
  const ref = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();
  const close = useEffectEvent(onClose);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const element = ref.current;
    const controls = () => Array.from(element?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]') ?? []).filter((control) => control.getClientRects().length > 0);
    controls()[0]?.focus();
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) { event.preventDefault(); close(); }
      if (event.key === "Tab") {
        const items = controls();
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", keyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", keyDown); previousFocus?.focus(); };
  }, [busy]);
  if (!hydrated) return null;
  return createPortal(<div className={styles.overlay} onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onClose(); }}><div data-delivery-dialog ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`${styles.dialog} ${variant === "task" ? styles.taskDialog : ""}`}><header className={styles.dialogHeader}><div><p className={styles.eyebrow}>Department delivery</p><h2>{title}</h2></div><button className={styles.quiet} disabled={busy} onClick={onClose} aria-label="Close dialog"><X size={18} /></button></header><div className={`${styles.dialogBody} ${variant === "task" ? styles.taskDialogBody : ""}`}>{children}</div></div></div>, document.body);
}
