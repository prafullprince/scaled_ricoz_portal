"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Download, FileText, LoaderCircle, Plus, Save, WalletCards, X } from "lucide-react";
import {
  HrFinanceService,
  type EmployeeFinanceDetails,
  type FinanceEmployee,
  type PayComponent,
  type PayComponentType,
  type PayrollAdjustment,
  type PayrollAdjustmentType,
} from "@/services/hr-finance.service";
import { HrEmployeePayouts } from "./HrEmployeePayouts";

type DraftComponent = Omit<PayComponent, "amount"> & { amount: string };
type StructureDraft = {
  effectiveFrom: string;
  currency: string;
  reason: string;
  components: DraftComponent[];
};

const componentTypes: Array<{ value: PayComponentType; label: string }> = [
  { value: "BASE", label: "Base salary" },
  { value: "ALLOWANCE", label: "Allowance" },
  { value: "BONUS", label: "Bonus" },
  { value: "INCENTIVE", label: "Incentive" },
  { value: "DEDUCTION", label: "Deduction" },
  { value: "OTHER", label: "Other" },
];
const adjustmentTypes: Array<{ value: PayrollAdjustmentType; label: string }> = [
  { value: "BONUS", label: "Bonus" },
  { value: "INCENTIVE", label: "Incentive" },
  { value: "DEDUCTION", label: "Deduction" },
];
const inputClass = "h-10 w-full rounded-lg border border-[#d8e1ed] bg-white px-3 text-sm text-[#17233a] outline-none focus:border-[#1645a2] focus:ring-2 focus:ring-[#1645a2]/10";
const cardClass = "rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm sm:p-5";
const currentPeriod = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);
const amountLabel = (amount: number, currency: string, cadence?: string) =>
  `${currency} ${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}${cadence ? ` / ${cadence.toLowerCase()}` : ""}`;

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function createDraft(profile: EmployeeFinanceDetails["salaryStructure"]): StructureDraft {
  return {
    effectiveFrom: profile ? new Date(profile.effectiveFrom).toISOString().slice(0, 10) : today(),
    currency: profile?.currency ?? "INR",
    reason: "",
    components: profile?.components.map((component) => ({
      ...component,
      amount: String(component.amount),
    })) ?? [{ type: "BASE", label: "Base salary", amount: "", cadence: "MONTHLY" }],
  };
}

export function HrFinanceWorkspace() {
  const [employees, setEmployees] = useState<FinanceEmployee[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [employeeData, setEmployeeData] = useState<EmployeeFinanceDetails | null>(null);
  const [structureDraft, setStructureDraft] = useState<StructureDraft>(() => createDraft(null));
  const [adjustment, setAdjustment] = useState({
    type: "BONUS" as PayrollAdjustmentType,
    label: "",
    amount: "",
    currency: "INR",
    note: "",
  });
  const [payslipPeriod, setPayslipPeriod] = useState(currentPeriod());
  const [search, setSearch] = useState("");
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selectedEmployeeId = useRef("");

  const loadEmployees = useCallback(async () => {
    try {
      const result = await HrFinanceService.employees();
      setEmployees(result);
      setError("");
      if (!selectedEmployeeId.current && result[0]?.id) {
        selectedEmployeeId.current = result[0].id;
        setLoadingDetails(true);
        setSelectedId(result[0].id);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load company employees.");
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  const loadEmployee = useCallback(async (employeeId: string) => {
    try {
      const result = await HrFinanceService.employee(employeeId);
      setEmployeeData(result);
      setStructureDraft(createDraft(result.salaryStructure));
      setAdjustment((current) => ({
        ...current,
        currency: result.salaryStructure?.currency ?? "INR",
      }));
      setError("");
    } catch (reason) {
      setEmployeeData(null);
      setError(reason instanceof Error ? reason.message : "Unable to load the employee finance record.");
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    HrFinanceService.employees()
      .then((result) => {
        if (!active) return;
        setEmployees(result);
        setError("");
        if (!selectedEmployeeId.current && result[0]?.id) {
          selectedEmployeeId.current = result[0].id;
          setLoadingDetails(true);
          setSelectedId(result[0].id);
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load company employees.");
      })
      .finally(() => {
        if (active) setLoadingEmployees(false);
      });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    HrFinanceService.employee(selectedId)
      .then((result) => {
        if (!active) return;
        setEmployeeData(result);
        setStructureDraft(createDraft(result.salaryStructure));
        setAdjustment((current) => ({
          ...current,
          currency: result.salaryStructure?.currency ?? "INR",
        }));
        setError("");
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setEmployeeData(null);
        setError(reason instanceof Error ? reason.message : "Unable to load the employee finance record.");
      })
      .finally(() => {
        if (active) setLoadingDetails(false);
      });
    return () => { active = false; };
  }, [selectedId]);

  const visibleEmployees = useMemo(
    () => employees.filter((employee) =>
      `${employee.name} ${employee.email} ${employee.department ?? ""}`.toLowerCase().includes(search.toLowerCase()),
    ),
    [employees, search],
  );

  async function saveStructure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    const components = structureDraft.components.map((component) => ({
      ...component,
      label: component.label.trim(),
      amount: Number(component.amount),
    }));
    if (components.some((component) => !component.label || component.amount < 0 || !Number.isFinite(component.amount))) {
      setError("Enter a label and valid non-negative amount for every salary component.");
      return;
    }
    setSaving("structure");
    setError("");
    setNotice("");
    try {
      await HrFinanceService.saveStructure(selectedId, {
        effectiveFrom: structureDraft.effectiveFrom,
        currency: structureDraft.currency.trim().toUpperCase(),
        reason: structureDraft.reason.trim(),
        components,
      });
      await Promise.all([loadEmployee(selectedId), loadEmployees()]);
      setNotice("Salary structure saved and added to revision history.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save the salary structure.");
    } finally {
      setSaving("");
    }
  }

  async function addAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    setSaving("adjustment");
    setError("");
    setNotice("");
    try {
      await HrFinanceService.addAdjustment(selectedId, {
        ...adjustment,
        payPeriod: payslipPeriod,
        label: adjustment.label.trim(),
        amount: Number(adjustment.amount),
        currency: adjustment.currency.trim().toUpperCase(),
        note: adjustment.note.trim(),
      });
      await loadEmployee(selectedId);
      setAdjustment((current) => ({ ...current, label: "", amount: "", note: "" }));
      setNotice("Payroll item added.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to add the payroll item.");
    } finally {
      setSaving("");
    }
  }

  async function generatePayslip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || !employeeData?.salaryStructure) {
      setError("Save a salary structure before generating a payslip.");
      return;
    }
    setSaving("payslip");
    setError("");
    setNotice("");
    try {
      await HrFinanceService.generatePayslip(selectedId, payslipPeriod);
      await loadEmployee(selectedId);
      setNotice(`Payslip for ${payslipPeriod} generated and published to the employee.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to generate the payslip.");
    } finally {
      setSaving("");
    }
  }

  async function downloadPayslip(payslipId: string, fileName: string) {
    setSaving(`download-${payslipId}`);
    setError("");
    try {
      downloadBlob(await HrFinanceService.payslipFile(payslipId), fileName);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to download the payslip.");
    } finally {
      setSaving("");
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-[#dbe5f1] bg-[linear-gradient(120deg,#fff_0%,#f3f7ff_100%)] p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-[#eaf1ff] p-2.5 text-[#1645a2]"><WalletCards size={19}/></span>
          <div>
            <h2 className="text-sm font-extrabold text-[#17233a]">Company finance records</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[#657795]">
              Manage compensation, revisions, payroll adjustments, and generated payslips for people in the active company, including organization leaders, employees, and interns. No tax or statutory withholding is calculated.
            </p>
          </div>
        </div>
      </div>

      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
        <aside className={cardClass}>
          <h3 className="text-sm font-bold">People</h3>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees" className={`${inputClass} mt-3`}/>
          {loadingEmployees ? <p role="status" className="py-6 text-center text-xs text-[#7183a0]">Loading employees…</p> : null}
          {!loadingEmployees && !visibleEmployees.length ? <p className="py-6 text-center text-xs text-[#7183a0]">{employees.length ? "No people match your search." : "No active people in this company."}</p> : null}
          <ul className="mt-3 max-h-[580px] space-y-1 overflow-y-auto">
            {visibleEmployees.map((employee) => (
              <li key={employee.id}>
                <button
                  type="button"
                  aria-current={selectedId === employee.id ? "true" : undefined}
                  onClick={() => {
                    if (selectedId !== employee.id) {
                      selectedEmployeeId.current = employee.id;
                      setLoadingDetails(true);
                      setSelectedId(employee.id);
                    }
                  }}
                  className={`w-full rounded-lg border px-3 py-3 text-left transition ${selectedId === employee.id ? "border-[#a9c0ef] bg-[#f1f5ff]" : "border-transparent hover:border-[#e2e8f0] hover:bg-[#f8fafc]"}`}
                >
                  <span className="block truncate text-xs font-bold text-[#17233a]">{employee.name}</span>
                  <span className="mt-1 block truncate text-[10px] text-[#7183a0]">{employee.department ?? "Unassigned"} · {employee.role.toLowerCase().replaceAll("_", " ")}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="min-w-0 space-y-4">
          {loadingDetails ? <div role="status" className={`${cardClass} py-10 text-center text-sm text-[#7183a0]`}>Loading employee finance record…</div> : null}
          {!loadingDetails && !employeeData ? <div className={`${cardClass} py-10 text-center`}><FileText size={22} className="mx-auto text-[#94a3b8]"/><p className="mt-2 text-sm font-semibold text-[#34445f]">Select an employee to manage finance records</p></div> : null}
          {!loadingDetails && employeeData ? (
            <>
              <section className={cardClass}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold">{employeeData.employee.name}</h3>
                    <p className="mt-1 text-xs text-[#657795]">{employeeData.employee.email} · {employeeData.employee.department ?? "Unassigned"} · {employeeData.employee.role.toLowerCase().replaceAll("_", " ")}</p>
                  </div>
                  <span className="rounded-full bg-[#f1f5ff] px-3 py-1.5 text-[10px] font-bold uppercase text-[#1645a2]">{employeeData.salaryStructure ? "Structure on file" : "No structure yet"}</span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {employeeData.salaryStructure?.components.map((component, index) => (
                    <div key={`${component.label}-${index}`} className="rounded-lg border border-[#e5eaf1] bg-[#fafcff] px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7183a0]">{component.type.replaceAll("_", " ")}</p>
                      <p className="mt-1 text-xs font-semibold text-[#34445f]">{component.label}</p>
                      <p className="mt-1 text-sm font-extrabold text-[#17233a]">{amountLabel(component.amount, employeeData.salaryStructure!.currency, component.cadence)}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className={cardClass}>
                <div className="mb-4">
                  <h3 className="text-sm font-bold">Salary structure</h3>
                  <p className="mt-1 text-[11px] text-[#7183a0]">Saving creates a permanent revision entry. Use company-defined components and amounts.</p>
                </div>
                <form onSubmit={saveStructure} className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="text-xs font-semibold">Effective from<input required type="date" value={structureDraft.effectiveFrom} onChange={(event) => setStructureDraft((current) => ({ ...current, effectiveFrom: event.target.value }))} className={`${inputClass} mt-1.5`}/></label>
                    <label className="text-xs font-semibold">Currency code<input required maxLength={3} value={structureDraft.currency} onChange={(event) => setStructureDraft((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} placeholder="INR" className={`${inputClass} mt-1.5`}/></label>
                    <label className="text-xs font-semibold">Revision reason<input maxLength={500} value={structureDraft.reason} onChange={(event) => setStructureDraft((current) => ({ ...current, reason: event.target.value }))} placeholder="Annual review, promotion…" className={`${inputClass} mt-1.5`}/></label>
                  </div>
                  <div className="space-y-2">
                    {structureDraft.components.map((component, index) => (
                      <div key={index} className="grid gap-2 rounded-lg bg-[#f8fafc] p-3 sm:grid-cols-[1.1fr_1.5fr_1fr_1fr_auto]">
                        <select aria-label={`Component type ${index + 1}`} value={component.type} onChange={(event) => setStructureDraft((current) => ({ ...current, components: current.components.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as PayComponentType } : item) }))} className={inputClass}>
                          {componentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                        </select>
                        <input aria-label={`Component name ${index + 1}`} required maxLength={100} value={component.label} onChange={(event) => setStructureDraft((current) => ({ ...current, components: current.components.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} placeholder="Component name" className={inputClass}/>
                        <input aria-label={`Component amount ${index + 1}`} required type="number" min={0} step="0.01" value={component.amount} onChange={(event) => setStructureDraft((current) => ({ ...current, components: current.components.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value } : item) }))} placeholder="Amount" className={inputClass}/>
                        <select aria-label={`Component cadence ${index + 1}`} value={component.cadence} onChange={(event) => setStructureDraft((current) => ({ ...current, components: current.components.map((item, itemIndex) => itemIndex === index ? { ...item, cadence: event.target.value as PayComponent["cadence"] } : item) }))} className={inputClass}><option value="MONTHLY">Monthly</option><option value="ANNUAL">Annual</option></select>
                        <button type="button" disabled={structureDraft.components.length === 1} onClick={() => setStructureDraft((current) => ({ ...current, components: current.components.filter((_, itemIndex) => itemIndex !== index) }))} aria-label={`Remove component ${index + 1}`} className="flex h-10 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white px-3 text-[#7183a0] hover:text-red-600 disabled:opacity-30"><X size={15}/></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setStructureDraft((current) => ({ ...current, components: [...current.components, { type: "ALLOWANCE", label: "", amount: "", cadence: "MONTHLY" }] }))} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d8e1ed] px-3 text-xs font-semibold text-[#34445f] hover:bg-[#f8fafc]"><Plus size={14}/>Add component</button>
                  </div>
                  <button disabled={Boolean(saving)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1645a2] px-4 text-xs font-bold text-white disabled:opacity-60">{saving === "structure" ? <LoaderCircle size={14} className="animate-spin"/> : <Save size={14}/>}Save revision</button>
                </form>
              </section>

              <div className="grid gap-4 2xl:grid-cols-2">
                <section className={cardClass}>
                  <h3 className="text-sm font-bold">Bonuses, incentives &amp; deductions</h3>
                  <p className="mt-1 text-[11px] text-[#7183a0]">Record a manual adjustment in the salary structure currency. Bonuses and incentives increase gross pay; deductions reduce net pay when the payslip is generated. No tax is calculated.</p>
                  <form onSubmit={addAdjustment} className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold">Type<select value={adjustment.type} onChange={(event) => setAdjustment((current) => ({ ...current, type: event.target.value as PayrollAdjustmentType }))} className={`${inputClass} mt-1.5`}>{adjustmentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
                    <label className="text-xs font-semibold">Pay period<input required type="month" value={payslipPeriod} onChange={(event) => setPayslipPeriod(event.target.value)} className={`${inputClass} mt-1.5`}/></label>
                    <label className="text-xs font-semibold">Description<input required maxLength={100} value={adjustment.label} onChange={(event) => setAdjustment((current) => ({ ...current, label: event.target.value }))} placeholder="Quarterly performance bonus" className={`${inputClass} mt-1.5`}/></label>
                    <div className="grid grid-cols-[1fr_78px] gap-2">
                      <label className="text-xs font-semibold">Amount<input required type="number" min={0.01} step="0.01" value={adjustment.amount} onChange={(event) => setAdjustment((current) => ({ ...current, amount: event.target.value }))} className={`${inputClass} mt-1.5`}/></label>
                      <label className="text-xs font-semibold">Currency<input required maxLength={3} readOnly={Boolean(employeeData.salaryStructure)} value={employeeData.salaryStructure?.currency ?? adjustment.currency} onChange={(event) => setAdjustment((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} className={`${inputClass} mt-1.5 read-only:bg-[#f8fafc]`}/></label>
                    </div>
                    <label className="text-xs font-semibold sm:col-span-2">Note (optional)<input maxLength={500} value={adjustment.note} onChange={(event) => setAdjustment((current) => ({ ...current, note: event.target.value }))} className={`${inputClass} mt-1.5`}/></label>
                    <button disabled={Boolean(saving) || !employeeData.salaryStructure} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#1645a2] px-4 text-xs font-bold text-white disabled:opacity-60 sm:col-span-2">{saving === "adjustment" ? <LoaderCircle size={14} className="animate-spin"/> : <Plus size={14}/>}Add payroll item</button>
                  </form>
                  <AdjustmentList items={employeeData.adjustments}/>
                </section>

                <section className={cardClass}>
                  <h3 className="text-sm font-bold">Payslips</h3>
                  <p className="mt-1 text-[11px] leading-5 text-[#7183a0]">Generate a monthly PDF from the structure active on the first day of the pay period and that period’s adjustments. Annual components are divided by 12; no tax is calculated. Generating again replaces and republishes that period’s payslip.</p>
                  <form onSubmit={generatePayslip} className="mt-4 space-y-3">
                    <label className="block max-w-xs text-xs font-semibold">Pay period<input required type="month" value={payslipPeriod} onChange={(event) => setPayslipPeriod(event.target.value)} className={`${inputClass} mt-1.5`}/></label>
                    {!employeeData.salaryStructure ? <p className="text-xs text-[#7183a0]">Save a salary structure before generating a payslip.</p> : <p className="text-xs text-[#7183a0]">Payslip currency: {employeeData.salaryStructure.currency}</p>}
                    <button disabled={Boolean(saving) || !employeeData.salaryStructure} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1645a2] px-4 text-xs font-bold text-white disabled:opacity-60">{saving === "payslip" ? <LoaderCircle size={14} className="animate-spin"/> : <FileText size={14}/>}Generate &amp; publish payslip</button>
                  </form>
                  <PayslipList items={employeeData.payslips} busy={saving} onDownload={downloadPayslip}/>
                </section>
              </div>

              <HrEmployeePayouts key={selectedId} employeeId={selectedId}/>
              <RevisionHistory details={employeeData}/>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AdjustmentList({ items }: { items: PayrollAdjustment[] }) {
  if (!items.length) return <p className="mt-5 border-t border-[#edf1f6] pt-4 text-xs text-[#7183a0]">No payroll adjustments recorded.</p>;
  return <ul className="mt-5 divide-y divide-[#edf1f6] border-t border-[#edf1f6]">{items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><p className="text-xs font-semibold">{item.label}</p><p className="mt-1 text-[10px] text-[#7183a0]">{item.type.toLowerCase()} · {item.payPeriod}{item.note ? ` · ${item.note}` : ""}</p></div><span className={`text-xs font-bold ${item.type === "DEDUCTION" ? "text-rose-700" : "text-emerald-700"}`}>{amountLabel(item.amount, item.currency)}</span></li>)}</ul>;
}

function PayslipList({ items, busy, onDownload }: { items: EmployeeFinanceDetails["payslips"]; busy: string; onDownload: (id: string, fileName: string) => void }) {
  if (!items.length) return <p className="mt-5 border-t border-[#edf1f6] pt-4 text-xs text-[#7183a0]">No payslips published for this employee.</p>;
  return <ul className="mt-5 divide-y divide-[#edf1f6] border-t border-[#edf1f6]">{items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div className="flex min-w-0 items-center gap-2"><FileText size={15} className="shrink-0 text-[#1645a2]"/><div className="min-w-0"><p className="text-xs font-semibold">{item.payPeriod} · {item.fileName}</p><p className="mt-1 text-[10px] text-[#7183a0]">{item.currency} · {(item.fileSize / 1024).toFixed(0)} KB · published {new Date(item.publishedAt).toLocaleDateString()}</p></div></div><button type="button" disabled={Boolean(busy)} onClick={() => onDownload(item.id, item.fileName)} aria-label={`Download ${item.payPeriod} payslip`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#d8e1ed] px-2.5 text-[10px] font-bold text-[#34445f] hover:bg-[#f8fafc] disabled:opacity-50">{busy === `download-${item.id}` ? <LoaderCircle size={13} className="animate-spin"/> : <Download size={13}/>}Download</button></li>)}</ul>;
}

function RevisionHistory({ details }: { details: EmployeeFinanceDetails }) {
  if (!details.revisionHistory.length) return null;
  return <details className={cardClass}><summary className="cursor-pointer text-sm font-bold">Salary revision history ({details.revisionHistory.length})</summary><ol className="mt-4 space-y-3">{[...details.revisionHistory].reverse().map((revision) => <li key={revision.id} className="rounded-lg border border-[#e5eaf1] bg-[#fafcff] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold">Effective {new Date(revision.effectiveFrom).toLocaleDateString()} · {revision.currency}</p><p className="text-[10px] text-[#7183a0]">Recorded {new Date(revision.changedAt).toLocaleDateString()}</p></div>{revision.reason ? <p className="mt-1 text-[11px] text-[#657795]">{revision.reason}</p> : null}<ul className="mt-2 flex flex-wrap gap-2">{revision.components.map((component, index) => <li key={`${revision.id}-${index}`} className="rounded-full bg-[#f1f5ff] px-2.5 py-1 text-[10px] text-[#34445f]">{component.label}: {amountLabel(component.amount, revision.currency, component.cadence)}</li>)}</ul></li>)}</ol></details>;
}
