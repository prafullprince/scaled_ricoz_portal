"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAppSelector } from "@/redux/hooks";
import { ArrowLeft, BarChart3, CalendarDays, CheckCircle2, ClipboardPenLine, Eye, Globe2, LoaderCircle, PencilLine, Save, Trophy } from "lucide-react";
import { MarkdownContent } from "@/components/dashboard/MarkdownContent";
import {
  EngineeringDeliveryService,
  deliveryDepartmentLabel,
  type DeliveryDepartment,
  type DeliveryPackage,
  type DeliveryReportsPage,
  type DeliveryWorkItem,
} from "@/services/engineering-delivery.service";
import styles from "./EngineeringDeliveryReports.module.css";

const periods = ["WEEK", "MONTH", "YEAR"] as const;
type Period = typeof periods[number];

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function canReport(pkg: DeliveryPackage, item: DeliveryWorkItem, userId: string) {
  const hasChildren = pkg.workItems.some((child) => child.parentId === item.id);
  return pkg.phase === "DELIVERY"
    && item.assigneeId === userId
    && ["TODO", "IN_PROGRESS", "REWORK"].includes(item.status)
    && (item.kind === "MEMBER" || !hasChildren);
}

export function EngineeringDeliveryReports({ initialDepartment }: { initialDepartment?: string }) {
  const user = useAppSelector((state) => state.auth.user);
  const [department, setDepartment] = useState<DeliveryDepartment>(
    initialDepartment === "PRODUCT" || initialDepartment === "ENGINEERING" || initialDepartment === "IT"
      ? initialDepartment
      : user?.organization_department === "PRODUCT" || user?.organization_department === "IT" ? user.organization_department : "ENGINEERING",
  );
  const [period, setPeriod] = useState<Period>("MONTH");
  const [data, setData] = useState<DeliveryReportsPage | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, { progress: string; summary: string }>>({});
  const [previewing, setPreviewing] = useState<Record<string, boolean>>({});
  const loading = !data || data.access.department !== department || data.analytics.period !== period;

  useEffect(() => {
    const abort = new AbortController();
    void EngineeringDeliveryService.reports(department, period, abort.signal)
      .then((result) => {
        if (!abort.signal.aborted) {
          setData(result);
          setError("");
        }
      })
      .catch((caught: unknown) => {
        if (!abort.signal.aborted) setError(caught instanceof Error ? caught.message : "Unable to load delivery reports.");
      });
    return () => abort.abort();
  }, [department, period, retry]);

  const personNames = useMemo(
    () => new Map((data?.people ?? []).map((person) => [person.id, person.name])),
    [data?.people],
  );
  const myTasks = useMemo(() => data
    ? data.packages.flatMap((pkg) =>
      pkg.workItems.filter((item) => canReport(pkg, item, data.access.id)).map((item) => ({ pkg, item })),
    )
    : [], [data]);
  const recentReports = useMemo(() => (data?.packages ?? [])
    .flatMap((pkg) => pkg.progressReports.map((report) => ({
      pkg,
      report,
      item: pkg.workItems.find((workItem) => workItem.id === report.nodeId),
    })))
    .filter((entry) => entry.item)
    .sort((left, right) => Date.parse(right.report.updatedAt) - Date.parse(left.report.updatedAt))
    .slice(0, 12), [data]);
  const overallProgress = useMemo(() => {
    if (!data) return 0;
    const scoped = data.packages.map((pkg) => {
      if (data.access.level === "MANAGER") {
        return average(pkg.workItems.filter((item) => item.parentId === null && item.assigneeId === data.access.id).map((item) => item.progress));
      }
      if (data.access.level === "MEMBER") {
        return average(pkg.workItems.filter((item) => item.assigneeId === data.access.id).map((item) => item.progress));
      }
      return pkg.progress;
    });
    return average(scoped);
  }, [data]);
  const headProgress = useMemo(() => {
    if (!data || !data.access.canViewLeaderboard) return [];
    const grouped = new Map<string, number[]>();
    for (const pkg of data.packages) {
      if (pkg.headId)
        grouped.set(pkg.headId, [...(grouped.get(pkg.headId) ?? []), pkg.progress]);
    }
    return [...grouped].map(([headId, values]) => ({
      headId,
      name: personNames.get(headId) ?? "Department head",
      progress: average(values),
      projects: values.length,
    })).sort((left, right) => right.progress - left.progress);
  }, [data, personNames]);

  function draftKey(packageId: string, itemId: string) {
    return `${packageId}:${itemId}`;
  }

  async function submitProgress(event: FormEvent<HTMLFormElement>, pkg: DeliveryPackage, item: DeliveryWorkItem) {
    event.preventDefault();
    const key = draftKey(pkg._id, item.id);
    const draft = drafts[key];
    if (!draft) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await EngineeringDeliveryService.reportProgress(pkg._id, {
        revision: pkg.revision,
        nodeId: item.id,
        progress: Number(draft.progress),
        summary: draft.summary.trim(),
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setNotice("Your progress report is published and visible to everyone in this department.");
      setRetry((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Progress could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <div>
        <Link className={styles.back} href={`/dashboard/product-engineering-pipeline?department=${department}`}><ArrowLeft size={15} />Delivery board</Link>
        <p className={styles.eyebrow}>{deliveryDepartmentLabel(department)} department</p>
        <h1>Progress &amp; contributions</h1>
        <p className={styles.subheading}>Daily task updates, team roll-ups, and department delivery activity.</p>
      </div>
      <div className={styles.filters}>
        {data?.access.canSelectDepartment && <label>Department<select value={department} onChange={(event) => setDepartment(event.target.value as DeliveryDepartment)}><option value="PRODUCT">Product</option><option value="ENGINEERING">Engineering</option><option value="IT">IT / DevOps</option></select></label>}
        <label>Leaderboard period<select value={period} onChange={(event) => setPeriod(event.target.value as Period)}>{periods.map((value) => <option key={value} value={value}>{value[0] + value.slice(1).toLowerCase()}</option>)}</select></label>
      </div>
    </header>

    {error && <div className={styles.error} role="alert">{error}<button onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}
    {loading && !data ? <div className={styles.loading}><LoaderCircle className={styles.spin} size={20} />Loading project reports…</div> : data && <>
      <section className={styles.metrics} aria-label="Progress summary">
        <article className={styles.metric}><span>Department progress</span><strong>{overallProgress}%</strong><div className={styles.progress}><span style={{ width: `${overallProgress}%` }} /></div></article>
        <article className={styles.metric}><span>Active deliveries</span><strong>{data.packages.length}</strong><small>Shared with your department</small></article>
        <article className={styles.metric}><span>Reports this year</span><strong>{data.analytics.calendar.reduce((sum, day) => sum + day.updates, 0)}</strong><small>In the rolling 365-day view</small></article>
      </section>

      {notice && <div className={styles.success} role="status"><CheckCircle2 size={17} />{notice}</div>}

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <div><ClipboardPenLine size={19} /><div><h2>Report your task progress</h2><p>Only assigned task owners can post. Add a percentage and a short description of today’s work.</p></div></div>
          <span className={styles.visibility}><Globe2 size={14} />Department-wide</span>
        </div>
        {myTasks.length ? <div className={styles.reportTasks}>{myTasks.map(({ pkg, item }) => {
          const key = draftKey(pkg._id, item.id);
          const draft = drafts[key] ?? { progress: String(item.progress), summary: "" };
          return <article className={styles.reportTask} key={key}>
            <div className={styles.reportTaskHeader}>
              <div><span className={styles.taskPackage}>{pkg.title}</span><h3>{item.title}</h3><p>{item.kind === "MANAGER" ? "Your standalone manager task" : "Your assigned task"} · Due {new Date(item.deadline).toLocaleDateString()}</p></div>
              <strong className={styles.percentBadge}>{item.progress}%</strong>
            </div>
            <div className={styles.progress}><span style={{ width: `${item.progress}%` }} /></div>
            <form className={styles.reportForm} onSubmit={(event) => void submitProgress(event, pkg, item)}>
              <label className={styles.rangeLabel}><span>Progress completed <strong>{draft.progress}%</strong></span><input type="range" min="0" max="100" step="1" value={draft.progress} onChange={(event) => setDrafts((current) => ({ ...current, [key]: { ...draft, progress: event.target.value } }))} /></label>
              <div className={styles.descriptionLabel}>
                <div className={styles.descriptionTitle}><span>Update description</span><small>Markdown supported</small></div>
                <div className={styles.editorTabs} role="tablist" aria-label="Report description editor">
                  <button type="button" role="tab" aria-selected={!previewing[key]} onClick={() => setPreviewing((current) => ({ ...current, [key]: false }))}><PencilLine size={12} />Write</button>
                  <button type="button" role="tab" aria-selected={Boolean(previewing[key])} onClick={() => setPreviewing((current) => ({ ...current, [key]: true }))}><Eye size={12} />Preview</button>
                </div>
                {previewing[key]
                  ? <MarkdownContent className={styles.markdownPreview}>{draft.summary || "_Your formatted update will appear here._"}</MarkdownContent>
                  : <textarea aria-label="Update description" rows={3} minLength={2} maxLength={1000} required placeholder={"Summarize progress…\n\nUse **bold**, bullets, or links for clarity."} value={draft.summary} onChange={(event) => setDrafts((current) => ({ ...current, [key]: { ...draft, summary: event.target.value } }))} />}
                <small className={styles.characterCount}>{draft.summary.length}/1000 characters</small>
              </div>
              <button disabled={saving || draft.summary.trim().length < 2}><Save size={14} />{saving ? "Publishing…" : "Publish progress report"}</button>
            </form>
          </article>;
        })}</div> : <div className={styles.noTasks}><CheckCircle2 size={19} /><div><strong>No open tasks assigned to you</strong><p>Progress entries can only be submitted by the person assigned to each task.</p></div></div>}
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><Globe2 size={19} /><div><h2>Latest department reports</h2><p>Progress descriptions shared by task owners with everyone in this department.</p></div></div><span className={styles.visibility}>Everyone can view</span></div>
        {recentReports.length ? <div className={styles.activityFeed}>{recentReports.map(({ pkg, report, item }) => item && <article className={styles.activity} key={`${pkg._id}:${report.nodeId}:${report.actorId}:${report.reportDate}`}>
          <span className={styles.activityMark}><BarChart3 size={15} /></span>
          <div className={styles.activityBody}><div className={styles.activityMeta}><strong>{personNames.get(report.actorId) ?? "Team member"}</strong><span>{new Date(report.updatedAt).toLocaleString()}</span></div><p className={styles.activityTask}>{item.title} <span>in</span> {pkg.title}</p><MarkdownContent className={styles.activitySummary}>{report.summary}</MarkdownContent><div className={styles.activityProgress}><span>{report.progress}% complete</span><i><i style={{ width: `${report.progress}%` }} /></i></div></div>
        </article>)}</div> : <p className={styles.empty}>No progress reports have been shared yet. Once task owners post updates, they will appear here for everyone in the department.</p>}
      </section>

      {data.access.canViewLeaderboard && <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><Trophy size={18} /><div><h2>Department head progress</h2><p>Average delivery progress across each head’s assigned packages.</p></div></div></div>
        {headProgress.length ? <div className={styles.headGrid}>{headProgress.map((head) => <article className={styles.headCard} key={head.headId}><div><strong>{head.name}</strong><span>{head.projects} {head.projects === 1 ? "delivery" : "deliveries"}</span></div><strong>{head.progress}%</strong><div className={styles.progress}><span style={{ width: `${head.progress}%` }} /></div></article>)}</div> : <p className={styles.empty}>No assigned deliveries to summarize yet.</p>}
      </section>}

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><CalendarDays size={18} /><div><h2>Contribution calendar</h2><p>Daily progress updates and completed work over the last 365 days.</p></div></div></div>
        <div className={styles.calendarScroller}><div className={styles.calendar} aria-label="365-day contribution calendar">
          {data.analytics.calendar.map((day) => {
            const intensity = day.updates === 0 && day.completedTasks === 0 ? 0 : day.completedTasks > 0 ? 4 : day.progressGained >= 50 ? 4 : day.progressGained >= 25 ? 3 : day.progressGained > 0 ? 2 : 1;
            return <span key={day.date} className={styles.day} data-level={intensity} title={`${day.date}: ${day.updates} updates, ${day.progressGained}% progress gained, ${day.completedTasks} completed`} aria-label={`${day.date}, ${day.updates} updates, ${day.completedTasks} completed`} />;
          })}
        </div></div>
        <div className={styles.legend}><span>Less</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} data-level={level} />)}<span>More</span></div>
      </section>

      {data.access.canViewLeaderboard && <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><Trophy size={18} /><div><h2>{period[0] + period.slice(1).toLowerCase()} leaderboard</h2><p>Score combines progress gained and completed delivery tasks.</p></div></div></div>
        {data.analytics.leaderboard.length ? <div className={styles.tableWrap}><table><thead><tr><th>Rank</th><th>Contributor</th><th>Progress gained</th><th>Tasks completed</th><th>Score</th></tr></thead><tbody>{data.analytics.leaderboard.map((entry, index) => <tr key={entry.userId}><td>#{index + 1}</td><td><strong>{entry.name}</strong><small>{entry.level ? entry.level.toLowerCase() : "Contributor"}</small></td><td>{entry.progressGained}%</td><td>{entry.completedTasks}</td><td><strong>{entry.score}</strong></td></tr>)}</tbody></table></div> : <p className={styles.empty}>No contribution activity in this period.</p>}
      </section>}

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><BarChart3 size={18} /><div><h2>Delivery details</h2><p>See package roll-ups, assigned work, and the latest individual updates.</p></div></div></div>
        {data.packages.length ? <div className={styles.deliveryList}>{data.packages.map((pkg) => <details className={styles.delivery} key={pkg._id}>
          <summary><span><strong>{pkg.title}</strong><small>{pkg.workItems.length} tasks · due {new Date(pkg.deadline).toLocaleDateString()}</small></span><span className={styles.summaryProgress}>{pkg.progress}%<i className={styles.progress}><i style={{ width: `${pkg.progress}%` }} /></i></span></summary>
          <div className={styles.packageBody}>
            <MarkdownContent className={styles.packageDescription}>{pkg.description}</MarkdownContent>
            {pkg.workItems.map((item) => {
              const itemReports = pkg.progressReports.filter((report) => report.nodeId === item.id).sort((left, right) => right.reportDate.localeCompare(left.reportDate));
              return <article className={styles.task} key={item.id}>
                <div className={styles.taskHeading}><div><strong>{item.title}</strong><small>{personNames.get(item.assigneeId) ?? "Team member"} · {item.kind === "MANAGER" ? "Manager branch" : "Individual task"}</small></div><b>{item.progress}%</b></div>
                <div className={styles.progress}><span style={{ width: `${item.progress}%` }} /></div>
                {itemReports.length > 0 && <details className={styles.updates}><summary>{itemReports.length} progress {itemReports.length === 1 ? "update" : "updates"} · latest {itemReports[0]?.reportDate}</summary>{itemReports.map((report) => <div key={`${report.actorId}:${report.reportDate}`}><strong>{personNames.get(report.actorId) ?? "Team member"}</strong> · {report.reportDate} · {report.progress}%<MarkdownContent className={styles.markdownUpdate}>{report.summary}</MarkdownContent></div>)}</details>}
              </article>;
            })}
          </div>
        </details>)}</div> : <p className={styles.empty}>No connected deliveries were found for this department.</p>}
      </section>
    </>}
  </main>;
}
