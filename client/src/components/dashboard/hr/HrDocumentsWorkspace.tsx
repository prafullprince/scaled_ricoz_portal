"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Check, CheckCircle2, ChevronDown, Clock3, Download, ExternalLink, Eye, FileCheck2, FileText, LoaderCircle, Mail, Search, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { DocumentsService } from "@/services/documents.service";
import { HrFinanceService, type FinanceEmployee } from "@/services/hr-finance.service";
import { HrDocumentsService, type HrDocumentRecord, type HrDocumentType } from "@/services/hr-documents.service";

type TemplateField = { key: string; label: string; multiline?: boolean; optional?: boolean; inputType?: "date" };

const documentFields: Record<HrDocumentType, TemplateField[]> = {
  APPOINTMENT_LETTER: [
    { key: "workLocation", label: "Work location" },
    { key: "annualCtc", label: "Annual CTC" },
    { key: "monthlyGrossSalary", label: "Monthly gross salary" },
    { key: "salaryStructureReference", label: "Salary structure reference" },
    { key: "probationPeriod", label: "Probation period" },
    { key: "workingHours", label: "Working hours" },
    { key: "acceptanceMethod", label: "Acceptance method" },
    { key: "employeeNumber", label: "Employee ID", optional: true },
    { key: "acceptanceDeadline", label: "Acceptance deadline", inputType: "date" },
    { key: "reportingManagerName", label: "Reporting manager name" },
    { key: "reportingManagerDesignation", label: "Reporting manager designation" },
    { key: "signatoryName", label: "Authorized signatory name" },
    { key: "signatoryDesignation", label: "Authorized signatory designation" },
  ],
  SERVICE_CERTIFICATE: [
    { key: "employmentStartDate", label: "Employment start date", inputType: "date" },
    { key: "employmentEndDate", label: "Employment end date or Present" , optional: true },
    { key: "employmentStatus", label: "Employment status" },
    { key: "certificatePurpose", label: "Certificate purpose" },
    { key: "keyResponsibilities", label: "Key responsibilities", multiline: true, optional: true },
  ],
  EXPERIENCE_CERTIFICATE: [
    { key: "employmentStartDate", label: "Employment start date", inputType: "date" },
    { key: "employmentEndDate", label: "Employment end date", inputType: "date" },
    { key: "employmentDuration", label: "Employment duration" , optional: true },
    { key: "keyResponsibilities", label: "Key responsibilities", multiline: true },
    { key: "certificatePurpose", label: "Certificate purpose", optional: true },
  ],
  RELIEVING_LETTER: [
    { key: "lastWorkingDate", label: "Last working date", inputType: "date" },
    { key: "separationReason", label: "Separation reason", multiline: true, optional: true },
    { key: "handoverStatus", label: "Handover status" },
    { key: "exitClearanceStatus", label: "Exit clearance status", optional: true },
  ],
  SALARY_REVISION_LETTER: [
    { key: "previousAnnualCompensation", label: "Previous annual compensation" },
    { key: "revisedAnnualCompensation", label: "Revised annual compensation" },
    { key: "previousMonthlyCompensation", label: "Previous monthly compensation" },
    { key: "revisedMonthlyCompensation", label: "Revised monthly compensation" },
    { key: "revisionReason", label: "Revision reason", multiline: true },
  ],
  PROMOTION_LETTER: [
    { key: "previousDesignation", label: "Previous designation" },
    { key: "newDesignation", label: "New designation" },
    { key: "newLevel", label: "New level", optional: true },
    { key: "newDepartment", label: "New department" },
    { key: "newReportingManager", label: "New reporting manager" },
    { key: "promotionReason", label: "Promotion details", multiline: true },
    { key: "salaryTerms", label: "Approved salary terms", multiline: true },
  ],
  TRANSFER_DESIGNATION_LETTER: [
    { key: "previousDesignation", label: "Previous designation" },
    { key: "newDesignation", label: "New designation" },
    { key: "previousDepartment", label: "Previous department" },
    { key: "newDepartment", label: "New department" },
    { key: "previousLocation", label: "Previous work location" },
    { key: "newLocation", label: "New work location" },
    { key: "transferType", label: "Transfer type" },
    { key: "handoverDate", label: "Handover date" },
    { key: "acknowledgmentMethod", label: "Acknowledgment method" },
  ],
  PROBATION_CONFIRMATION: [
    { key: "probationStartDate", label: "Probation start date", inputType: "date" },
    { key: "probationEndDate", label: "Probation end date", inputType: "date" },
    { key: "probationOutcome", label: "Probation outcome" },
    { key: "confirmedDesignation", label: "Confirmed designation", optional: true },
    { key: "updatedEmploymentTerms", label: "Updated employment terms", multiline: true, optional: true },
  ],
  FULL_FINAL_SETTLEMENT: [
    { key: "settlementComponents", label: "Settlement components", multiline: true },
    { key: "grossSettlement", label: "Gross settlement" },
    { key: "deductions", label: "Deductions", multiline: true },
    { key: "netSettlement", label: "Net settlement" },
    { key: "paymentDate", label: "Payment date", optional: true, inputType: "date" },
    { key: "settlementReference", label: "Settlement reference", optional: true },
  ],
  NO_OBJECTION_CERTIFICATE: [
    { key: "certificatePurpose", label: "Certificate purpose" },
    { key: "scopeOfNoObjection", label: "Scope of no-objection", multiline: true },
    { key: "validUntil", label: "Valid until", optional: true, inputType: "date" },
    { key: "recipientOrganization", label: "Recipient organization", optional: true },
  ],
  EMPLOYMENT_VERIFICATION: [
    { key: "verificationPurpose", label: "Verification purpose" },
    { key: "employmentStatus", label: "Employment status" },
    { key: "employmentStartDate", label: "Employment start date" },
    { key: "employmentEndDate", label: "Employment end date or Present", optional: true },
    { key: "verifiedInformation", label: "Additional verified information", multiline: true, optional: true },
  ],
  LEAVE_APPROVAL_RECORD: [
    { key: "leaveType", label: "Leave type" },
    { key: "leaveStartDate", label: "Leave start date", inputType: "date" },
    { key: "leaveEndDate", label: "Leave end date", inputType: "date" },
    { key: "leaveDuration", label: "Leave duration" },
    { key: "leaveStatus", label: "Leave approval status" },
    { key: "approverName", label: "Approver name" },
    { key: "leaveNotes", label: "Notes", multiline: true, optional: true },
  ],
  STATUTORY_TAX_DOCUMENT: [
    { key: "taxYear", label: "Tax year or period" },
    { key: "documentCategory", label: "Document category" },
    { key: "documentReference", label: "Document reference", optional: true },
    { key: "verifiedInformation", label: "HR-reviewed information", multiline: true },
  ],
  EXIT_SEPARATION_DOCUMENT: [
    { key: "separationType", label: "Separation type" },
    { key: "separationReason", label: "Separation reason", multiline: true },
    { key: "lastWorkingDate", label: "Last working date", inputType: "date" },
    { key: "noticePeriodStatus", label: "Notice period status", optional: true },
    { key: "exitChecklist", label: "Exit checklist and clearances", multiline: true },
  ],
  EMPLOYEE_OF_MONTH: [
    { key: "recognitionPeriod", label: "Recognition month / period" },
    { key: "achievement", label: "Achievement", multiline: true },
    { key: "citation", label: "Recognition citation", multiline: true },
    { key: "approverName", label: "Approver name", optional: true },
  ],
  EMPLOYEE_OF_WEEK: [
    { key: "recognitionPeriod", label: "Recognition week / period" },
    { key: "achievement", label: "Achievement", multiline: true },
    { key: "citation", label: "Recognition citation", multiline: true },
    { key: "approverName", label: "Approver name", optional: true },
  ],
  EMPLOYEE_OF_YEAR: [
    { key: "recognitionPeriod", label: "Recognition year" },
    { key: "achievement", label: "Achievement", multiline: true },
    { key: "citation", label: "Recognition citation", multiline: true },
    { key: "approverName", label: "Approver name", optional: true },
  ],
};

const documentTypes: Array<{ type: HrDocumentType | "OFFER_LETTER"; label: string; timing: string; hint: string; effectiveDateRequired?: boolean; effectiveDateLabel?: string }> = [
  { type: "APPOINTMENT_LETTER", label: "Appointment Letter", timing: "At joining", hint: "Include joining date, designation, compensation, and approved terms.", effectiveDateRequired: true, effectiveDateLabel: "Joining date" },
  { type: "OFFER_LETTER", label: "Offer Letter", timing: "Before joining", hint: "Offer letters are created from the Recruitment workflow." },
  { type: "SERVICE_CERTIFICATE", label: "Employment / Service Certificate", timing: "During employment / when requested", hint: "State the service period and the details being confirmed." },
  { type: "EXPERIENCE_CERTIFICATE", label: "Experience Certificate", timing: "On separation / when requested", hint: "Include employment dates, responsibilities, and separation date." },
  { type: "RELIEVING_LETTER", label: "Relieving Letter", timing: "On successful exit", hint: "Include resignation acceptance, final working date, and handover status.", effectiveDateRequired: true, effectiveDateLabel: "Relieving effective date" },
  { type: "SALARY_REVISION_LETTER", label: "Salary Revision Letter", timing: "Whenever compensation changes", hint: "Enter the approved current and revised compensation details.", effectiveDateRequired: true, effectiveDateLabel: "Revision effective date" },
  { type: "PROMOTION_LETTER", label: "Promotion Letter / Certificate", timing: "Whenever an employee is promoted", hint: "Include the new title, level, effective date, and approved terms.", effectiveDateRequired: true, effectiveDateLabel: "Promotion effective date" },
  { type: "TRANSFER_DESIGNATION_LETTER", label: "Transfer / Designation Change Letter", timing: "When role or department changes", hint: "Include the previous and new department, designation, and effective date.", effectiveDateRequired: true, effectiveDateLabel: "Effective date" },
  { type: "PROBATION_CONFIRMATION", label: "Probation Confirmation Letter", timing: "After successful probation", hint: "Enter the probation review outcome and confirmed employment terms.", effectiveDateRequired: true, effectiveDateLabel: "Confirmation effective date" },
  { type: "FULL_FINAL_SETTLEMENT", label: "Full & Final Settlement Document", timing: "During exit", hint: "Enter reviewed settlement amounts and components; no amounts are calculated here." },
  { type: "NO_OBJECTION_CERTIFICATE", label: "No Objection Certificate (NOC)", timing: "When applicable", hint: "State the purpose and the scope of the approved no-objection." },
  { type: "EMPLOYMENT_VERIFICATION", label: "Employment Verification Letter", timing: "When employment proof is requested", hint: "Enter the exact employment facts being verified." },
  { type: "LEAVE_APPROVAL_RECORD", label: "Leave Approval / Record", timing: "Whenever applicable", hint: "Include leave type, dates, duration, approval date, and approver." },
  { type: "EXIT_SEPARATION_DOCUMENT", label: "Exit / Separation Documentation", timing: "At termination or resignation", hint: "Enter the separation reason, dates, and completed exit steps." },
  { type: "STATUTORY_TAX_DOCUMENT", label: "Statutory / Tax Document", timing: "As required by applicable law", hint: "Enter reviewed details supplied by HR; no tax or statutory entitlement is calculated." },
  { type: "EMPLOYEE_OF_MONTH", label: "Employee of the Month", timing: "Monthly recognition", hint: "Enter the recognition period, achievement, and citation." },
  { type: "EMPLOYEE_OF_WEEK", label: "Employee of the Week", timing: "Weekly recognition", hint: "Enter the recognition period, achievement, and citation." },
  { type: "EMPLOYEE_OF_YEAR", label: "Employee of the Year", timing: "Annual recognition", hint: "Enter the recognition year, achievement, and citation." },
];

const fieldClass = "h-11 w-full rounded-xl border border-[#dbe4f0] bg-white px-3.5 text-sm font-medium text-[#26364f] shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition duration-150 placeholder:text-[#94a1b5] hover:border-[#b9c9df] focus:border-[#5578ba] focus:ring-4 focus:ring-[#5578ba]/10 disabled:cursor-not-allowed disabled:bg-[#f5f7fb] disabled:text-[#8b97aa]";
const today = () => new Date().toISOString().slice(0, 10);

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function displayDate(date: string) {
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function HrDocumentsWorkspace() {
  const [employees, setEmployees] = useState<FinanceEmployee[]>([]);
  const [documents, setDocuments] = useState<HrDocumentRecord[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [activeEmployeeIndex, setActiveEmployeeIndex] = useState(0);
  const [type, setType] = useState<HrDocumentType | "OFFER_LETTER">("APPOINTMENT_LETTER");
  const [documentTypeSearch, setDocumentTypeSearch] = useState("");
  const [documentTypeDropdownOpen, setDocumentTypeDropdownOpen] = useState(false);
  const [activeDocumentTypeIndex, setActiveDocumentTypeIndex] = useState(0);
  const [issueDate, setIssueDate] = useState(today);
  const [effectiveDate, setEffectiveDate] = useState("");
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeDocumentId, setActiveDocumentId] = useState("");

  const employeeDropdownId = useId();
  const employeeDropdownRef = useRef<HTMLDivElement>(null);
  const employeeTriggerRef = useRef<HTMLButtonElement>(null);
  const employeeSearchRef = useRef<HTMLInputElement>(null);
  const documentTypeDropdownId = useId();
  const documentTypeDropdownRef = useRef<HTMLDivElement>(null);
  const documentTypeTriggerRef = useRef<HTMLButtonElement>(null);
  const documentTypeSearchRef = useRef<HTMLInputElement>(null);
  const selectedType = useMemo(() => documentTypes.find((item) => item.type === type)!, [type]);
  const selectedDocumentFields = type === "OFFER_LETTER" ? [] : documentFields[type];
  const templateDetailsLength = selectedDocumentFields.reduce((length, field) =>
    length + field.label.length + (templateValues[field.key]?.length ?? 0) + 4, 0);
  const selectedEmployee = employees.find((employee) => employee.id === employeeId);
  const filteredEmployees = useMemo(() => {
    const query = employeeSearch.trim().toLocaleLowerCase();
    if (!query) return employees;
    return employees.filter((employee) =>
      `${employee.name} ${employee.email} ${employee.role.replaceAll("_", " ")}`
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [employees, employeeSearch]);
  const filteredDocumentTypes = useMemo(() => {
    const query = documentTypeSearch.trim().toLocaleLowerCase();
    if (!query) return documentTypes;
    return documentTypes.filter((item) =>
      `${item.label} ${item.timing} ${item.hint}`
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [documentTypeSearch]);
  const offerWorkflowHref = selectedEmployee
    ? `/dashboard/admin/applications?candidate=${encodeURIComponent(selectedEmployee.email)}`
    : "/dashboard/admin/applications";
  const activeDocument = documents.find((document) => document.id === activeDocumentId) ?? null;
  const draftCount = documents.filter((document) => document.status === "DRAFT").length;
  const publishedCount = documents.filter((document) => document.status === "PUBLISHED").length;
  useEffect(() => {
    if (!employeeDropdownOpen) return;
    employeeSearchRef.current?.focus();
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && employeeDropdownRef.current?.contains(event.target)) return;
      setEmployeeDropdownOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [employeeDropdownOpen]);
  useEffect(() => {
    if (!documentTypeDropdownOpen) return;
    documentTypeSearchRef.current?.focus();
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && documentTypeDropdownRef.current?.contains(event.target)) return;
      setDocumentTypeDropdownOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [documentTypeDropdownOpen]);
  useEffect(() => {
    let active = true;
    Promise.all([HrFinanceService.employees(), HrDocumentsService.list()])
      .then(([people, records]) => {
        if (!active) return;
        setEmployees(people);
        setDocuments(records);
        setEmployeeId(people[0]?.id ?? "");
        setError("");
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "HR documents could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function openEmployeeDropdown() {
    if (loading || employees.length === 0) return;
    setEmployeeSearch("");
    setActiveEmployeeIndex(0);
    setEmployeeDropdownOpen(true);
  }

  function selectEmployee(employee: FinanceEmployee) {
    setEmployeeId(employee.id);
    setEmployeeSearch("");
    setEmployeeDropdownOpen(false);
  }

  function openDocumentTypeDropdown() {
    setDocumentTypeSearch("");
    setActiveDocumentTypeIndex(0);
    setDocumentTypeDropdownOpen(true);
  }

  function selectDocumentType(item: (typeof documentTypes)[number]) {
    setType(item.type);
    setTemplateValues({});
    setEffectiveDate("");
    setDocumentTypeSearch("");
    setDocumentTypeDropdownOpen(false);
  }

  async function createDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (type === "OFFER_LETTER") return;
    setBusy("create");
    setError("");
    setNotice("");
    try {
      const draft = await HrDocumentsService.create({
        employeeId,
        type,
        issueDate,
        effectiveDate,
        fields: templateValues,
      });
      setDocuments((current) => [draft, ...current]);
      setActiveDocumentId(draft.id);
      setNotice("Draft PDF generated. Review it before publishing.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The HR document draft could not be generated.");
    } finally {
      setBusy("");
    }
  }

  async function download(document: HrDocumentRecord) {
    setBusy(`download-${document.id}`);
    setError("");
    try {
      downloadBlob(await HrDocumentsService.file(document.id), document.fileName);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The document could not be downloaded.");
    } finally {
      setBusy("");
    }
  }

  async function preview(document: HrDocumentRecord) {
    setBusy(`preview-${document.id}`);
    setError("");
    setPreviewUrl("");
    try {
      setPreviewUrl(URL.createObjectURL(await HrDocumentsService.file(document.id)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The document preview could not be loaded.");
    } finally {
      setBusy("");
    }
  }

  async function publish(document: HrDocumentRecord) {
    setBusy(`publish-${document.id}`);
    setError("");
    setNotice("");
    try {
      const published = await HrDocumentsService.publish(document.id);
      setDocuments((current) => current.map((item) => item.id === published.id ? { ...item, ...published } : item));
      setNotice(`${published.title} is now published to ${published.employeeName || "the employee"}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The document could not be published.");
    } finally {
      setBusy("");
    }
  }

  async function sendEmail(document: HrDocumentRecord) {
    setBusy(`email-${document.id}`);
    setError("");
    setNotice("");
    try {
      await DocumentsService.sendEmail(
        { documentType: "HR_DOCUMENT", documentId: document.id },
        `hrdoc-${document.id}-${globalThis.crypto.randomUUID()}`,
      );
      setNotice(`${document.title} was emailed to ${document.employeeEmail}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The HR document email could not be sent.");
    } finally {
      setBusy("");
    }
  }

  async function discard(document: HrDocumentRecord) {
    setBusy(`discard-${document.id}`);
    setError("");
    try {
      await HrDocumentsService.discard(document.id);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      if (activeDocumentId === document.id) setActiveDocumentId("");
      setNotice("Draft discarded.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The draft could not be discarded.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative isolate overflow-hidden rounded-3xl border border-[#dce6f7] bg-[linear-gradient(115deg,#f2f6ff_0%,#fff_52%,#edf8ff_100%)] p-5 shadow-[0_12px_35px_-28px_rgba(28,58,112,0.38)] sm:p-7">
        <div aria-hidden="true" className="absolute -right-12 -top-24 -z-10 size-72 rounded-full bg-[#dceaff]/70 blur-3xl"/>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white bg-white text-[#1645a2] shadow-sm"><FileText size={21}/></span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4169ad]">People operations · Document center</p>
              <h2 className="mt-1.5 text-lg font-bold tracking-tight text-[#17233a] sm:text-xl">Create and publish employee documents</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#657795]">Prepare a type-specific PDF draft, review it, publish it to the employee workspace, and email the published copy when you are ready. Records are scoped to your active company.</p>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-2 sm:gap-3">
            <div className="min-w-[76px] rounded-2xl border border-white/90 bg-white/80 px-3 py-2.5 text-center shadow-sm backdrop-blur">
              <p className="text-lg font-bold tabular-nums text-[#17233a]">{documents.length}</p>
              <p className="mt-0.5 text-[10px] font-semibold text-[#7183a0]">Total</p>
            </div>
            <div className="min-w-[76px] rounded-2xl border border-white/90 bg-white/80 px-3 py-2.5 text-center shadow-sm backdrop-blur">
              <p className="text-lg font-bold tabular-nums text-amber-700">{draftCount}</p>
              <p className="mt-0.5 text-[10px] font-semibold text-[#7183a0]">Drafts</p>
            </div>
            <div className="min-w-[76px] rounded-2xl border border-white/90 bg-white/80 px-3 py-2.5 text-center shadow-sm backdrop-blur">
              <p className="text-lg font-bold tabular-nums text-emerald-700">{publishedCount}</p>
              <p className="mt-0.5 text-[10px] font-semibold text-[#7183a0]">Published</p>
            </div>
          </div>
        </div>
      </section>
      {error ? <p role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span className="mt-0.5 font-bold">!</span><span>{error}</span></p> : null}
      {notice ? <p role="status" className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 size={17} className="mt-0.5 shrink-0"/><span>{notice}</span></p> : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(340px,0.9fr)_minmax(0,1.1fr)]">
        <form onSubmit={(event) => void createDocument(event)} className="space-y-5 rounded-2xl border border-[#e3eaf3] bg-white p-5 shadow-[0_12px_35px_-30px_rgba(24,43,77,0.42)] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4169ad]">Create a record</p><h2 className="mt-1 text-base font-bold tracking-tight text-[#17233a]">New document</h2><p className="mt-1 text-xs leading-5 text-[#7183a0]">Enter only details approved and verified by HR.</p></div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#f1f5ff] px-2.5 py-1.5 text-[10px] font-bold text-[#315aa4]"><ShieldCheck size={13}/>HR reviewed</span>
          </div>
          <div ref={employeeDropdownRef} className="relative space-y-2">
            <label id={`${employeeDropdownId}-label`} className="block text-xs font-semibold text-[#465875]">Person <span className="text-[#dc5363]">*</span></label>
            <button
              ref={employeeTriggerRef}
              type="button"
              aria-labelledby={`${employeeDropdownId}-label`}
              aria-haspopup="listbox"
              aria-expanded={employeeDropdownOpen}
              aria-controls={`${employeeDropdownId}-listbox`}
              disabled={loading || employees.length === 0}
              onClick={() => employeeDropdownOpen ? setEmployeeDropdownOpen(false) : openEmployeeDropdown()}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  openEmployeeDropdown();
                }
              }}
              className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[#dbe4f0] bg-white px-3.5 py-2 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition duration-150 hover:border-[#b9c9df] focus:border-[#5578ba] focus:ring-4 focus:ring-[#5578ba]/10 disabled:cursor-not-allowed disabled:bg-[#f5f7fb] disabled:text-[#8b97aa]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#eef3ff] text-[#4169ad]"><UserRound size={17}/></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[#26364f]">{loading ? "Loading people…" : selectedEmployee?.name ?? "No active people found"}</span>
                <span className="mt-0.5 block truncate text-[11px] font-normal text-[#8290a5]">{selectedEmployee ? selectedEmployee.role.replaceAll("_", " ") : "Select an employee"}</span>
              </span>
              {loading ? <LoaderCircle size={16} className="shrink-0 animate-spin text-[#7183a0]"/> : <ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-[#7183a0] transition-transform ${employeeDropdownOpen ? "rotate-180" : ""}`}/>}
            </button>
            {employeeDropdownOpen ? <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-[#dce5f1] bg-white p-2 shadow-[0_20px_48px_-20px_rgba(21,42,78,0.35)] ring-1 ring-[#1c3a70]/5">
              <div className="relative">
                <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8290a5]"/>
                <input
                  ref={employeeSearchRef}
                  type="text"
                  role="combobox"
                  aria-label="Search people"
                  aria-autocomplete="list"
                  aria-expanded="true"
                  aria-controls={`${employeeDropdownId}-listbox`}
                  aria-activedescendant={filteredEmployees.length ? `${employeeDropdownId}-option-${activeEmployeeIndex}` : undefined}
                  value={employeeSearch}
                  onChange={(event) => { setEmployeeSearch(event.target.value); setActiveEmployeeIndex(0); }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" && filteredEmployees.length) {
                      event.preventDefault();
                      setActiveEmployeeIndex((index) => (index + 1) % filteredEmployees.length);
                    } else if (event.key === "ArrowUp" && filteredEmployees.length) {
                      event.preventDefault();
                      setActiveEmployeeIndex((index) => (index - 1 + filteredEmployees.length) % filteredEmployees.length);
                    } else if (event.key === "Enter") {
                      event.preventDefault();
                      if (filteredEmployees[activeEmployeeIndex]) selectEmployee(filteredEmployees[activeEmployeeIndex]);
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      setEmployeeDropdownOpen(false);
                      employeeTriggerRef.current?.focus();
                    }
                  }}
                  placeholder="Search by name, email, or role"
                  className="h-10 w-full rounded-xl border border-[#e2e9f2] bg-[#f8faff] pl-9 pr-3 text-sm text-[#26364f] outline-none transition placeholder:text-[#94a1b5] focus:border-[#5578ba] focus:bg-white focus:ring-4 focus:ring-[#5578ba]/10"
                />
              </div>
              <ul id={`${employeeDropdownId}-listbox`} role="listbox" aria-labelledby={`${employeeDropdownId}-label`} className="mt-2 max-h-60 space-y-1 overflow-y-auto">
                {filteredEmployees.map((employee, index) => {
                  const isSelected = employee.id === employeeId;
                  const isActive = index === activeEmployeeIndex;
                  return <li
                    key={employee.id}
                    id={`${employeeDropdownId}-option-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveEmployeeIndex(index)}
                    onClick={() => selectEmployee(employee)}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition ${isActive ? "bg-[#f1f5ff]" : "hover:bg-[#f7f9fc]"}`}
                  >
                    <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${isSelected ? "bg-[#e3ecff] text-[#315aa4]" : "bg-[#f0f3f8] text-[#657795]"}`}>{employee.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[#26364f]">{employee.name}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-[#8290a5]">{employee.email} · {employee.role.replaceAll("_", " ")}</span>
                    </span>
                    {isSelected ? <Check size={16} aria-label="Selected" className="shrink-0 text-[#315aa4]"/> : null}
                  </li>;
                })}
              </ul>
              {filteredEmployees.length === 0 ? <p role="status" className="px-3 py-6 text-center text-xs text-[#7183a0]">No people match “{employeeSearch}”. Try another name or email.</p> : null}
              <p className="border-t border-[#edf1f6] px-2 pt-2 text-[10px] text-[#94a1b5]">{filteredEmployees.length} {filteredEmployees.length === 1 ? "person" : "people"} · Use ↑ ↓ to navigate, Enter to select</p>
            </div> : null}
          </div>
          <div ref={documentTypeDropdownRef} className="relative space-y-2">
            <label id={`${documentTypeDropdownId}-label`} className="block text-xs font-semibold text-[#465875]">Document type</label>
            <button
              ref={documentTypeTriggerRef}
              type="button"
              aria-labelledby={`${documentTypeDropdownId}-label`}
              aria-haspopup="listbox"
              aria-expanded={documentTypeDropdownOpen}
              aria-controls={`${documentTypeDropdownId}-listbox`}
              onClick={() => documentTypeDropdownOpen ? setDocumentTypeDropdownOpen(false) : openDocumentTypeDropdown()}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  openDocumentTypeDropdown();
                }
              }}
              className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[#dbe4f0] bg-white px-3.5 py-2 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition duration-150 hover:border-[#b9c9df] focus:border-[#5578ba] focus:ring-4 focus:ring-[#5578ba]/10"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#eef3ff] text-[#4169ad]"><FileText size={17}/></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[#26364f]">{selectedType.label}</span>
                <span className="mt-0.5 block truncate text-[11px] font-normal text-[#8290a5]">Document template</span>
              </span>
              <ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-[#7183a0] transition-transform ${documentTypeDropdownOpen ? "rotate-180" : ""}`}/>
            </button>
            {documentTypeDropdownOpen ? <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-[#dce5f1] bg-white p-2 shadow-[0_20px_48px_-20px_rgba(21,42,78,0.35)] ring-1 ring-[#1c3a70]/5">
              <div className="relative">
                <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8290a5]"/>
                <input
                  ref={documentTypeSearchRef}
                  type="text"
                  role="combobox"
                  aria-label="Search document types"
                  aria-autocomplete="list"
                  aria-expanded="true"
                  aria-controls={`${documentTypeDropdownId}-listbox`}
                  aria-activedescendant={filteredDocumentTypes.length ? `${documentTypeDropdownId}-option-${activeDocumentTypeIndex}` : undefined}
                  value={documentTypeSearch}
                  onChange={(event) => { setDocumentTypeSearch(event.target.value); setActiveDocumentTypeIndex(0); }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" && filteredDocumentTypes.length) {
                      event.preventDefault();
                      setActiveDocumentTypeIndex((index) => (index + 1) % filteredDocumentTypes.length);
                    } else if (event.key === "ArrowUp" && filteredDocumentTypes.length) {
                      event.preventDefault();
                      setActiveDocumentTypeIndex((index) => (index - 1 + filteredDocumentTypes.length) % filteredDocumentTypes.length);
                    } else if (event.key === "Enter") {
                      event.preventDefault();
                      if (filteredDocumentTypes[activeDocumentTypeIndex]) selectDocumentType(filteredDocumentTypes[activeDocumentTypeIndex]);
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      setDocumentTypeDropdownOpen(false);
                      documentTypeTriggerRef.current?.focus();
                    }
                  }}
                  placeholder="Search document types"
                  className="h-10 w-full rounded-xl border border-[#e2e9f2] bg-[#f8faff] pl-9 pr-3 text-sm text-[#26364f] outline-none transition placeholder:text-[#94a1b5] focus:border-[#5578ba] focus:bg-white focus:ring-4 focus:ring-[#5578ba]/10"
                />
              </div>
              <ul id={`${documentTypeDropdownId}-listbox`} role="listbox" aria-labelledby={`${documentTypeDropdownId}-label`} className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                {filteredDocumentTypes.map((item, index) => {
                  const isSelected = item.type === type;
                  const isActive = index === activeDocumentTypeIndex;
                  return <li
                    key={item.type}
                    id={`${documentTypeDropdownId}-option-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveDocumentTypeIndex(index)}
                    onClick={() => selectDocumentType(item)}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition ${isActive ? "bg-[#f1f5ff]" : "hover:bg-[#f7f9fc]"}`}
                  >
                    <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${isSelected ? "bg-[#e3ecff] text-[#315aa4]" : "bg-[#f0f3f8] text-[#657795]"}`}><FileText size={16}/></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[#26364f]">{item.label}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-[#8290a5]">{item.timing}</span>
                    </span>
                    {isSelected ? <Check size={16} aria-label="Selected" className="shrink-0 text-[#315aa4]"/> : null}
                  </li>;
                })}
              </ul>
              {filteredDocumentTypes.length === 0 ? <p role="status" className="px-3 py-6 text-center text-xs text-[#7183a0]">No document types match “{documentTypeSearch}”. Try another search.</p> : null}
              <p className="border-t border-[#edf1f6] px-2 pt-2 text-[10px] text-[#94a1b5]">{filteredDocumentTypes.length} {filteredDocumentTypes.length === 1 ? "type" : "types"} · Use ↑ ↓ to navigate, Enter to select</p>
            </div> : null}
          </div>
          <div className="flex items-start gap-2.5 rounded-xl border border-[#e8eef8] bg-[#f7f9fe] px-3.5 py-3 text-xs leading-5 text-[#657795]"><Clock3 size={15} className="mt-0.5 shrink-0 text-[#5575b0]"/><p><span className="font-semibold text-[#34445f]">{selectedType.timing}.</span> {selectedType.hint}</p></div>
          {type === "OFFER_LETTER" ? <div className="space-y-2"><p className="text-xs leading-5 text-[#7183a0]">Offer letters use the existing Recruitment offer generator and template. The selected person will be pre-filtered; the previous workflow requires an accepted application.</p><a href={offerWorkflowHref} className="flex items-center justify-between rounded-lg border border-[#d8e1ed] bg-[#f8faff] p-3 text-sm font-semibold text-[#1645a2] hover:bg-[#eef3ff]">Continue with existing offer workflow <ExternalLink size={15}/></a></div> : <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2 text-xs font-semibold text-[#465875]">Issue date <span className="text-[#dc5363]">*</span><input className={fieldClass} type="date" required value={issueDate} onChange={(event) => setIssueDate(event.target.value)}/></label>
              <label className="block space-y-2 text-xs font-semibold text-[#465875]">{selectedType.effectiveDateLabel ?? "Effective date"} {selectedType.effectiveDateRequired ? <span className="text-[#dc5363]">*</span> : <span className="font-normal text-[#8290a5]">(optional)</span>}<input className={fieldClass} type="date" required={selectedType.effectiveDateRequired} value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)}/></label>
            </div>
            <div className="space-y-3">
              <div><p className="text-xs font-semibold text-[#465875]">Document-specific details <span className="text-[#dc5363]">*</span></p><p className="mt-1 text-[11px] leading-5 text-[#8290a5]">Complete the approved fields below. Employee identity, role, department, and profile dates are populated from company records.</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                {selectedDocumentFields.map((field) => <label key={field.key} className={`block space-y-2 text-xs font-semibold text-[#465875] ${field.multiline ? "sm:col-span-2" : ""}`}>
                  {field.label} {field.optional ? <span className="font-normal text-[#8290a5]">(optional)</span> : <span className="text-[#dc5363]">*</span>}
                  {field.multiline
                    ? <textarea className="min-h-24 w-full resize-y rounded-xl border border-[#dbe4f0] bg-white px-3.5 py-3 text-sm font-medium leading-6 text-[#26364f] shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition duration-150 placeholder:font-normal placeholder:text-[#94a1b5] hover:border-[#b9c9df] focus:border-[#5578ba] focus:ring-4 focus:ring-[#5578ba]/10" required={!field.optional} maxLength={1000} value={templateValues[field.key] ?? ""} onChange={(event) => setTemplateValues((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={`Enter ${field.label.toLocaleLowerCase()}`}/>
                    : <input className={fieldClass} type={field.inputType ?? "text"} required={!field.optional} maxLength={field.inputType === "date" ? undefined : 1000} value={templateValues[field.key] ?? ""} onChange={(event) => setTemplateValues((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.inputType === "date" ? undefined : `Enter ${field.label.toLocaleLowerCase()}`}/>}
                </label>)}
              </div>
              <p className={`text-right text-[11px] ${templateDetailsLength > 5_000 ? "text-red-700" : "text-[#8290a5]"}`}>{templateDetailsLength.toLocaleString()} / 5,000 characters</p>
            </div>
            {type === "STATUTORY_TAX_DOCUMENT" || type === "FULL_FINAL_SETTLEMENT" ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-5 text-amber-900">All statutory, tax, and settlement values must be supplied and reviewed by HR. The system does not calculate legal entitlements, tax, or settlement amounts.</p> : null}
            <button type="submit" disabled={!employeeId || Boolean(busy) || loading || templateDetailsLength > 5_000} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1645a2] to-[#245bc0] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_-10px_rgba(22,69,162,0.8)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_22px_-12px_rgba(22,69,162,0.9)] disabled:translate-y-0 disabled:opacity-50">{busy === "create" ? <LoaderCircle size={16} className="animate-spin"/> : <FileText size={16}/>}Generate draft PDF</button>
          </>}
        </form>

        <section className="min-w-0 space-y-4 rounded-2xl border border-[#e3eaf3] bg-white p-5 shadow-[0_12px_35px_-30px_rgba(24,43,77,0.42)] sm:p-6">
          <div className="flex items-center justify-between gap-3 border-b border-[#edf1f6] pb-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f1f5ff] text-[#315aa4]"><FileCheck2 size={18}/></span>
              <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4169ad]">Company library</p><h2 className="mt-0.5 text-sm font-bold text-[#17233a]">Document records</h2><p className="mt-1 text-xs text-[#7183a0]">Drafts stay private to HR until published.</p></div>
            </div>
            <span className="rounded-full border border-[#e6ebf3] bg-[#f7f9fc] px-2.5 py-1 text-xs font-semibold tabular-nums text-[#52627a]">{documents.length}</span>
          </div>
          {loading ? <p role="status" className="flex items-center gap-2 py-8 text-sm text-[#7183a0]"><LoaderCircle size={16} className="animate-spin"/>Loading company records…</p> : null}
          {!loading && documents.length === 0 ? <div className="rounded-2xl border border-dashed border-[#d5dfed] bg-[#fafbfe] px-5 py-12 text-center"><span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#eef3ff] text-[#5575b0]"><FileText size={21}/></span><p className="mt-3 text-sm font-semibold text-[#34445f]">Your document library is ready</p><p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-[#7183a0]">Create a draft using the form. You can review it before publishing it to an employee.</p></div> : null}
          <ul className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
            {documents.map((document) => <li key={document.id} className="rounded-2xl border border-[#e8edf4] bg-white p-4 transition hover:border-[#cbd8eb] hover:shadow-[0_8px_24px_-20px_rgba(24,43,77,0.6)]">
              <div className="flex flex-wrap items-start gap-3">
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f3f6fb] text-[#526b96]"><FileText size={17}/></span>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-[#17233a]">{document.title}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide ${document.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{document.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"}</span></div><p className="mt-1.5 truncate text-xs text-[#52627a]">{document.employeeName || document.employeeEmail}</p><p className="mt-1 truncate text-[11px] text-[#8290a5]">{document.referenceNumber} · Issued {displayDate(document.issueDate)} · {(document.fileSize / 1024).toFixed(0)} KB</p></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 sm:pl-[52px]">
                <button type="button" onClick={() => { setActiveDocumentId(document.id); void preview(document); }} disabled={Boolean(busy)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#dce4ef] bg-white px-3 text-xs font-semibold text-[#34445f] transition hover:border-[#afc1dd] hover:bg-[#f8faff] disabled:opacity-50">{busy === `preview-${document.id}` ? <LoaderCircle size={13} className="animate-spin"/> : <Eye size={13}/>}Preview</button>
                <button type="button" onClick={() => void download(document)} disabled={Boolean(busy)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#dce4ef] bg-white px-3 text-xs font-semibold text-[#34445f] transition hover:border-[#afc1dd] hover:bg-[#f8faff] disabled:opacity-50">{busy === `download-${document.id}` ? <LoaderCircle size={13} className="animate-spin"/> : <Download size={13}/>}Download</button>
                {document.status === "DRAFT" ? <>
                  <button type="button" onClick={() => void publish(document)} disabled={Boolean(busy)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1645a2] px-3 text-xs font-semibold text-white transition hover:bg-[#123984] disabled:opacity-50">{busy === `publish-${document.id}` ? <LoaderCircle size={13} className="animate-spin"/> : <ShieldCheck size={13}/>}Publish</button>
                  <button type="button" onClick={() => void discard(document)} disabled={Boolean(busy)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"><Trash2 size={13}/>Discard</button>
                </> : <button type="button" onClick={() => void sendEmail(document)} disabled={Boolean(busy) || !document.employeeEmail} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1645a2] px-3 text-xs font-semibold text-white transition hover:bg-[#123984] disabled:opacity-50">{busy === `email-${document.id}` ? <LoaderCircle size={13} className="animate-spin"/> : <Mail size={13}/>}Email employee</button>}
              </div>
            </li>)}
          </ul>
          {activeDocument && previewUrl ? <div className="overflow-hidden rounded-2xl border border-[#dce4ef]"><div className="flex items-center justify-between gap-3 bg-[#f7f9fd] px-4 py-3"><p className="truncate text-xs font-semibold text-[#34445f]">{activeDocument.title} · Preview</p><button type="button" onClick={() => setPreviewUrl("")} className="rounded-lg px-2 py-1 text-xs font-semibold text-[#657795] transition hover:bg-white hover:text-[#17233a]">Close</button></div><iframe title={`${activeDocument.title} PDF preview`} src={previewUrl} className="h-[480px] w-full"/></div> : null}
        </section>
      </div>
    </div>
  );
}
