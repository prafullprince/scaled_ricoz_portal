"use client";

import { useEffect, useState } from "react";
import { Download, FileText, LoaderCircle, WalletCards } from "lucide-react";
import { HrFinanceService, type Payslip } from "@/services/hr-finance.service";

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function MyPayslips() {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    HrFinanceService.myPayslips()
      .then((result) => { if (active) setPayslips(result); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Payslips could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function download(payslip: Payslip) {
    setDownloading(payslip.id);
    setError("");
    try {
      downloadBlob(await HrFinanceService.myPayslipFile(payslip.id), payslip.fileName);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Payslip download failed.");
    } finally {
      setDownloading("");
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 text-(--brand-text)">
      <header className="rounded-2xl border border-(--brand-border) bg-[linear-gradient(120deg,#fff_0%,#f2f6ff_100%)] p-6">
        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-(--brand-red-pale) text-(--brand-red)"><WalletCards size={20}/></span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">My payslips</h1>
        <p className="mt-2 text-sm leading-6 text-(--brand-text-secondary)">Download finalized payslips published for your employee account.</p>
      </header>
      {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <section className="rounded-2xl border border-(--brand-border) bg-white p-5 shadow-(--shadow-sm)">
        <h2 className="text-sm font-bold">Published documents</h2>
        {loading ? <p role="status" className="flex items-center gap-2 py-10 text-sm text-(--brand-text-secondary)"><LoaderCircle size={16} className="animate-spin"/>Loading payslips…</p> : null}
        {!loading && payslips.length === 0 ? <div className="py-12 text-center"><FileText size={24} className="mx-auto text-(--brand-text-muted)"/><p className="mt-3 text-sm font-semibold">No payslips published yet</p><p className="mt-1 text-xs text-(--brand-text-secondary)">Your HR team will publish payslips here when they are available.</p></div> : null}
        <ul className="divide-y divide-(--brand-border)">
          {payslips.map((payslip) => (
            <li key={payslip.id} className="flex flex-wrap items-center gap-3 py-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-(--brand-surface) text-(--brand-navy)"><FileText size={17}/></span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold">{new Date(`${payslip.payPeriod}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h3>
                <p className="mt-1 truncate text-xs text-(--brand-text-secondary)">{payslip.fileName} · {payslip.currency} · {(payslip.fileSize / 1024).toFixed(0)} KB</p>
              </div>
              <button type="button" disabled={Boolean(downloading)} onClick={() => void download(payslip)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-(--brand-navy) px-3 text-xs font-semibold text-white hover:bg-(--brand-red) disabled:opacity-50">{downloading === payslip.id ? <LoaderCircle size={14} className="animate-spin"/> : <Download size={14}/>}Download</button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
