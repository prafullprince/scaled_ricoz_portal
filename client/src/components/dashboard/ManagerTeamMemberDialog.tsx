"use client";

import { useEffect, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { RecruitmentService, type TeamMemberOnboardingInput } from "@/services/recruitment.service";
import { OrganizationService, type OrganizationUser } from "@/services/organization.service";
import { useAppSelector } from "@/redux/hooks";

const inputClass = "h-11 w-full rounded-md border border-(--brand-border) bg-white px-3 text-sm outline-none focus:border-(--brand-red)";
const textareaClass = "w-full rounded-md border border-(--brand-border) bg-white p-3 text-sm outline-none focus:border-(--brand-red)";
const departments = ["PRODUCT", "MARKETING", "FINANCE", "SALES", "PROJECTS", "SUPPORT", "HR", "DESIGN", "ENGINEERING", "IT"];
const emptyForm: TeamMemberOnboardingInput = {
  accountType: "intern",
  name: "",
  email: "",
  temporaryPassword: "",
  phoneNumber: "",
  designation: "",
  joiningDate: "",
  endDate: "",
  employmentType: null,
  linkedInUrl: "",
  address: "",
};

export function ManagerTeamMemberDialog({ onSuccess, department: fixedDepartment, onBeforeOpen, compact = false, initialOpen = false }: { onSuccess?: () => void; department?: string; onBeforeOpen?: () => void; compact?: boolean; initialOpen?: boolean }) {
  const user = useAppSelector((state) => state.auth.user);
  const executive = Boolean(user?.roles.some((role) => role === "CEO" || role === "ADMIN"));
  const systemHr = Boolean(user?.system_roles?.includes("HR"));
  const hrHead = !executive && user?.organization_department === "HR" && user.roles.some((role) => role === "HR_HEAD" || role === "HEAD");
  const hasDepartmentLeadershipRole = Boolean(user?.roles.some((role) => role === "HEAD" || role === "MANAGER" || role.endsWith("_HEAD") || role.endsWith("_MANAGER")));
  const companyHr = Boolean(!executive && ((user?.roles.includes("HR") && !hasDepartmentLeadershipRole) || systemHr));
  const canChooseDepartment = executive || companyHr;
  const canChooseManager = canChooseDepartment || hrHead;
  const [open, setOpen] = useState(initialOpen);
  const [form, setForm] = useState(emptyForm);
  const [department, setDepartment] = useState(fixedDepartment ?? user?.organization_department ?? "PRODUCT");
  const [managers, setManagers] = useState<OrganizationUser[]>([]);
  const [reportsTo, setReportsTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open || !canChooseManager) return;
    let active = true;
    OrganizationService.reportingOptions("MEMBER", department)
      .then((options) => {
        if (!active) return;
        setManagers(options);
        setReportsTo(options.length === 1 ? options[0]._id : "");
      })
      .catch(() => {
        if (active) {
          setManagers([]);
          setReportsTo("");
        }
      });
    return () => { active = false; };
  }, [department, canChooseManager, open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const result = await RecruitmentService.onboardTeamMember({
        ...form,
        ...(canChooseManager ? { department, reportsTo } : {}),
        endDate: form.endDate || null,
        employmentType: form.accountType === "employee" ? form.employmentType : null,
        linkedInUrl: form.linkedInUrl || undefined,
      });
      setMessage(result.accountCreated ? "Account created and added to the reporting team." : "Existing account added to the reporting team.");
      setForm(emptyForm);
      onSuccess?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add the team member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" aria-label="Add team member" title="Add team member" onClick={() => { onBeforeOpen?.(); setOpen(true); setMessage(""); }} className={`inline-flex items-center justify-center gap-2 rounded-md border border-(--brand-border) bg-white font-bold text-(--brand-navy) hover:border-(--brand-red) ${compact ? "h-9 px-2 text-xs" : "h-11 px-4 text-sm"}`}>
        <UserPlus size={compact ? 15 : 17} />{compact ? "Add" : "Add team member"}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0b1729]/55 p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="team-member-title" className="mx-auto my-8 max-w-3xl rounded-md bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-(--brand-border) p-6">
              <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-(--brand-red)">Team onboarding</p><h2 id="team-member-title" className="mt-2 text-xl font-bold text-(--brand-navy)">Add intern or employee</h2><p className="mt-1 text-sm text-(--brand-text-secondary)">Choose the account type and reporting line for this member.</p></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close dialog" className="rounded-md p-2 text-(--brand-text-muted) hover:bg-(--brand-surface)"><X size={18} /></button>
            </header>
            <form onSubmit={submit} className="space-y-5 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                {canChooseDepartment ? <Field label="Department"><select required value={department} onChange={(event) => setDepartment(event.target.value)} className={inputClass}>{departments.map((item) => <option key={item} value={item}>{item[0]}{item.slice(1).toLowerCase()}</option>)}</select></Field> : null}
                {canChooseManager ? <Field label="Reports to"><select required value={reportsTo} onChange={(event) => setReportsTo(event.target.value)} className={inputClass}><option value="">{managers.length ? "Select an active department Manager" : "No active department Manager"}</option>{managers.map((manager) => <option key={manager._id} value={manager._id}>{manager.name}</option>)}</select></Field> : null}
                <Field label="Account type"><select value={form.accountType} onChange={(event) => setForm({ ...form, accountType: event.target.value as "intern" | "employee", employmentType: null, endDate: "" })} className={inputClass}><option value="intern">Intern</option><option value="employee">Employee</option></select></Field>
                <Field label="Designation"><input required value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} className={inputClass} placeholder="Frontend Developer" /></Field>
                <Field label="Full name"><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} placeholder="Aarav Sharma" /></Field>
                <Field label="Work email"><input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={inputClass} placeholder="aarav@example.com" /></Field>
                <Field label="Phone number"><input required value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} className={inputClass} placeholder="+91 98765 43210" /></Field>
                <Field label="Temporary password"><input required type="password" minLength={8} value={form.temporaryPassword} onChange={(event) => setForm({ ...form, temporaryPassword: event.target.value })} className={inputClass} placeholder="Minimum 8 characters" /></Field>
                <Field label="Joining date"><input required type="date" value={form.joiningDate} onChange={(event) => setForm({ ...form, joiningDate: event.target.value })} className={inputClass} /></Field>
                {form.accountType === "intern" ? <Field label="Internship end date"><input required type="date" min={form.joiningDate || undefined} value={form.endDate ?? ""} onChange={(event) => setForm({ ...form, endDate: event.target.value })} className={inputClass} /></Field> : <Field label="Employment type"><select required value={form.employmentType ?? ""} onChange={(event) => setForm({ ...form, employmentType: event.target.value as "FULL_TIME" | "PART_TIME" | "CONTRACT" })} className={inputClass}><option value="">Select type</option><option value="FULL_TIME">Full time</option><option value="PART_TIME">Part time</option><option value="CONTRACT">Contract</option></select></Field>}
                <Field label="LinkedIn URL (optional)"><input type="url" value={form.linkedInUrl ?? ""} onChange={(event) => setForm({ ...form, linkedInUrl: event.target.value })} className={inputClass} placeholder="https://linkedin.com/in/..." /></Field>
                <Field label="Address"><textarea required rows={3} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className={textareaClass} placeholder="Current residential address" /></Field>
              </div>
              {message ? <p role="status" className="rounded-md bg-(--brand-surface) px-3 py-2 text-sm font-semibold text-(--brand-navy)">{message}</p> : null}
              <button disabled={saving || (canChooseManager && !reportsTo)} type="submit" className="h-11 w-full rounded-md bg-(--brand-red) text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Add member"}</button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-bold text-(--brand-navy)">{label}<span className="mt-2 block">{children}</span></label>;
}