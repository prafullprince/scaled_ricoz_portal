"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Flag,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Trash2,
  UserRoundX,
  Users,
  Pencil,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { UserDirectoryService, type PlatformUserDetails } from "@/services/userDirectory.service";
import { DashboardCard, DashboardError, DashboardSkeleton } from "./DashboardPrimitives";
import { ConfirmUserDeletionDialog } from "./ConfirmUserDeletionDialog";
import { isProtectedAccount } from "./UserDirectoryView";
import { useAppSelector } from "@/redux/hooks";

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");
const dateLabel = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-(--brand-text-muted)">{label}</p>
      <p className="mt-1 truncate text-sm text-(--brand-text)">{value || "—"}</p>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="rounded-(--radius-lg) border border-(--brand-border) p-4">
      <Icon size={16} className="text-(--brand-text-muted)" />
      <p className="mt-2 text-xs text-(--brand-text-secondary)">{label}</p>
      <p className="text-xl font-semibold text-(--brand-navy)">{value}</p>
    </div>
  );
}

function UserAccessEditor({ userId, onSaved }: { userId: string; onSaved: () => Promise<void> }) {
  const [access, setAccess] = useState<Awaited<ReturnType<typeof UserDirectoryService.access>> | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    UserDirectoryService.access(userId).then((data) => {
      if (active) { setAccess(data); setRoles(data.roles.filter((role) => data.availableRoles.includes(role))); }
    }).catch(() => { if (active) setError("Access details could not be loaded."); });
    return () => { active = false; };
  }, [userId]);
  return <section className="space-y-4 border-y border-(--brand-border) py-5">
    <h2 className="text-base font-semibold text-(--brand-text)">Roles & company assignments</h2>
    {error ? <p role="alert" className="text-sm text-(--status-danger)">{error}</p> : null}
    {access ? <>
      <div className="flex flex-wrap items-center gap-3"><select aria-label="Add account role" value="" onChange={(event) => setRoles([...roles, event.target.value])} className="min-h-10 rounded-md border border-(--brand-border) bg-(--brand-surface) px-3 text-sm text-(--brand-text)"><option value="">Add account role...</option>{access.availableRoles.filter((role) => !roles.includes(role)).map((role) => <option key={role} value={role}>{titleCase(role)}</option>)}</select>{roles.map((role) => <label key={role} className="flex items-center gap-2 text-sm"><input type="checkbox" checked disabled={role === "USER"} onChange={() => setRoles(roles.filter((value) => value !== role))}/>{titleCase(role)}</label>)}<button type="button" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await UserDirectoryService.setRoles(userId, roles); await onSaved(); toast.success("Roles updated."); } catch { setError("Roles could not be saved."); } finally { setBusy(false); } }} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-(--brand-red) px-3 text-sm font-semibold text-white disabled:opacity-50"><Save size={15}/>Save roles</button></div>
      <Link href={`/dashboard/organization?editUserId=${userId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-(--brand-red)"><Users size={16}/>Company position & workspace roles</Link>
      <ul className="divide-y divide-(--brand-border)">{access.assignments.map((assignment) => <li key={assignment._id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><strong>{assignment.companyId?.name ?? "Default company"}</strong><span className="text-(--brand-text-secondary)">{titleCase(assignment.level)} / {titleCase(assignment.department)} / {assignment.roleKeys.map(titleCase).join(", ")}</span></li>)}{access.hrCompanies.map((assignment) => <li key={assignment._id} className="flex justify-between gap-3 py-3 text-sm"><strong>{assignment.companyId?.name ?? "Unavailable company"}</strong><span className="text-(--brand-text-secondary)">Assigned HR</span></li>)}</ul>
      {!access.assignments.length && !access.hrCompanies.length ? <p className="text-sm text-(--brand-text-secondary)">No company assignments.</p> : null}
    </> : !error ? <p className="text-sm text-(--brand-text-secondary)">Loading access...</p> : null}
  </section>;
}

export function UserProfileView({ userId }: { userId: string }) {
  const [user, setUser] = useState<PlatformUserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);
  const myId = useAppSelector((state) => state.auth.user?.user_id ?? null);
  const isAdmin = useAppSelector((state) => state.auth.user?.roles.includes("ADMIN") ?? false);
  const executive = useAppSelector((state) => state.auth.user?.roles.some((role) => role === "CEO" || role === "ADMIN") ?? false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: "", about: "", currentRole: "" });
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUser(await UserDirectoryService.details(userId));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function toggleStatus() {
    if (!user) return;
    const next = user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setBusy(true);
    try {
      const updated = await UserDirectoryService.setStatus(user.id, next);
      setUser({ ...user, status: updated.status });
      toast.success(`${user.name} is now ${next === "ACTIVE" ? "active" : "inactive"}.`);
    } catch {
      // The axios interceptor surfaces the exact server message.
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!user) return;
    setBusy(true);
    try {
      await UserDirectoryService.remove(user.id);
      toast.success(`${user.name} was removed from the platform.`);
      router.push("/dashboard/users");
    } catch {
      setBusy(false);
    }
  }

  if (loading) return <DashboardSkeleton />;
  if (failed || !user) return <DashboardError message="Unable to load this profile." onRetry={() => void load()} />;

  const active = user.status === "ACTIVE";
  const locked = isProtectedAccount(user.roles) || user.id === myId;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/users"
        className="inline-flex items-center gap-2 text-sm font-semibold text-(--brand-text-secondary) hover:text-(--brand-navy)"
      >
        <ArrowLeft size={15} /> Users Base
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-(--brand-navy) text-xl font-semibold text-white">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-(--brand-navy)">{user.name}</h1>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                  active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                {titleCase(user.status)}
              </span>
              {user.email_verified ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                  <BadgeCheck size={13} /> Verified email
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-(--brand-text-secondary)">
              {user.organization
                ? `${titleCase(user.organization.level)} · ${titleCase(user.organization.department)}`
                : titleCase(user.category)}
            </p>
            {user.about ? <p className="mt-2 max-w-2xl text-sm text-(--brand-text-secondary)">{user.about}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {executive ? <button type="button" onClick={() => { setDraft({ name: user.name, about: user.about ?? "", currentRole: user.employment?.current_role ?? "" }); setEditing(true); }} className="inline-flex items-center gap-2 rounded-md border border-(--brand-border) px-3 py-2 text-sm font-semibold"><Pencil size={15} /> Edit profile</button> : null}
          {executive && user.id !== myId ? <Link href={`/dashboard/organization?editUserId=${user.id}`} className="inline-flex items-center gap-2 rounded-md border border-(--brand-border) px-3 py-2 text-sm font-semibold"><Users size={15} /> Edit organization role</Link> : null}
          {locked ? (
            <p className="rounded-(--radius-md) border border-(--brand-border) px-3.5 py-2 text-xs font-semibold text-(--brand-text-muted)">
              {user.id === myId ? "This is your own account" : "CEO and Admin accounts are protected"}
            </p>
          ) : (
            <>
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggleStatus()}
            className="inline-flex items-center gap-2 rounded-(--radius-md) border border-(--brand-border) px-3.5 py-2 text-sm font-semibold text-(--brand-text-secondary) transition hover:border-(--brand-navy) disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : active ? <UserRoundX size={14} /> : <CheckCircle2 size={14} />}
            {active ? "Deactivate" : "Activate"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmingDeletion(true)}
            className="inline-flex items-center gap-2 rounded-(--radius-md) border border-(--status-danger-border) px-3.5 py-2 text-sm font-semibold text-(--status-danger) transition hover:bg-(--status-danger-bg) disabled:opacity-50"
          >
            <Trash2 size={14} /> Delete
          </button>
            </>
          )}
        </div>
      </div>

      {editing ? <form className="grid gap-4 rounded-lg border border-(--brand-border) bg-(--brand-surface) p-5" onSubmit={async (event) => { event.preventDefault(); setBusy(true); try { await UserDirectoryService.update(user.id, draft); setEditing(false); await load(); toast.success("Profile updated."); } catch { toast.error("Could not update profile."); } finally { setBusy(false); } }}>
        <label className="text-sm font-semibold">Name<input required minLength={2} maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1 block w-full rounded-md border border-(--brand-border) p-2" /></label>
        {user.employment && <label className="text-sm font-semibold">Job role<input maxLength={160} value={draft.currentRole} onChange={(event) => setDraft({ ...draft, currentRole: event.target.value })} className="mt-1 block w-full rounded-md border border-(--brand-border) p-2" /></label>}
        <label className="text-sm font-semibold">About<textarea rows={4} maxLength={2000} value={draft.about} onChange={(event) => setDraft({ ...draft, about: event.target.value })} className="mt-1 block w-full rounded-md border border-(--brand-border) p-2" /></label>
        <div className="flex gap-3"><button disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-(--brand-red) px-4 py-2 text-white"><Save size={16} /> Save</button><button type="button" onClick={() => setEditing(false)}>Cancel</button></div>
      </form> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={ClipboardList} label="Tasks assigned" value={user.activity.tasks} />
        <Stat icon={Clock3} label="Attendance records" value={user.activity.attendance_days} />
        <Stat icon={Flag} label="Pending leave" value={user.activity.pending_leave} />
        <Stat icon={Users} label="Active sessions" value={user.activity.active_sessions} />
      </div>

      {isAdmin ? <UserAccessEditor userId={user.id} onSaved={load} /> : null}
      <DashboardCard title="Account" description="Contact details and platform history">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Email" value={<span className="inline-flex items-center gap-1.5"><Mail size={13} /> {user.email}</span>} />
          <Detail
            label="Phone"
            value={user.phone_number ? <span className="inline-flex items-center gap-1.5"><Phone size={13} /> {user.phone_number}</span> : null}
          />
          <Detail label="Roles" value={user.roles.map(titleCase).join(", ")} />
          <Detail label="Joined" value={<span className="inline-flex items-center gap-1.5"><CalendarDays size={13} /> {dateLabel(user.created_at)}</span>} />
          <Detail label="Last seen" value={dateLabel(user.last_seen)} />
          <Detail label="Category" value={titleCase(user.category)} />
        </div>
      </DashboardCard>

      {user.organization ? (
        <DashboardCard title="Organization" description="Placement in the reporting structure">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Level" value={titleCase(user.organization.level)} />
            <Detail label="Department" value={titleCase(user.organization.department)} />
            <Detail label="Designation" value={user.organization.designation ? titleCase(user.organization.designation) : null} />
            <Detail label="Employment type" value={user.organization.employment_type ? titleCase(user.organization.employment_type) : null} />
            <Detail label="In role since" value={dateLabel(user.organization.effective_from)} />
            <Detail
              label="Reports to"
              value={
                user.organization.reports_to ? (
                  <Link href={`/dashboard/users/${user.organization.reports_to.id}`} className="hover:underline">
                    {user.organization.reports_to.name}
                  </Link>
                ) : null
              }
            />
          </div>
        </DashboardCard>
      ) : null}

      {user.employment ? (
        <DashboardCard title={user.employment.type === "EMPLOYEE" ? "Employment" : "Internship"} description="Onboarding record">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Joining date" value={dateLabel(user.employment.joining_date)} />
            <Detail label="End date" value={dateLabel(user.employment.end_date)} />
            <Detail label="Department" value={user.employment.department ? titleCase(user.employment.department) : null} />
            <Detail label="Initial role" value={user.employment.initial_role} />
            <Detail label="Current role" value={user.employment.current_role} />
            <Detail
              label="Address"
              value={user.employment.address ? <span className="inline-flex items-center gap-1.5"><MapPin size={13} /> {user.employment.address}</span> : null}
            />
          </div>
        </DashboardCard>
      ) : null}

      {user.external ? (
        <DashboardCard title={titleCase(user.external.type)} description="External account record">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {user.external.type === "INVESTOR" ? (
              <>
                <Detail label="Verified" value={user.external.is_verified ? "Yes" : "No"} />
                <Detail label="Verification" value={titleCase(user.external.verification_status)} />
              </>
            ) : null}
          </div>
        </DashboardCard>
      ) : null}

      {user.direct_reports.length ? (
        <DashboardCard title="Direct reports" description={`${user.direct_reports.length} people report to ${user.name}`}>
          <ul className="divide-y divide-(--brand-border)">
            {user.direct_reports.map((report) => (
              <li key={report.id}>
                <Link href={`/dashboard/users/${report.id}`} className="flex items-center gap-3 py-3 hover:underline">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--brand-surface-hover) text-[11px] font-semibold text-(--brand-text)">
                    {report.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-(--brand-text)">{report.name}</span>
                    <span className="block truncate text-[11px] text-(--brand-text-muted)">
                      {titleCase(report.level)} · {titleCase(report.department)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>
      ) : null}

      <ConfirmUserDeletionDialog
        user={confirmingDeletion ? user : null}
        busy={busy}
        onCancel={() => setConfirmingDeletion(false)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
