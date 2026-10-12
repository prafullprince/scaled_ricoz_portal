"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { LeavePolicyService, type DepartmentLeavePolicy } from "@/services/leave.service";

const departments = ["PRODUCT", "MARKETING", "FINANCE", "SALES", "PROJECTS", "SUPPORT", "HR", "DESIGN", "ENGINEERING", "IT"];

export function LeavePolicyEditor({ onSaved }: { onSaved: () => void }) {
  const [policies, setPolicies] = useState<DepartmentLeavePolicy[]>([]);
  const [form, setForm] = useState<DepartmentLeavePolicy>({ department: "PRODUCT", earned: 0, sick: 0, casual: 0 });
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    LeavePolicyService.list().then((items) => { setPolicies(items); setForm(items.find((item) => item.department === "PRODUCT") ?? { department: "PRODUCT", earned: 0, sick: 0, casual: 0 }); setReady(true); }).catch(() => toast.error("Could not load leave policies"));
  }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      const policy = await LeavePolicyService.save(form);
      setPolicies((items) => [...items.filter((item) => item.department !== policy.department), policy]);
      toast.success("Annual leave policy saved"); onSaved();
    } catch { toast.error("Could not save leave policy"); } finally { setSaving(false); }
  }
  return <section className="border-y border-(--brand-border) py-5">
    <h2 className="mb-4 font-semibold">Annual Department Allowances</h2>
    <form onSubmit={save} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <label className="text-sm">Department<select disabled={!ready || saving} value={form.department} onChange={(event) => setForm(policies.find((item) => item.department === event.target.value) ?? { department: event.target.value, earned: 0, sick: 0, casual: 0 })} className="mt-1 w-full rounded-lg border border-(--brand-border) bg-(--brand-surface) p-2.5">{departments.map((department) => <option key={department}>{department}</option>)}</select></label>
      {(["earned", "sick", "casual"] as const).map((category) => <label key={category} className="text-sm capitalize">{category} Days<input type="number" required min={0} max={366} step={1} disabled={!ready || saving} value={form[category]} onChange={(event) => setForm({ ...form, [category]: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-(--brand-border) p-2.5" /></label>)}
      <button disabled={!ready || saving} className="flex items-center justify-center gap-2 rounded-lg bg-emerald-700 p-2.5 text-sm font-medium text-white disabled:opacity-50"><Save size={16} />{saving ? "Saving..." : "Save Policy"}</button>
    </form>
  </section>;
}