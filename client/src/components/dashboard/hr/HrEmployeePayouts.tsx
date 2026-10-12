"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Banknote, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import {
  HrPayoutsService,
  type PayoutMethod,
  type PayoutMode,
  type PayoutRecord,
} from "@/services/hr-payouts.service";

const inputClass = "h-10 w-full rounded-lg border border-[#d8e1ed] bg-white px-3 text-sm text-[#17233a] outline-none focus:border-[#1645a2] focus:ring-2 focus:ring-[#1645a2]/10";
const cardClass = "rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm sm:p-5";
const currentPeriod = () => new Date().toISOString().slice(0, 7);
const statusText = (status: PayoutRecord["status"]) => status === "PROCESSED"
  ? "Received"
  : status === "REQUESTED"
    ? "Awaiting confirmation"
    : status.charAt(0) + status.slice(1).toLowerCase();
const statusStyle = (status: PayoutRecord["status"]) => status === "PROCESSED"
  ? "bg-emerald-50 text-emerald-700"
  : ["FAILED", "REJECTED", "REVERSED", "CANCELLED"].includes(status)
    ? "bg-red-50 text-red-700"
    : "bg-amber-50 text-amber-800";

type PayoutForm = {
  amount: string;
  payPeriod: string;
  mode: PayoutMode;
  description: string;
};
type PayoutAttempt = Omit<PayoutForm, "amount"> & { amount: number; clientRequestId: string };

function monthLabel(value: string) {
  const date = new Date(`${value}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function amountLabel(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value);
}

export function HrEmployeePayouts({ employeeId }: { employeeId: string }) {
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod | null>(null);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [payoutsEnabled, setPayoutsEnabled] = useState(false);
  const [form, setForm] = useState<PayoutForm>({
    amount: "",
    payPeriod: currentPeriod(),
    mode: "IMPS",
    description: "Monthly salary",
  });
  const [attempt, setAttempt] = useState<PayoutAttempt | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    HrPayoutsService.employeePayouts(employeeId)
      .then((result) => {
        if (!active) return;
        setPayoutMethod(result.payoutMethod);
        setPayouts(result.payouts);
        setPayoutsEnabled(result.payoutsEnabled);
        setForm((current) => ({
          ...current,
          mode: result.payoutMethod?.accountType === "VPA" ? "UPI" : "IMPS",
        }));
        setError("");
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Payout history could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [employeeId]);

  async function createPayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payoutMethod || !payoutsEnabled) return;
    if (!attempt && !confirmed) {
      setError("Confirm the recipient, period, amount, and payment description before sending.");
      return;
    }
    const payload = attempt ?? {
      ...form,
      amount: Number(form.amount),
      clientRequestId: window.crypto.randomUUID(),
    };
    setAttempt(payload);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payout = await HrPayoutsService.createPayout(employeeId, {
        ...payload,
      });
      setPayouts((current) => [payout, ...current.filter((item) => item.id !== payout.id)]);
      setAttempt(null);
      setConfirmed(false);
      if (payout.status === "PROCESSED") {
        setNotice(`${amountLabel(payout.amount)} for ${monthLabel(payout.payPeriod)} is confirmed as received.`);
      } else {
        setNotice(`RazorpayX accepted the payout request with status ${statusText(payout.status)}. The history updates when RazorpayX confirms the transfer.`);
      }
    } catch (reason) {
      const statusCode = (reason as { response?: { status?: number } })?.response?.status;
      if (statusCode && statusCode < 500) setAttempt(null);
      setError(reason instanceof Error
        ? reason.message
        : "Payout confirmation is pending. Retry only this same request; do not create a second payout.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="text-sm font-bold">RazorpayX payments</h3><p className="mt-1 text-[11px] leading-5 text-[#7183a0]">Send an INR payout and keep its salary month and provider status in the employee history.</p></div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${payoutMethod ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{payoutMethod ? "Destination ready" : "Destination not set"}</span>
      </div>
      {error ? <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
      {notice ? <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{notice}</p> : null}
      {!payoutsEnabled ? <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">RazorpayX is not configured. Add the server credentials, account number, and webhook secret before initiating payouts.</p> : null}
      {payoutMethod ? <p className="mt-4 flex items-center gap-2 rounded-lg bg-[#f8fafc] px-3 py-2.5 text-xs text-[#34445f]"><ShieldCheck size={14} className="shrink-0 text-emerald-600"/>{payoutMethod.displayLabel}</p> : <p className="mt-4 rounded-lg bg-[#f8fafc] px-3 py-2.5 text-xs leading-5 text-[#657795]">This person must add a bank account or UPI destination from My Payments before HR can pay them.</p>}

      <form onSubmit={(event) => void createPayout(event)} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-[#52627a]">Amount (INR)<input required type="number" min="1" step="0.01" value={attempt?.amount ?? form.amount} disabled={!payoutsEnabled || !payoutMethod || Boolean(attempt) || saving} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} className={`${inputClass} mt-1.5`}/></label>
        <label className="text-xs font-semibold text-[#52627a]">Pay period<input required type="month" value={attempt?.payPeriod ?? form.payPeriod} disabled={!payoutsEnabled || !payoutMethod || Boolean(attempt) || saving} onChange={(event) => setForm((current) => ({ ...current, payPeriod: event.target.value }))} className={`${inputClass} mt-1.5`}/></label>
        <label className="text-xs font-semibold text-[#52627a]">Transfer mode<select value={attempt?.mode ?? form.mode} disabled={!payoutsEnabled || !payoutMethod || payoutMethod.accountType === "VPA" || Boolean(attempt) || saving} onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value as PayoutMode }))} className={`${inputClass} mt-1.5`}>{payoutMethod?.accountType === "VPA" ? <option value="UPI">UPI</option> : <><option value="IMPS">IMPS</option><option value="NEFT">NEFT</option><option value="RTGS">RTGS</option></>}</select></label>
        <label className="text-xs font-semibold text-[#52627a]">Payment details<input required maxLength={240} value={attempt?.description ?? form.description} disabled={!payoutsEnabled || !payoutMethod || Boolean(attempt) || saving} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Monthly salary, incentive…" className={`${inputClass} mt-1.5`}/></label>
        {!attempt ? <label className="flex items-start gap-2 text-[11px] leading-5 text-[#52627a] sm:col-span-2"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={!payoutsEnabled || !payoutMethod || saving} className="mt-1 accent-[#1645a2]"/>I confirm this amount, pay period, recipient, and transfer mode before initiating a real RazorpayX payout.</label> : <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 sm:col-span-2">This payout request is not confirmed yet. Retry will use the same idempotency key and details. Do not start another payout while this request is unresolved.</p>}
        <button type="submit" disabled={!payoutsEnabled || !payoutMethod || saving || (!attempt && !confirmed)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#1645a2] px-4 text-xs font-bold text-white disabled:opacity-50 sm:col-span-2">{saving ? <LoaderCircle size={14} className="animate-spin"/> : attempt ? <RefreshCw size={14}/> : <Banknote size={15}/>} {saving ? "Sending payout…" : attempt ? "Retry the same payout" : "Send payout"}</button>
      </form>

      <div className="mt-5 border-t border-[#edf0f5] pt-4">
        <h4 className="text-xs font-bold">Payment history</h4>
        {loading ? <p role="status" className="py-4 text-xs text-[#7183a0]">Loading payout history…</p> : null}
        {!loading && !payouts.length ? <p className="py-5 text-center text-xs text-[#7183a0]">No payments recorded for this person.</p> : null}
        <ul className="mt-2 divide-y divide-[#edf0f5]">
          {payouts.map((payout) => <li key={payout.id} className="flex flex-wrap items-center gap-2 py-3">
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#34445f]">{monthLabel(payout.payPeriod)} · {payout.description}</p><p className="mt-1 text-[10px] text-[#7183a0]">{payout.mode} · {payout.utr ? `UTR ${payout.utr}` : `Ref ${payout.referenceId}`}</p>{payout.statusDetails ? <p className="mt-1 text-[10px] text-[#7183a0]">{payout.statusDetails}</p> : null}</div>
            <span className="text-xs font-bold text-[#17233a]">{amountLabel(payout.amount)}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusStyle(payout.status)}`}>{statusText(payout.status)}</span>
          </li>)}
        </ul>
      </div>
    </section>
  );
}
