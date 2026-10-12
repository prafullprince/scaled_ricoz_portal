"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  CircleDollarSign,
  Megaphone,
  Plus,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { AssistantView } from "../AssistantView";
import { DailyTaskWorkspace } from "../DailyTaskWorkspace";
import { DashboardError, DashboardSkeleton } from "../DashboardPrimitives";
import { TaskWorkflowWorkspace } from "../TaskWorkflowWorkspace";
import { MarketingBlogs } from "./MarketingBlogs";
import { MarketingService } from "@/services/marketing.service";
import type {
  CreateMarketingCampaignInput,
  MarketingCampaign,
  MarketingCampaignCategory,
  MarketingChannel,
  MarketingContent,
  MarketingDashboard,
  MarketingSalesOwner,
} from "@/types/marketing";
import { MyWorkInbox, type MyWorkItem } from "../MyWorkInbox";
import { useAppSelector } from "@/redux/hooks";
import { MarketingContentPlanner, MarketingLeadHandoff } from "./MarketingGrowthWorkspaces";
import { MarketingSocialWorkspace } from "./MarketingSocialWorkspace";

export type MarketingView =
  | "dashboard"
  | "work"
  | "calendar"
  | "approvals"
  | "requests"
  | "module"
  | "campaigns"
  | "content"
  | "leads"
  | "social"
  | "creative"
  | "publishing"
  | "budget"
  | "attribution"
  | "analytics"
  | "reports"
  | "assistant";
const titles: Record<MarketingView, string> = {
  dashboard: "Marketing Dashboard",
  work: "My Work",
  calendar: "Calendar",
  approvals: "Approvals Queue",
  requests: "Department Requests",
  module: "Marketing",
  campaigns: "Campaigns",
  content: "Content Calendar",
  leads: "Lead Generation & Sales Handoff",
  social: "Social Hub",
  creative: "Creative Studio",
  publishing: "Publishing",
  budget: "Budget",
  attribution: "Lead Attribution",
  analytics: "Analytics & Reports",
  reports: "Marketing Reports",
  assistant: "AI Assistant",
};
const moduleTabs: Array<{ view: MarketingView; label: string }> = [
  { view: "module", label: "Dashboard" },
  { view: "campaigns", label: "Campaigns" },
  { view: "content", label: "Content Calendar" },
  { view: "leads", label: "Lead Generation" },
  { view: "social", label: "Social Hub" },
  { view: "creative", label: "Creative Studio" },
  { view: "publishing", label: "Publishing" },
  { view: "budget", label: "Budget" },
  { view: "calendar", label: "Calendar" },
  { view: "attribution", label: "Attribution" },
  { view: "analytics", label: "Analytics" },
];
const currency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value / 100);
const campaignCategories: Array<{ value: MarketingCampaignCategory; label: string }> = [
  { value: "STRATEGY_PLANNING", label: "Marketing strategy & planning" },
  { value: "PERFORMANCE_MARKETING", label: "Performance marketing" },
  { value: "SEO_ORGANIC_GROWTH", label: "SEO & organic growth" },
  { value: "CONTENT_MARKETING", label: "Content marketing" },
  { value: "SOCIAL_MEDIA", label: "Social media management" },
  { value: "CREATIVE_BRAND", label: "Creative & brand management" },
  { value: "EMAIL_LIFECYCLE", label: "Email & lifecycle marketing" },
  { value: "EVENTS_PARTNERSHIPS", label: "Events & partnerships" },
  { value: "LEAD_GENERATION", label: "Lead generation" },
  { value: "WEBSITE_CONVERSION", label: "Website & conversion optimization" },
  { value: "ANALYTICS_REPORTING", label: "Marketing analytics & reporting" },
  { value: "RETENTION_ADVOCACY", label: "Customer retention & advocacy" },
];
const categoryLabel = (value: MarketingCampaignCategory | null) =>
  campaignCategories.find((category) => category.value === value)?.label ?? "General marketing";
const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function MarketingWorkspace({ view }: { view: MarketingView }) {
  const user = useAppSelector((state) => state.auth.user);
  const permissions = user?.permissions ?? [];
  const executive = Boolean(user?.roles.some((role) => role === "CEO" || role === "ADMIN"));
  const canManageContent = executive || permissions.includes("MARKETING_CONTENT_MANAGE");
  const canHandoffLeads = executive || permissions.includes("MARKETING_LEAD_HANDOFF");
  const [data, setData] = useState<MarketingDashboard | null>(null);
  const [contentItems, setContentItems] = useState<MarketingContent[]>([]);
  const [contentError, setContentError] = useState("");
  const [salesOwners, setSalesOwners] = useState<MarketingSalesOwner[]>([]);
  const [salesOwnerError, setSalesOwnerError] = useState("");
  const [error, setError] = useState("");
  const [campaignOpen, setCampaignOpen] = useState(false);
  const load = useCallback(() => {
    setError("");
    MarketingService.dashboard()
      .then(setData)
      .catch(() => setError("The Marketing workspace could not be loaded."));
  }, []);
  const loadContent = useCallback(() => {
    setContentError("");
    MarketingService.content()
      .then(setContentItems)
      .catch(() => setContentError("The Marketing content calendar could not be loaded."));
  }, []);
  useEffect(() => {
    let active = true;
    MarketingService.dashboard()
      .then((value) => active && setData(value))
      .catch(
        () =>
          active && setError("The Marketing workspace could not be loaded."),
      );
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!["content", "calendar", "publishing"].includes(view)) return;
    let active = true;
    MarketingService.content()
      .then((items) => {
        if (active) {
          setContentItems(items);
          setContentError("");
        }
      })
      .catch(() => {
        if (active) setContentError("The Marketing content calendar could not be loaded.");
      });
    return () => { active = false; };
  }, [view]);
  useEffect(() => {
    if (view !== "leads" || !canHandoffLeads) return;
    let active = true;
    MarketingService.salesOwners()
      .then((owners) => {
        if (active) {
          setSalesOwners(owners);
          setSalesOwnerError("");
        }
      })
      .catch(() => { if (active) setSalesOwnerError("Sales owners could not be loaded."); });
    return () => { active = false; };
  }, [canHandoffLeads, view]);
  if (error && !data) return <DashboardError message={error} onRetry={load} />;
  if (!data) return <DashboardSkeleton />;
  const manager =
    data.level === "HEAD" ||
    data.level === "MANAGER" ||
    data.actorRole === "CEO" ||
    data.actorRole === "ADMIN";
  const myWorkItems: MyWorkItem[] = [
    ...data.tasks.filter((task) => task.status === "PENDING" && task.assignedTo?._id === data.actorId).map((task) => ({
      id: task._id, title: task.title, description: task.description, kind: "TASK" as const,
      priority: task.priority, dueAt: task.deadline, tags: ["Marketing", task.workflowStage.replaceAll("_", " ")],
      href: "/dashboard/marketing/requests",
      onMarkDone: async () => { await MarketingService.completeTask(task._id); load(); },
    })),
    ...data.approvals.map((task) => ({
      id: `approval:${task._id}`, title: task.title, description: task.description, kind: "APPROVAL" as const,
      priority: task.priority, dueAt: task.deadline, tags: ["Marketing", task.workflowStage.replaceAll("_", " ")],
      href: "/dashboard/marketing/approvals", actionLabel: "Review",
    })),
    ...data.campaignApprovals.map((campaign) => ({
      id: `campaign:${campaign._id}`, title: `Campaign approval · ${campaign.name}`, description: campaign.objective,
      kind: "APPROVAL" as const, priority: "HIGH", dueAt: campaign.submittedAt ?? campaign.endDate,
      tags: ["Campaign", campaign.status.replaceAll("_", " ")], href: "/dashboard/marketing/approvals", actionLabel: "Review",
    })),
  ];
  return (
    <div className="mx-auto max-w-360 space-y-5 text-[#17233a]">
      {view !== "work" && <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold">{titles[view]}</h1>
          <p className="mt-1 text-xs text-[#657795]">
            {data.actorRole === "CEO"
              ? "Chief Executive Officer"
              : data.actorRole === "ADMIN"
                ? "Administration"
                : data.level === "HEAD"
                  ? "Marketing Head"
                  : data.level === "MANAGER"
                    ? "Marketing Manager"
                    : `Marketing Executive · ${data.employmentType === "INTERN" ? "Intern" : "Employee"}`}{" "}
            · {dateLabel(new Date().toISOString())}
          </p>
        </div>
        {manager && view !== "social" ? (
          <button
            onClick={() => setCampaignOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-[#1645a2] px-3 text-xs font-bold text-white"
          >
            <Plus size={14} /> New Campaign
          </button>
        ) : null}
        {contentError ? <p role="alert" className="rounded-md bg-red-50 p-3 text-xs font-bold text-red-700">{contentError}</p> : null}
      </header>}
      {[
        "module",
        "campaigns",
        "content",
        "leads",
        "social",
        "creative",
        "publishing",
        "budget",
        "attribution",
        "analytics",
      ].includes(view) ? (
        <nav className="flex gap-1 overflow-x-auto border-b border-[#dce4ef]">
          {moduleTabs.map((item) => (
            <Link
              key={item.view}
              href={`/dashboard/marketing/${item.view}`}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs font-bold ${view === item.view ? "border-[#1645a2] text-[#1645a2]" : "border-transparent text-[#60718d]"}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-md bg-red-50 p-3 text-xs font-bold text-red-700"
        >
          {error}
        </p>
      ) : null}
      {view === "dashboard" || view === "module" ? (
        <Overview data={data} />
      ) : null}
      {view === "work" ? (
        data.scope === "OWN" ? (
          <DailyTaskWorkspace
            role={data.employmentType === "INTERN" ? "intern" : "employee"}
          />
        ) : (
          <div className="space-y-5">
            <MyWorkInbox items={myWorkItems} />
            <details className="rounded-lg border border-(--brand-border) bg-white">
              <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-(--brand-text-secondary)">Team workflow &amp; task planning</summary>
              <div className="border-t border-(--brand-border) p-4"><TaskWorkflowWorkspace lockedDepartment="MARKETING" showMyWork={false} /></div>
            </details>
          </div>
        )
      ) : null}
      {view === "calendar" ? <Calendar data={data} content={contentItems} /> : null}
      {view === "approvals" ? <Approvals data={data} reload={load} /> : null}
      {view === "requests" ? (
        <TaskWorkflowWorkspace lockedDepartment="MARKETING" />
      ) : null}
      {view === "campaigns" ? (
        <Campaigns
          campaigns={data.campaigns}
          editable={manager}
          onUpdated={load}
        />
      ) : null}
      {view === "creative" ? <Creative campaigns={data.campaigns} /> : null}
      {view === "content" ? (
        <MarketingContentPlanner content={contentItems} campaigns={data.campaigns} team={data.team} actorId={data.actorId} canOverrideReview={Boolean(data.actorRole)} canManage={canManageContent} reload={loadContent} />
      ) : null}
      {view === "leads" ? (
        <MarketingLeadHandoff campaigns={data.campaigns} salesOwners={salesOwners} error={salesOwnerError} canHandoff={canHandoffLeads} reload={load} />
      ) : null}
      {view === "social" ? <MarketingSocialWorkspace /> : null}
      {view === "publishing" ? <Publishing campaigns={data.campaigns} content={contentItems} /> : null}
      {view === "budget" ? <Budget campaigns={data.campaigns} /> : null}
      {view === "attribution" ? (
        <Channels data={data} title="Lead Attribution" />
      ) : null}
      {view === "analytics" ? <Analytics data={data} /> : null}
      {view === "reports" ? <Reports data={data} /> : null}
      {view === "assistant" ? <AssistantView /> : null}
      {campaignOpen ? (
        <CampaignDialog
          data={data}
          close={() => setCampaignOpen(false)}
          created={() => {
            setCampaignOpen(false);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function Overview({ data }: { data: MarketingDashboard }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Active Campaigns"
          value={data.metrics.activeCampaigns}
          detail={`${data.campaigns.filter((item) => item.status === "DRAFT").length} drafts`}
          icon={Megaphone}
        />
        <Metric
          label="Leads"
          value={data.metrics.totalLeads}
          detail={`${data.metrics.conversions} conversions`}
          icon={Users}
          green
        />
        <Metric
          label="Avg Campaign ROI"
          value={`${data.metrics.roi}x`}
          detail={`${currency(data.metrics.revenue)} attributed`}
          icon={TrendingUp}
        />
        <Metric
          label="Budget Utilization"
          value={`${data.metrics.budgetUtilization}%`}
          detail={`${currency(data.metrics.spend)} of ${currency(data.metrics.budget)}`}
          icon={CircleDollarSign}
        />
      </div>
      <Channels data={data} title="Channel Performance" />
      <Campaigns campaigns={data.campaigns.slice(0, 5)} />
    </>
  );
}
function Metric({
  label,
  value,
  detail,
  icon: Icon,
  green,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Target;
  green?: boolean;
}) {
  return (
    <section className="min-h-28 rounded-lg border border-[#d8e1ed] bg-white p-4">
      <div className="flex justify-between">
        <p className="text-[10px] font-extrabold uppercase text-[#627492]">
          {label}
        </p>
        <span
          className={`rounded-md p-2 ${green ? "bg-emerald-50 text-emerald-600" : "bg-violet-50 text-violet-600"}`}
        >
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-2 text-xl font-extrabold">{value}</p>
      <p className="mt-2 text-[11px] font-semibold text-emerald-600">
        {detail}
      </p>
    </section>
  );
}
function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#d8e1ed] bg-white p-5">
      <h2 className="text-sm font-extrabold">{title}</h2>
      {subtitle ? (
        <p className="mt-1 text-xs text-[#657795]">{subtitle}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}
function Channels({
  data,
  title,
}: {
  data: MarketingDashboard;
  title: string;
}) {
  const max = Math.max(1, ...data.channelPerformance.map((item) => item.leads));
  return (
    <Panel title={title} subtitle="Leads by source from persisted campaigns">
      <div className="flex h-56 items-end gap-4 border-b border-dashed border-[#d8e1ed] px-3">
        {data.channelPerformance.map((item) => (
          <div
            key={item.channel}
            className="flex h-full min-w-0 flex-1 flex-col justify-end text-center"
          >
            <span className="mb-2 text-[10px] font-bold">{item.leads}</span>
            <div
              className="mx-auto w-full max-w-28 rounded-t bg-[#7c3aed]"
              style={{ height: `${Math.max(5, (item.leads / max) * 82)}%` }}
            />
            <span className="mt-2 truncate text-[10px] text-[#7183a0]">
              {item.channel}
            </span>
          </div>
        ))}
      </div>
      {!data.channelPerformance.length ? (
        <Empty
          title="No channel performance yet"
          text="Add campaign results to populate attribution."
        />
      ) : null}
    </Panel>
  );
}
function Campaigns({
  campaigns,
  editable = false,
  onUpdated,
}: {
  campaigns: MarketingCampaign[];
  editable?: boolean;
  onUpdated?: () => void;
}) {
  const [editing, setEditing] = useState<MarketingCampaign | null>(null);
  const [planEditing, setPlanEditing] = useState<MarketingCampaign | null>(
    null,
  );
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const submitCampaign = async (campaignId: string) => {
    setSubmittingId(campaignId);
    try {
      await MarketingService.submitCampaign(campaignId);
      onUpdated?.();
    } finally {
      setSubmittingId(null);
    }
  };
  return (
    <>
      <Panel
        title="Campaign Portfolio"
        subtitle="Plans move through approval before launch and performance reporting"
      >
        <div className="space-y-2">
          {campaigns.map((campaign) => (
            <article
              key={campaign._id}
              className="rounded-md border border-[#dce4ef] p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-xs font-extrabold">{campaign.name}</h3>
                  <p className="mt-1 text-[11px] text-[#657795]">
                    {categoryLabel(campaign.category)} · {currency(campaign.budget)} budget · {currency(campaign.spend)} spend
                  </p>
                  {campaign.audience ? <p className="mt-1 text-[10px] text-[#657795]">Audience: {campaign.audience}</p> : null}
                  <p className="mt-1 text-[10px] font-semibold text-[#52627a]">
                    Reported leads {campaign.leads} · CRM leads {campaign.attributedLeads}{campaign.targetLeads ? ` / ${campaign.targetLeads}` : ""} · CRM wins {campaign.attributedConversions}{campaign.targetConversions ? ` / ${campaign.targetConversions}` : ""} · CRM revenue {currency(campaign.attributedRevenue)}
                  </p>
                  {campaign.approvalNote ? (
                    <p className="mt-2 text-[10px] font-semibold text-amber-700">
                      Review note: {campaign.approvalNote}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-1 text-[9px] font-bold ${campaign.status === "ACTIVE" ? "bg-blue-50 text-blue-700" : campaign.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                  >
                    {campaign.status.replaceAll("_", " ")}
                  </span>
                  {editable &&
                  ["DRAFT", "CHANGES_REQUESTED"].includes(campaign.status) ? (
                    <>
                      <button
                        onClick={() => setPlanEditing(campaign)}
                        className="rounded border border-[#cdd8e7] px-2 py-1 text-[9px] font-bold text-[#1645a2]"
                      >
                        Edit plan
                      </button>
                      <button
                        disabled={submittingId === campaign._id}
                        onClick={() => void submitCampaign(campaign._id)}
                        className="rounded bg-[#1645a2] px-2 py-1 text-[9px] font-bold text-white disabled:opacity-50"
                      >
                        Submit
                      </button>
                    </>
                  ) : null}
                  {editable &&
                  ["APPROVED", "ACTIVE", "PAUSED"].includes(campaign.status) ? (
                    <button
                      onClick={() => setEditing(campaign)}
                      className="rounded border border-[#cdd8e7] px-2 py-1 text-[9px] font-bold text-[#1645a2]"
                    >
                      Update
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
          {!campaigns.length ? (
            <Empty
              title="No campaigns yet"
              text="Marketing Head or Manager can create the first campaign."
            />
          ) : null}
        </div>
      </Panel>
      {editing ? (
        <CampaignUpdateDialog
          campaign={editing}
          close={() => setEditing(null)}
          updated={() => {
            setEditing(null);
            onUpdated?.();
          }}
        />
      ) : null}
      {planEditing ? (
        <CampaignPlanDialog
          campaign={planEditing}
          close={() => setPlanEditing(null)}
          updated={() => {
            setPlanEditing(null);
            onUpdated?.();
          }}
        />
      ) : null}
    </>
  );
}
function Creative({ campaigns }: { campaigns: MarketingCampaign[] }) {
  return (
    <Panel
      title="Creative Studio"
      subtitle="Campaign briefs ready for creative production"
    >
      <div className="grid gap-3 lg:grid-cols-2">
        {campaigns.map((campaign) => (
          <article
            key={campaign._id}
            className="rounded-md border border-[#dce4ef] p-4"
          >
            <span className="text-[9px] font-bold text-violet-600">
              {campaign.status}
            </span>
            <h3 className="mt-2 text-sm font-extrabold">{campaign.name}</h3>
            <p className="mt-2 text-xs leading-5 text-[#657795]">
              {campaign.objective}
            </p>
            <p className="mt-3 text-[10px] font-bold text-[#1645a2]">
              {campaign.channels.join(" · ")}
            </p>
          </article>
        ))}
        {!campaigns.length ? (
          <Empty
            title="No creative briefs"
            text="Campaign objectives will appear here as creative briefs."
          />
        ) : null}
      </div>
    </Panel>
  );
}
function Publishing({ campaigns, content }: { campaigns: MarketingCampaign[]; content: MarketingContent[] }) {
  const scheduled = campaigns
    .filter((item) => !["COMPLETED", "CANCELLED"].includes(item.status))
    .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate));
  return (
    <div className="space-y-5">
      <Panel
        title="Publishing Schedule"
        subtitle="Campaign launch windows by channel"
      >
        <div className="divide-y divide-[#e6ebf2]">
          {scheduled.map((campaign) => (
            <div
              key={campaign._id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="text-xs font-extrabold">{campaign.name}</p>
                <p className="mt-1 text-[10px] text-[#657795]">
                  {campaign.channels.join(", ")}
                </p>
              </div>
              <p className="text-xs font-bold text-[#1645a2]">
                {dateLabel(campaign.startDate)} to {dateLabel(campaign.endDate)}
              </p>
            </div>
          ))}
          {!scheduled.length ? (
            <Empty
              title="Nothing scheduled"
              text="Active campaign schedules will appear here."
            />
          ) : null}
        </div>
      </Panel>
      <Panel
        title="Content publishing queue"
        subtitle="Approved content with a schedule appears alongside campaign launches"
      >
        <div className="divide-y divide-[#e6ebf2]">
          {content.filter((item) => ["APPROVED", "SCHEDULED"].includes(item.status)).map((item) => (
            <div key={item._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div><p className="text-xs font-extrabold">{item.title}</p><p className="mt-1 text-[10px] text-[#657795]">{item.channel} · {item.status.replaceAll("_", " ")}</p></div>
              <p className="text-xs font-bold text-[#1645a2]">{item.scheduledAt ? dateLabel(item.scheduledAt) : "Not scheduled"}</p>
            </div>
          ))}
          {!content.some((item) => ["APPROVED", "SCHEDULED"].includes(item.status)) ? <Empty title="No content scheduled" text="Approved posts, email, video, and blog content will appear here." /> : null}
          <Link href="/dashboard/marketing/content" className="mt-3 inline-flex text-xs font-bold text-[#1645a2]">Open content calendar →</Link>
        </div>
      </Panel>
      <Panel
        title="Blog publishing"
        subtitle="Manage stories shown in the public What’s new section"
      >
        <MarketingBlogs />
      </Panel>
    </div>
  );
}
function Calendar({ data, content }: { data: MarketingDashboard; content: MarketingContent[] }) {
  const events = [
    ...data.tasks
      .filter((item) => item.status === "PENDING")
      .map((item) => ({
        id: item._id,
        title: item.title,
        date: item.deadline,
        type: "Task",
      })),
    ...data.campaigns
      .filter((item) => !["COMPLETED", "CANCELLED"].includes(item.status))
      .map((item) => ({
        id: item._id,
        title: item.name,
        date: item.endDate,
        type: "Campaign",
      })),
    ...content
      .filter((item) => item.scheduledAt && !["PUBLISHED", "ANALYZED"].includes(item.status))
      .map((item) => ({
        id: item._id,
        title: item.title,
        date: item.scheduledAt!,
        type: `Content · ${item.channel}`,
      })),
  ].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  return (
    <Panel
      title="Upcoming Events"
      subtitle="Campaign milestones and task deadlines"
    >
      <div className="divide-y divide-[#e6ebf2]">
        {events.map((event) => (
          <div
            key={`${event.type}-${event.id}`}
            className="flex items-center gap-4 py-3"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#f1f5f9] text-xs font-extrabold">
              {new Date(event.date).getDate()}
            </span>
            <div>
              <p className="text-xs font-bold">{event.title}</p>
              <p className="mt-1 text-[10px] text-[#657795]">
                {dateLabel(event.date)} · {event.type}
              </p>
            </div>
          </div>
        ))}
        {!events.length ? (
          <Empty
            title="No upcoming events"
            text="Campaign milestones and tasks will appear here."
          />
        ) : null}
      </div>
    </Panel>
  );
}
function Approvals({
  data,
  reload,
}: {
  data: MarketingDashboard;
  reload: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const reviewCampaign = async (
    campaign: MarketingCampaign,
    decision: "APPROVE" | "CHANGES_REQUESTED",
  ) => {
    const note =
      decision === "CHANGES_REQUESTED"
        ? window.prompt("Describe the required changes")?.trim()
        : undefined;
    if (decision === "CHANGES_REQUESTED" && !note) return;
    setBusyId(campaign._id);
    try {
      await MarketingService.reviewCampaign(campaign._id, { decision, note });
      reload();
    } finally {
      setBusyId(null);
    }
  };
  return (
    <div className="space-y-4">
      <Panel
        title="Campaign approvals"
        subtitle="Verify objective, budget, channels, ownership, and dates before launch"
      >
        <div className="space-y-3">
          {data.campaignApprovals.map((campaign) => (
            <article
              key={campaign._id}
              className="rounded-md border border-[#dce4ef] p-4"
            >
              <h3 className="text-sm font-extrabold">{campaign.name}</h3>
              <p className="mt-1 text-xs leading-5 text-[#657795]">
                {campaign.objective}
              </p>
              <p className="mt-2 text-[10px] font-bold text-[#1645a2]">
                {currency(campaign.budget)} · {campaign.channels.join(" · ")}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  disabled={busyId === campaign._id}
                  onClick={() =>
                    void reviewCampaign(campaign, "CHANGES_REQUESTED")
                  }
                  className="h-8 rounded-md border border-amber-300 px-3 text-[10px] font-bold text-amber-800 disabled:opacity-50"
                >
                  Request changes
                </button>
                <button
                  disabled={busyId === campaign._id}
                  onClick={() => void reviewCampaign(campaign, "APPROVE")}
                  className="h-8 rounded-md bg-[#1645a2] px-3 text-[10px] font-bold text-white disabled:opacity-50"
                >
                  Approve
                </button>
              </div>
            </article>
          ))}
          {!data.campaignApprovals.length ? (
            <Empty
              title="No campaign plans pending"
              text="Submitted campaign plans will appear here for governance review."
            />
          ) : null}
        </div>
      </Panel>
      {data.approvals.length ? (
        <Panel
          title="Delivery reviews"
          subtitle="Completed work follows the Manager, Head, Admin, and CEO review chain"
        >
          <div className="space-y-3">
            {data.approvals.map((task) => (
              <article
                key={task._id}
                className="rounded-md border border-[#dce4ef] p-4"
              >
                <p className="text-[10px] font-bold text-[#7183a0]">
                  {task.workflowStage.replaceAll("_", " ")}
                </p>
                <h3 className="mt-1 text-sm font-extrabold">{task.title}</h3>
                <p className="mt-1 text-xs text-[#657795]">
                  {task.description}
                </p>
                <Link
                  href="/dashboard/marketing/requests"
                  className="mt-3 inline-flex h-8 items-center rounded-md bg-[#1645a2] px-3 text-[10px] font-bold text-white"
                >
                  Open review pipeline
                </Link>
              </article>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
function Budget({ campaigns }: { campaigns: MarketingCampaign[] }) {
  return (
    <Panel
      title="Campaign Budgets"
      subtitle="Budget utilization from campaign records"
    >
      <div className="space-y-4">
        {campaigns.map((campaign) => {
          const percent = campaign.budget
            ? Math.min(
                100,
                Math.round((campaign.spend / campaign.budget) * 100),
              )
            : 0;
          return (
            <div key={campaign._id}>
              <div className="flex justify-between text-xs">
                <span className="font-bold">{campaign.name}</span>
                <span>
                  {currency(campaign.spend)} / {currency(campaign.budget)}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e8edf4]">
                <div
                  className="h-full rounded-full bg-[#1645a2]"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
        {!campaigns.length ? (
          <Empty
            title="No budgets yet"
            text="Campaign budgets will appear here."
          />
        ) : null}
      </div>
    </Panel>
  );
}
function Analytics({ data }: { data: MarketingDashboard }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Revenue"
          value={currency(data.metrics.revenue)}
          detail="Attributed revenue"
          icon={TrendingUp}
        />
        <Metric
          label="Spend"
          value={currency(data.metrics.spend)}
          detail="Recorded campaign spend"
          icon={CircleDollarSign}
        />
        <Metric
          label="Conversions"
          value={data.metrics.conversions}
          detail="Across visible campaigns"
          icon={Target}
        />
        <Metric
          label="ROI"
          value={`${data.metrics.roi}x`}
          detail="Revenue divided by spend"
          icon={BarChart3}
        />
      </div>
      <Channels data={data} title="Channel Analytics" />
    </>
  );
}
function Reports({ data }: { data: MarketingDashboard }) {
  const reports = [
    {
      title: "Campaign ROI Analysis",
      text: `${data.metrics.activeCampaigns} active campaigns · ${data.metrics.roi}x ROI`,
    },
    {
      title: "Lead Source Attribution",
      text: `${data.metrics.totalLeads} leads across ${data.channelPerformance.length} channels`,
    },
    {
      title: "Budget vs Actual Spend",
      text: `${data.metrics.budgetUtilization}% of recorded budget used`,
    },
    {
      title: "Conversion Performance",
      text: `${data.metrics.conversions} campaign conversions recorded`,
    },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {reports.map((report) => (
        <section
          key={report.title}
          className="rounded-lg border border-[#d8e1ed] bg-white p-5"
        >
          <BarChart3 size={18} className="text-[#1645a2]" />
          <h2 className="mt-3 text-sm font-extrabold">{report.title}</h2>
          <p className="mt-2 text-xs text-[#657795]">{report.text}</p>
        </section>
      ))}
    </div>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <section className="flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed border-[#cfd9e7] bg-white p-6 text-center">
      <BriefcaseBusiness size={24} className="text-[#94a3b8]" />
      <h2 className="mt-3 text-sm font-extrabold">{title}</h2>
      <p className="mt-1 max-w-md text-xs text-[#657795]">{text}</p>
    </section>
  );
}

const channels: MarketingChannel[] = [
  "GOOGLE",
  "META",
  "EMAIL",
  "WHATSAPP",
  "LINKEDIN",
  "ORGANIC",
  "OTHER",
];
function CampaignPlanDialog({
  campaign,
  close,
  updated,
}: {
  campaign: MarketingCampaign;
  close: () => void;
  updated: () => void;
}) {
  const [objective, setObjective] = useState(campaign.objective);
  const [category, setCategory] = useState<MarketingCampaignCategory>(campaign.category ?? "LEAD_GENERATION");
  const [audience, setAudience] = useState(campaign.audience ?? "");
  const [budget, setBudget] = useState(String(campaign.budget / 100));
  const [targetLeads, setTargetLeads] = useState(String(campaign.targetLeads));
  const [targetConversions, setTargetConversions] = useState(String(campaign.targetConversions));
  const [startDate, setStartDate] = useState(campaign.startDate.slice(0, 10));
  const [endDate, setEndDate] = useState(campaign.endDate.slice(0, 10));
  const [selectedChannels, setSelectedChannels] = useState(campaign.channels);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await MarketingService.updateCampaign(campaign._id, {
        objective,
        category,
        audience,
        budget: Math.round((Number(budget) || 0) * 100),
        targetLeads: Number(targetLeads) || 0,
        targetConversions: Number(targetConversions) || 0,
        channels: selectedChannels,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      });
      updated();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Revise Campaign Plan" close={close}>
      <form onSubmit={submit} className="grid gap-3">
        <TextArea label="Objective" value={objective} set={setObjective} />
        <label className="text-xs font-bold">Marketing category<select value={category} onChange={(event) => setCategory(event.target.value as MarketingCampaignCategory)} className="mt-2 h-10 w-full rounded-md border border-[#d8e1ed] bg-white px-3">{campaignCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <Input label="Target audience" value={audience} set={setAudience} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="Budget (INR)"
            type="number"
            value={budget}
            set={setBudget}
          />
          <Input
            label="Start"
            type="date"
            value={startDate}
            set={setStartDate}
          />
          <Input label="End" type="date" value={endDate} set={setEndDate} />
          <Input label="Qualified lead target" type="number" value={targetLeads} set={setTargetLeads} />
          <Input label="Conversion target" type="number" value={targetConversions} set={setTargetConversions} />
        </div>
        <fieldset>
          <legend className="text-xs font-bold">Channels</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {channels.map((channel) => (
              <button
                type="button"
                key={channel}
                onClick={() =>
                  setSelectedChannels((current) =>
                    current.includes(channel)
                      ? current.filter((item) => item !== channel)
                      : [...current, channel],
                  )
                }
                className={`rounded-full border px-3 py-2 text-[10px] font-bold ${selectedChannels.includes(channel) ? "border-[#1645a2] bg-blue-50 text-[#1645a2]" : "border-[#d8e1ed]"}`}
              >
                {channel}
              </button>
            ))}
          </div>
        </fieldset>
        <Submit busy={busy} label="Save Revision" />
      </form>
    </Modal>
  );
}
function CampaignUpdateDialog({
  campaign,
  close,
  updated,
}: {
  campaign: MarketingCampaign;
  close: () => void;
  updated: () => void;
}) {
  const allowedStatuses: MarketingCampaign["status"][] =
    campaign.status === "APPROVED"
      ? ["APPROVED", "ACTIVE", "CANCELLED"]
      : campaign.status === "ACTIVE"
        ? ["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]
        : ["PAUSED", "ACTIVE", "COMPLETED", "CANCELLED"];
  const [status, setStatus] = useState(campaign.status);
  const [spend, setSpend] = useState(String(campaign.spend / 100));
  const [revenue, setRevenue] = useState(String(campaign.revenue / 100));
  const [leads, setLeads] = useState(String(campaign.leads));
  const [conversions, setConversions] = useState(String(campaign.conversions));
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await MarketingService.updateCampaign(campaign._id, {
        ...(status !== campaign.status ? { status } : {}),
        spend: Math.round((Number(spend) || 0) * 100),
        revenue: Math.round((Number(revenue) || 0) * 100),
        leads: Number(leads) || 0,
        conversions: Number(conversions) || 0,
      });
      updated();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Update Campaign Results" close={close}>
      <form onSubmit={submit} className="grid gap-3">
        <label className="text-xs font-bold">
          Status
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as MarketingCampaign["status"])
            }
            className="mt-2 h-10 w-full rounded-md border border-[#d8e1ed] bg-white px-3"
          >
            {allowedStatuses.map((item) => (
              <option key={item}>{item.replaceAll("_", " ")}</option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Spend (INR)"
            type="number"
            value={spend}
            set={setSpend}
          />
          <Input
            label="Revenue (INR)"
            type="number"
            value={revenue}
            set={setRevenue}
          />
          <Input label="Leads" type="number" value={leads} set={setLeads} />
          <Input
            label="Conversions"
            type="number"
            value={conversions}
            set={setConversions}
          />
        </div>
        <Submit busy={busy} label="Save Results" />
      </form>
    </Modal>
  );
}
function CampaignDialog({
  data,
  close,
  created,
}: {
  data: MarketingDashboard;
  close: () => void;
  created: () => void;
}) {
  const assignees = data.team.filter((item) => item.assignable);
  const [form, setForm] = useState<CreateMarketingCampaignInput>({
    name: "",
    objective: "",
    category: "LEAD_GENERATION",
    audience: "",
    channels: ["GOOGLE"],
    budget: 0,
    targetLeads: 0,
    targetConversions: 0,
    startDate: "",
    endDate: "",
    teamMemberIds: [],
  });
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await MarketingService.createCampaign({
        ...form,
        budget: Math.round(form.budget * 100),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
      });
      created();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="New Campaign" close={close}>
      <form onSubmit={submit} className="grid gap-3">
        <Input
          label="Campaign name"
          value={form.name}
          set={(value) => setForm({ ...form, name: value })}
        />
        <TextArea
          label="Objective"
          value={form.objective}
          set={(value) => setForm({ ...form, objective: value })}
        />
        <label className="text-xs font-bold">Marketing category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as MarketingCampaignCategory })} className="mt-2 h-10 w-full rounded-md border border-[#d8e1ed] bg-white px-3">{campaignCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <Input label="Target audience" value={form.audience} set={(audience) => setForm({ ...form, audience })} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="Budget (INR)"
            type="number"
            value={String(form.budget)}
            set={(value) => setForm({ ...form, budget: Number(value) })}
          />
          <Input
            label="Start"
            type="date"
            value={form.startDate}
            set={(value) => setForm({ ...form, startDate: value })}
          />
          <Input
            label="End"
            type="date"
            value={form.endDate}
            set={(value) => setForm({ ...form, endDate: value })}
          />
          <Input label="Qualified lead target" type="number" value={String(form.targetLeads)} set={(value) => setForm({ ...form, targetLeads: Number(value) })} />
          <Input label="Conversion target" type="number" value={String(form.targetConversions)} set={(value) => setForm({ ...form, targetConversions: Number(value) })} />
        </div>
        <fieldset>
          <legend className="text-xs font-bold">Channels</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {channels.map((channel) => (
              <button
                type="button"
                key={channel}
                onClick={() =>
                  setForm({
                    ...form,
                    channels: form.channels.includes(channel)
                      ? form.channels.filter((item) => item !== channel)
                      : [...form.channels, channel],
                  })
                }
                className={`rounded-full border px-3 py-2 text-[10px] font-bold ${form.channels.includes(channel) ? "border-[#1645a2] bg-blue-50 text-[#1645a2]" : "border-[#d8e1ed]"}`}
              >
                {channel}
              </button>
            ))}
          </div>
        </fieldset>
        <Assignees
          items={assignees}
          selected={form.teamMemberIds}
          set={(teamMemberIds) => setForm({ ...form, teamMemberIds })}
        />
        <Submit busy={busy} label="Create Campaign" />
      </form>
    </Modal>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#081f47]/55 p-4">
      <section
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-5"
      >
        <div className="mb-5 flex justify-between">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button onClick={close} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Input({
  label,
  value,
  set,
  type = "text",
}: {
  label: string;
  value: string;
  set: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="text-xs font-bold">
      {label}
      <input
        required
        minLength={type === "text" ? 2 : undefined}
        type={type}
        value={value}
        onChange={(event) => set(event.target.value)}
        className="mt-2 h-10 w-full rounded-md border border-[#d8e1ed] px-3 text-sm outline-none focus:border-[#1645a2]"
      />
    </label>
  );
}
function TextArea({
  label,
  value,
  set,
}: {
  label: string;
  value: string;
  set: (value: string) => void;
}) {
  return (
    <label className="text-xs font-bold">
      {label}
      <textarea
        required
        minLength={2}
        value={value}
        onChange={(event) => set(event.target.value)}
        className="mt-2 min-h-24 w-full resize-y rounded-md border border-[#d8e1ed] p-3 text-sm outline-none focus:border-[#1645a2]"
      />
    </label>
  );
}
function Assignees({
  items,
  selected,
  set,
}: {
  items: MarketingDashboard["team"];
  selected: string[];
  set: (ids: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-bold">Team members</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <label
            key={item.user._id}
            className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 ${selected.includes(item.user._id) ? "border-[#1645a2] bg-blue-50" : "border-[#d8e1ed]"}`}
          >
            <input
              type="checkbox"
              checked={selected.includes(item.user._id)}
              onChange={() =>
                set(
                  selected.includes(item.user._id)
                    ? selected.filter((id) => id !== item.user._id)
                    : [...selected, item.user._id],
                )
              }
            />
            <span>
              <span className="block text-xs font-bold">{item.user.name}</span>
              <span className="text-[10px] text-[#657795]">
                {item.level} · {item.activeTasks} active
              </span>
            </span>
          </label>
        ))}
        {!items.length ? (
          <p className="text-xs text-[#657795]">
            No direct reports are available.
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}
function Submit({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button
      disabled={busy}
      className="mt-2 h-10 rounded-md bg-[#1645a2] text-xs font-bold text-white disabled:opacity-50"
    >
      {busy ? "Saving..." : label}
    </button>
  );
}
