"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, CheckCircle2, ChevronDown, Clock, FileText, Image as ImageIcon, LoaderCircle, LockKeyhole, Phone, ShieldAlert, ShieldCheck, UserRound } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { setUser } from "@/redux/slice/auth.slice";
import { AuthService } from "@/services/auth.service";
import { InvestorService, type InvestorVerification } from "@/services/investor.service";
import { EmployeeService } from "@/services/employee.service";
import { InternService } from "@/services/intern.service";
import { JOB_ROLES, type JobRole } from "@/lib/jobRoles";
import { USER_ROLES } from "@/lib/auth/roles";
import { DashboardCard } from "@/components/dashboard/DashboardPrimitives";
import { ProfileCompanySwitcher } from "@/components/dashboard/ProfileCompanySwitcher";

const VERIFICATION_STATUS_META = {
  PENDING: { label: "Pending", tone: "text-(--status-warning)", icon: Clock },
  VERIFIED: { label: "Verified", tone: "text-(--status-success)", icon: BadgeCheck },
  REJECTED: { label: "Rejected", tone: "text-(--status-danger)", icon: ShieldAlert },
} as const;

function RoleVerificationSummary({
  title,
  href,
  load,
}: {
  title: string;
  href: string;
  load: () => Promise<{ verification: InvestorVerification }>;
}) {
  const [verification, setVerification] = useState<InvestorVerification | null>(null);

  useEffect(() => {
    load()
      .then((data) => setVerification(data.verification))
      .catch(() => setVerification(null));
    // Only fetch once per mount; `load` is a stable service reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!verification) return null;
  const meta = VERIFICATION_STATUS_META[verification.status];
  const Icon = meta.icon;

  return (
    <DashboardCard title={title} description="Separate from your email verification.">
      <div className={`flex items-center gap-2 text-sm font-semibold ${meta.tone}`}>
        <Icon size={17} /> {meta.label}
      </div>
      <Link href={href} className="mt-3 inline-block text-sm font-semibold text-(--brand-red) hover:underline">
        Manage verification
      </Link>
    </DashboardCard>
  );
}

function MyRoleCard({ service }: { service: { getMyRole: () => Promise<{ initialRole: string | null; currentRole: string | null }>; updateMyRole: (role: JobRole) => Promise<{ initialRole: string | null; currentRole: string | null }> } }) {
  const [role, setRole] = useState<{ initialRole: string | null; currentRole: string | null } | null>(null);
  const [selected, setSelected] = useState<JobRole | "">("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    service
      .getMyRole()
      .then((data) => {
        setRole(data);
        if (data.currentRole && (JOB_ROLES as readonly string[]).includes(data.currentRole)) {
          setSelected(data.currentRole as JobRole);
        }
      })
      .catch(() => setRole(null));
    // Only fetch once per mount; `service` is a stable module reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!selected) return;
    setPending(true);
    setMessage("");
    try {
      const data = await service.updateMyRole(selected);
      setRole(data);
      setMessage("Role updated.");
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Unable to update your role.");
    } finally {
      setPending(false);
    }
  }

  return (
    <DashboardCard title="My role" description="Update the role you currently work as.">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <label htmlFor="my-role" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-(--brand-text-muted)">
            Current role
          </label>
          <div className="relative">
            <BriefcaseBusiness aria-hidden="true" size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-(--brand-text-muted)" />
            <select
              id="my-role"
              value={selected}
              onChange={(event) => setSelected(event.target.value as JobRole)}
              className="h-12 w-full appearance-none rounded-(--radius-md) border border-(--brand-border-strong) bg-white py-2 pl-11 pr-10 text-sm font-medium text-(--brand-text) outline-none transition hover:border-(--brand-red) focus:border-(--brand-red) focus:ring-4 focus:ring-(--brand-red-pale)"
            >
              <option value="" disabled>
                Select a role
              </option>
              {JOB_ROLES.map((jobRole) => (
                <option key={jobRole} value={jobRole}>
                  {jobRole}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" size={17} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-(--brand-text-muted)" />
          </div>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={pending || !selected || selected === role?.currentRole}
          className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-(--radius-md) bg-(--brand-red) px-5 text-sm font-semibold text-white transition hover:bg-(--brand-red-hover) disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-32"
        >
          {pending ? <LoaderCircle size={16} className="animate-spin" /> : "Save role"}
        </button>
      </div>
      {message ? <p className="mt-3 text-sm font-medium text-(--status-success)">{message}</p> : null}
      {role?.initialRole && role.initialRole !== role.currentRole ? (
        <p className="mt-3 border-t border-(--brand-border) pt-3 text-xs text-(--brand-text-muted)">Initial role: {role.initialRole}</p>
      ) : null}
    </DashboardCard>
  );
}

export function ProfileView() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [form, setForm] = useState({
    name: user?.user_name ?? "",
    phoneNumber: user?.phone_number ?? "",
    about: user?.user_about ?? "",
    profile_pic: user?.user_dp ?? "",
  });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!user) return null;
  const profileCompletion = Math.round(([user.user_name, user.user_email, user.phone_number, user.user_about, user.user_dp].filter(Boolean).length / 5) * 100);
  const profileHealth = [
    { label: "Full name", complete: Boolean(user.user_name), href: "#profile-name" },
    { label: "Email verified", complete: Boolean(user.email_verified_at), href: "/dashboard/security" },
    { label: "Phone number", complete: Boolean(user.phone_number), href: "#profile-phone" },
    { label: "Bio", complete: Boolean(user.user_about), href: "#profile-about" },
    { label: "Profile photo", complete: Boolean(user.user_dp), href: "#profile-picture" },
  ];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);
    try {
      const result = await AuthService.updateProfile({
        name: form.name.trim(),
        phoneNumber: form.phoneNumber.trim(),
        about: form.about.trim(),
        profile_pic: form.profile_pic.trim() || undefined,
      });
      if (result?.user) dispatch(setUser(result.user));
      setMessage("Profile updated.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1120px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#008f69]">Personal workspace</p><h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-(--brand-navy)">Your profile</h1><p className="mt-1 text-sm text-(--brand-text-secondary)">Keep your identity, contact details, and workspace presence up to date.</p></div>
        <span className="rounded-full border border-[#bfeede] bg-[#f0fffa] px-3 py-1.5 text-xs font-bold text-[#008f69]">{profileCompletion}% complete</span>
      </div>

      <DashboardCard>
        <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(110deg,#122f70,#1645a2)] p-5 text-white sm:p-6">
          <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full border-[18px] border-white/10" />
          <div className="relative flex flex-wrap items-center justify-between gap-5"><div className="flex items-center gap-4"><span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white/15 text-xl font-semibold text-white ring-4 ring-white/10">
            {user.user_dp ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.user_dp} alt="" className="h-full w-full object-cover" />
            ) : (
              user.user_name.slice(0, 1).toUpperCase()
            )}
          </span><div><p className="flex items-center gap-1.5 text-lg font-bold text-white">
              {user.user_name}
              {user.email_verified_at ? <BadgeCheck size={16} className="text-[#a7f3d0]" /> : null}
            </p><p className="mt-1 text-sm text-white/70">{user.user_email}</p>{user.organization_title ? <p className="mt-1 text-xs font-semibold text-[#a7f3d0]">{user.organization_title}</p> : null}
            {user.created_at ? (
              <p className="mt-2 text-xs text-white/55">
                Member since {new Date(user.created_at).toLocaleDateString()}
              </p>
            ) : null}
          </div></div><div className="min-w-[150px]"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/55">Profile strength</p><div className="mt-3 h-2 rounded-full bg-white/15"><div className="h-full rounded-full bg-[#53e0b0]" style={{ width: `${profileCompletion}%` }} /></div><p className="mt-2 text-xs font-semibold text-white/80">Complete your workspace identity</p></div></div>
        </div><div className="mt-4 flex flex-wrap gap-2">
          {user.roles.map((role) => (
            <span
              key={role}
              className="rounded-full border border-[#dfe6ee] bg-[#f8fafc] px-3 py-1.5 text-xs font-bold text-[#5c6f8d]"
            >
              {role}
            </span>
          ))}
        </div>
      </DashboardCard>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <DashboardCard title="Profile health" description="A quick view of the details that make your workspace useful.">
          <div className="space-y-2">
            {profileHealth.map((item) => <Link key={item.label} href={item.href} className="group flex items-center gap-3 rounded-xl border border-[#edf1f6] px-3 py-3 transition hover:border-[#bfeede] hover:bg-[#f7fffc]"><span className={`flex h-7 w-7 items-center justify-center rounded-full ${item.complete ? "bg-[#e8faf4] text-[#008f69]" : "bg-[#fff8e7] text-[#b66a00]"}`}>{item.complete ? <CheckCircle2 size={15} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span><span className="flex-1 text-sm font-semibold text-(--brand-navy)">{item.label}</span><span className="text-xs text-[#71829e]">{item.complete ? "Complete" : "Add now"}</span><ArrowRight size={14} className="text-[#a1aec0] transition group-hover:translate-x-0.5" /></Link>)}
          </div>
        </DashboardCard>
        <DashboardCard title="Account security" description="Keep access to your workspace protected.">
          <div className="rounded-xl bg-[#f7faff] p-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8faf4] text-[#008f69]"><ShieldCheck size={19} /></span><div><p className="text-sm font-bold text-(--brand-navy)">{user.email_verified_at ? "Email verified" : "Email needs verification"}</p><p className="mt-1 text-xs text-[#71829e]">Account status: {user.status}</p></div></div><Link href="/dashboard/security" className="mt-4 flex items-center justify-between rounded-lg border border-[#dfe6ee] bg-white px-3 py-2.5 text-xs font-bold text-(--brand-navy)"><span className="flex items-center gap-2"><LockKeyhole size={14} /> Security settings</span><ArrowRight size={14} className="text-[#a1aec0]" /></Link></div>
        </DashboardCard>
      </div>

      <ProfileCompanySwitcher activeCompanyId={user.company?.id} />

      {user.roles.includes(USER_ROLES.INTERN) ? (
        <MyRoleCard service={InternService} />
      ) : null}
      {user.roles.includes(USER_ROLES.EMPLOYEE) ? (
        <MyRoleCard service={EmployeeService} />
      ) : null}
      {user.roles.includes(USER_ROLES.INVESTOR) ? (
        <RoleVerificationSummary
          title="Investor verification"
          href="/dashboard/investor/verification"
          load={InvestorService.getMyVerification}
        />
      ) : null}
      <DashboardCard title="Personal details" description="These details are used across your workspace and team profile.">
        <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2" noValidate>
          {error ? <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-(--status-danger) sm:col-span-2">{error}</p> : null}
          {message ? <p className="rounded-xl border border-[#bfeede] bg-[#f0fffa] p-3 text-sm text-[#008f69] sm:col-span-2">{message}</p> : null}
          <div className="sm:col-span-1">
            <label htmlFor="profile-name" className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[#71829e]">
              <UserRound size={14} className="text-[#1645a2]" /> Full name
            </label>
            <div className="rounded-xl border border-[#dfe6ee] bg-[#fbfcfe] px-3.5 py-1 transition focus-within:border-[#8eb3f5] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#eef4ff]"><input id="profile-name" className="h-10 w-full bg-transparent text-sm font-medium text-(--brand-navy) outline-none" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Your full name" /></div>
            <p className="mt-1.5 text-[11px] text-[#9aa9bd]">Shown to your team and in task assignments.</p>
          </div>
          <div className="sm:col-span-1">
            <label htmlFor="profile-phone" className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[#71829e]"><Phone size={14} className="text-[#1645a2]" /> Phone number
            </label>
            <div className="rounded-xl border border-[#dfe6ee] bg-[#fbfcfe] px-3.5 py-1 transition focus-within:border-[#8eb3f5] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#eef4ff]"><input id="profile-phone" className="h-10 w-full bg-transparent text-sm font-medium text-(--brand-navy) outline-none" value={form.phoneNumber} onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))} placeholder="Add a contact number" /></div>
            <p className="mt-1.5 text-[11px] text-[#9aa9bd]">Used for important workspace notifications.</p>
          </div>
          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between"><label htmlFor="profile-about" className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[#71829e]"><FileText size={14} className="text-[#1645a2]" /> Bio</label><span className="text-[11px] text-[#9aa9bd]">{form.about.length}/300</span></div>
            <textarea
              id="profile-about"
              rows={3}
              maxLength={300}
              placeholder="Describe what you work on and how you help the team..."
              className="w-full resize-none rounded-xl border border-[#dfe6ee] bg-[#fbfcfe] px-3.5 py-3 text-sm leading-6 text-(--brand-navy) outline-none transition focus:border-[#8eb3f5] focus:bg-white focus:ring-4 focus:ring-[#eef4ff]"
              value={form.about}
              onChange={(event) => setForm((current) => ({ ...current, about: event.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="profile-picture" className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[#71829e]"><ImageIcon size={14} className="text-[#1645a2]" /> Profile picture</label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#eef4ff] text-[#1645a2]">{form.profile_pic ? (// eslint-disable-next-line @next/next/no-img-element
              <img src={form.profile_pic} alt="Preview" className="h-full w-full object-cover" />
            ) : <ImageIcon size={22} />}</div><input
              id="profile-picture"
              type="url"
              className="h-12 w-full rounded-xl border border-[#dfe6ee] bg-[#fbfcfe] px-3.5 text-sm text-(--brand-navy) outline-none transition focus:border-[#8eb3f5] focus:bg-white focus:ring-4 focus:ring-[#eef4ff]"
              value={form.profile_pic}
              onChange={(event) => setForm((current) => ({ ...current, profile_pic: event.target.value }))}
            /></div><p className="mt-1.5 text-[11px] text-[#9aa9bd]">Use a secure image URL. This preview updates as you type.</p>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#00b982] px-6 text-sm font-bold text-white shadow-[0_6px_14px_rgba(0,185,130,0.18)] hover:bg-[#009f70] disabled:opacity-60 sm:col-span-2 sm:w-fit"
          >
            {pending ? (
              <>
                <LoaderCircle size={16} className="animate-spin" /> Saving...
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </form>
      </DashboardCard>
    </div>
  );
}
