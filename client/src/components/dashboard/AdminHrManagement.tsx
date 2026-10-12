"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Plus, Search, ShieldCheck, SlidersHorizontal, Save, UserRoundCog, X } from "lucide-react";
import { AdminHrService, type HrManagerRecord } from "@/services/adminHr.service";
import { CompanyService, type Company } from "@/services/company.service";

type Candidate = { _id: string; name: string; email: string; profile_pic?: string };

export function AdminGovernanceOverview() {
  const [data, setData] = useState<Awaited<ReturnType<typeof AdminHrService.overview>> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    AdminHrService.overview().then((result) => { if (active) setData(result); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  return <section className="space-y-4 border-b border-(--brand-border) pb-6 text-(--brand-text)">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Administration overview</h2><div className="flex flex-wrap gap-4 text-sm font-semibold text-(--brand-red)"><Link href="/dashboard/companies">Companies</Link><Link href="/dashboard/users">All users</Link><Link href="/dashboard/admin/hr">HR & features</Link></div></div>
    {failed ? <p role="alert" className="text-sm text-(--status-danger)">Administration overview could not be loaded.</p> : <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[["Companies", data?.metrics.companies], ["Users", data?.metrics.users], ["Active HR", data?.metrics.activeHr], ["HR company assignments", data?.metrics.assignments]].map(([label, value]) => <div key={label} className="min-w-0 border-l-2 border-(--brand-border) pl-3"><p className="text-xs text-(--brand-text-secondary)">{label}</p><p className="mt-1 text-2xl font-semibold">{value ?? "--"}</p></div>)}</div>}
    <details><summary className="cursor-pointer text-sm font-semibold">Recent access changes</summary><ul className="mt-3 max-h-64 divide-y divide-(--brand-border) overflow-y-auto">{data?.audit.map((entry) => <li key={entry._id} className="flex flex-wrap justify-between gap-2 py-3 text-xs"><span className="min-w-0 break-words"><strong>{entry.action.replaceAll("_", " ")}</strong><span className="block text-(--brand-text-secondary)">{entry.actorId?.name ?? "Removed user"}{entry.targetUserId ? ` / ${entry.targetUserId.name}` : ""}{entry.companyId ? ` / ${entry.companyId.name}` : ""}</span></span><span className="text-(--brand-text-secondary)">{entry.status} / {new Date(entry.createdAt).toLocaleString()}</span></li>)}</ul></details>
  </section>;
}

export function AdminHrManagement() {
  const [hr, setHr] = useState<HrManagerRecord[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [featureEditor, setFeatureEditor] = useState<{ userId: string; companyId: string; title: string; permissions: string[] } | null>(null);
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof AdminHrService.features>> | null>(null);
  const [featureSearch, setFeatureSearch] = useState("");

  async function editFeatures(record: HrManagerRecord, company: NonNullable<HrManagerRecord["managedCompanies"][number]>) {
    try {
      const data = catalog ?? await AdminHrService.features();
      setCatalog(data);
      setFeatureSearch("");
      setFeatureEditor({ userId: record.user!._id, companyId: company._id, title: `${record.user!.name} / ${company.name}`, permissions: record.companyPermissions?.find((entry) => entry.companyId === company._id)?.permissions ?? data.defaultHrPermissions });
    } catch { setError("Feature catalog could not be loaded."); }
  }

  async function load() {
    try {
      const [managers, companyList] = await Promise.all([AdminHrService.list(), CompanyService.list()]);
      setHr(managers);
      setCompanies(companyList);
      setError("");
    } catch {
      setError("HR management data could not be loaded.");
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([AdminHrService.list(), CompanyService.list()]).then(([managers, companyList]) => {
      if (!active) return;
      setHr(managers);
      setCompanies(companyList);
    }).catch(() => { if (active) setError("HR management data could not be loaded."); });
    return () => { active = false; };
  }, []);

  async function searchUsers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { setCandidates(await AdminHrService.candidates(search.trim())); }
    catch { setError("User search could not be completed."); }
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try { await action(); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The HR change could not be saved."); }
    finally { setBusy(false); }
  }

  const designatedIds = new Set(hr.map((record) => record.user?._id).filter(Boolean));

  return <main className="mx-auto max-w-5xl space-y-6">
    <header className="flex items-start gap-3 border-b border-(--brand-border) pb-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-(--brand-red-pale) text-(--brand-red)"><ShieldCheck size={19}/></span>
      <div><h1 className="text-xl font-semibold text-(--brand-text)">HR Management</h1><p className="mt-1 text-sm text-(--brand-text-secondary)">Designate system HR and assign company scope. Each HR limit is enforced by the server.</p></div>
    </header>
    {error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="space-y-4">
        <div><h2 className="text-sm font-semibold text-(--brand-text)">Assign system HR</h2><p className="mt-1 text-xs text-(--brand-text-secondary)">Only active non-ADMIN accounts can be designated.</p></div>
        <form onSubmit={searchUsers} className="flex gap-2">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-(--brand-border) px-3"><Search size={15} className="shrink-0 text-(--brand-text-muted)"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email" className="min-w-0 flex-1 text-sm outline-none"/></label>
          <button type="submit" className="h-10 rounded-md bg-(--brand-navy) px-3 text-sm font-semibold text-white">Search</button>
        </form>
        <ul className="divide-y divide-(--brand-border) border-y border-(--brand-border)">
          {candidates.filter((candidate) => !designatedIds.has(candidate._id)).map((candidate) => <li key={candidate._id} className="flex items-center gap-3 py-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-(--brand-surface-hover) text-sm font-semibold text-(--brand-text-secondary)">{candidate.name.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{candidate.name}</span><span className="block truncate text-xs text-(--brand-text-secondary)">{candidate.email}</span></span><button type="button" disabled={busy} onClick={() => void run(() => AdminHrService.designate(candidate._id))} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-(--brand-border) px-2.5 text-xs font-semibold hover:bg-(--brand-surface-hover) disabled:opacity-50"><Plus size={14}/>Assign</button></li>)}
          {!candidates.length ? <li className="py-5 text-center text-xs text-(--brand-text-muted)">Search for an active user to designate.</li> : null}
        </ul>
      </div>
      <div className="space-y-4">
        <div><h2 className="text-sm font-semibold text-(--brand-text)">Designated HR</h2><p className="mt-1 text-xs text-(--brand-text-secondary)">Companies must be explicitly assigned; deactivation requires removing them first.</p></div>
        <div className="divide-y divide-(--brand-border) border-y border-(--brand-border)">
          {hr.map((record) => {
            if (!record.user) return null;
            const id = record.user._id;
            const assignedIds = new Set(record.managedCompanies.map((company) => company?._id).filter(Boolean));
            const available = companies.filter((company) => !assignedIds.has(company.id));
            return <section key={id} className="py-4">
              <div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700"><UserRoundCog size={17}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{record.user?.name}</h3><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${record.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{record.active ? "Active" : "Inactive"}</span></div><p className="mt-0.5 text-xs text-(--brand-text-secondary)">{record.user?.email} · {record.assignedCompanyCount} / {record.maxCompanies} companies</p></div><button type="button" aria-label={record.active ? "Deactivate HR" : "Activate HR"} title={record.active ? "Deactivate HR" : "Activate HR"} disabled={busy || (record.active && record.assignedCompanyCount > 0)} onClick={() => void run(() => AdminHrService.setActive(id, !record.active))} className="flex size-8 items-center justify-center rounded-md text-(--brand-text-muted) hover:bg-(--brand-surface-hover) disabled:opacity-40">{record.active ? <X size={16}/> : <ShieldCheck size={16}/>}</button></div>
              {record.active ? <div className="mt-3 flex gap-2"><select aria-label={`Choose a company for ${record.user.name}`} value={selectedCompanies[id] ?? ""} onChange={(event) => setSelectedCompanies((current) => ({ ...current, [id]: event.target.value }))} className="h-9 min-w-0 flex-1 rounded-md border border-(--brand-border) bg-white px-2 text-xs"><option value="">Assign company...</option>{available.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select><button type="button" disabled={busy || !selectedCompanies[id] || record.assignedCompanyCount >= record.maxCompanies} onClick={() => { const companyId = selectedCompanies[id]; if (companyId) void run(() => AdminHrService.assignCompany(id, companyId)); }} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-(--brand-navy) px-3 text-xs font-semibold text-white disabled:opacity-40"><Plus size={14}/>Assign</button></div> : null}
              {record.managedCompanies.length ? <ul className="mt-3 space-y-1.5">{record.managedCompanies.map((company) => company ? <li key={company._id} className="flex items-center gap-2 rounded-md bg-(--brand-surface) px-2.5 py-2 text-xs"><Building2 size={14} className="text-(--brand-text-muted)"/><span className="min-w-0 flex-1 truncate">{company.name}</span><button type="button" disabled={busy} title="Edit company features" aria-label={`Edit features for ${company.name}`} onClick={() => void editFeatures(record, company)} className="flex size-8 items-center justify-center rounded hover:bg-(--brand-surface-hover)"><SlidersHorizontal size={15}/></button><button type="button" disabled={busy} onClick={() => void run(() => AdminHrService.removeCompany(id, company._id))} className="rounded px-2 py-1 font-semibold text-(--brand-red) hover:bg-(--brand-surface-hover)">Remove</button></li> : null)}</ul> : null}
            </section>;
          })}
          {!hr.length ? <p className="py-7 text-center text-xs text-(--brand-text-muted)">No system HR designations yet.</p> : null}
        </div>
      </div>
    </section>
    {featureEditor && catalog ? <section aria-label="Company feature access" className="space-y-4 border-t border-(--brand-border) pt-5">
      <div className="flex items-center justify-between gap-3"><h2 className="min-w-0 break-words text-sm font-semibold">{featureEditor.title}</h2><button type="button" aria-label="Close feature editor" title="Close feature editor" onClick={() => setFeatureEditor(null)} className="p-2"><X size={18}/></button></div>
      <div className="flex flex-wrap items-center gap-4"><input aria-label="Search features" placeholder="Search features" value={featureSearch} onChange={(event) => setFeatureSearch(event.target.value)} className="h-10 min-w-0 rounded-md border border-(--brand-border) bg-(--brand-surface) px-3 text-sm text-(--brand-text)"/><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={catalog.features.every((feature) => featureEditor.permissions.includes(feature.key))} onChange={(event) => setFeatureEditor({ ...featureEditor, permissions: event.target.checked ? catalog.features.map((feature) => feature.key) : [] })}/>Select all features</label><span className="text-xs text-(--brand-text-secondary)">{featureEditor.permissions.length} selected</span></div>
      <div className="grid max-h-96 gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{catalog.features.filter((feature) => feature.name.includes(featureSearch.toLowerCase())).map((feature) => <label key={feature.key} className="flex items-start gap-2 text-sm capitalize"><input type="checkbox" className="mt-1" checked={featureEditor.permissions.includes(feature.key)} onChange={(event) => setFeatureEditor({ ...featureEditor, permissions: event.target.checked ? [...featureEditor.permissions, feature.key] : featureEditor.permissions.filter((key) => key !== feature.key) })}/>{feature.name}</label>)}</div>
      <button type="button" disabled={busy} onClick={() => void run(async () => { await AdminHrService.setFeatures(featureEditor.userId, featureEditor.companyId, featureEditor.permissions); setFeatureEditor(null); })} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-(--brand-red) px-4 text-sm font-semibold text-white disabled:opacity-50"><Save size={16}/>Save feature access</button>
    </section> : null}
  </main>;
}