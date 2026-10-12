"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Banknote, LoaderCircle, ShieldCheck } from "lucide-react";
import {
  HrPayoutsService,
  type PayoutMethod,
  type PayoutRecord,
} from "@/services/hr-payouts.service";

const fieldClass = "h-10 w-full rounded-lg border border-(--brand-border) bg-white px-3 text-sm text-(--brand-text) outline-none focus:border-(--brand-navy) focus:ring-2 focus:ring-(--brand-navy)/10";
const dateLabel = (value: string) => new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const monthLabel = (value: string) => new Date(`${value}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const statusText = (status: PayoutRecord["status"]) => status === "PROCESSED"
  ? "Received"
  : status === "REQUESTED"
    ? "Awaiting confirmation"
    : status.charAt(0) + status.slice(1).toLowerCase();

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value);
}

export function MyPayoutWorkspace() {
  const [method, setMethod] = useState<PayoutMethod | null>(null);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [accountType, setAccountType] = useState<"BANK_ACCOUNT" | "VPA">("BANK_ACCOUNT");
  const [name, setName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [address, setAddress] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([HrPayoutsService.myMethod(), HrPayoutsService.myPayouts()])
      .then(([profile, history]) => {
        if (!active) return;
        setMethod(profile.payoutMethod);
        setEnabled(profile.payoutsEnabled && history.payoutsEnabled);
        setPayouts(history.payouts);
        setAccountType(profile.payoutMethod?.accountType ?? "BANK_ACCOUNT");
        setEditing(!profile.payoutMethod);
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Payout information could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function saveMethod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = accountType === "BANK_ACCOUNT"
        ? await HrPayoutsService.saveMyMethod({
          accountType,
          name: name.trim(),
          accountNumber: accountNumber.trim(),
          ifsc: ifsc.trim().toUpperCase(),
        })
        : await HrPayoutsService.saveMyMethod({ accountType, address: address.trim() });
      setMethod(saved);
      setName("");
      setAccountNumber("");
      setIfsc("");
      setAddress("");
      setEditing(false);
      setNotice("Your payout destination was securely registered with RazorpayX.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your payout destination could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="mx-auto max-w-4xl space-y-6 text-(--brand-text)">
    <header className="rounded-2xl border border-(--brand-border) bg-[linear-gradient(120deg,#fff_0%,#f2f6ff_100%)] p-6">
      <span className="inline-flex size-10 items-center justify-center rounded-xl bg-(--brand-red-pale) text-(--brand-red)"><Banknote size={20}/></span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">My payments</h1>
      <p className="mt-2 text-sm leading-6 text-(--brand-text-secondary)">Manage your payout destination and see the months for which HR has sent payments.</p>
    </header>
    {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    {notice ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p> : null}
    {!enabled ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">RazorpayX payouts are not configured yet. You can return after your company administrator completes the server and webhook setup.</p> : null}

    <section className="rounded-2xl border border-(--brand-border) bg-white p-5 shadow-(--shadow-sm)">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-bold">Payout destination</h2><p className="mt-1 text-xs text-(--brand-text-secondary)">Your full bank or UPI details are sent to RazorpayX. Ricoz stores only the provider reference and a masked label.</p></div>{method ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700"><ShieldCheck size={13}/>Registered</span> : null}</div>
      {loading ? <p role="status" className="py-7 text-sm text-(--brand-text-secondary)">Loading payout information…</p> : null}
      {!loading && method && !editing ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-(--brand-surface) p-4"><div><p className="text-sm font-semibold">{method.displayLabel}</p><p className="mt-1 text-xs text-(--brand-text-secondary)">{method.accountType === "VPA" ? "UPI payout destination" : "Bank account payout destination"}</p></div><button type="button" onClick={() => { setAccountType(method.accountType); setEditing(true); }} className="h-9 rounded-lg border border-(--brand-border) px-3 text-xs font-semibold text-(--brand-navy)">Change details</button></div> : null}
      {!loading && editing ? <form onSubmit={(event) => void saveMethod(event)} className="mt-5 space-y-4">
        <label className="block text-xs font-semibold">Destination type<select value={accountType} onChange={(event) => setAccountType(event.target.value as "BANK_ACCOUNT" | "VPA")} disabled={saving} className={`${fieldClass} mt-1.5`}><option value="BANK_ACCOUNT">Bank account</option><option value="VPA">UPI ID</option></select></label>
        {accountType === "BANK_ACCOUNT" ? <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold">Account holder name<input required minLength={3} maxLength={120} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} disabled={saving} className={`${fieldClass} mt-1.5`}/></label>
          <label className="text-xs font-semibold">Account number<input required minLength={5} maxLength={35} inputMode="numeric" autoComplete="off" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} disabled={saving} className={`${fieldClass} mt-1.5`}/></label>
          <label className="text-xs font-semibold sm:col-span-2">IFSC code<input required minLength={11} maxLength={11} autoCapitalize="characters" value={ifsc} onChange={(event) => setIfsc(event.target.value.toUpperCase())} disabled={saving} className={`${fieldClass} mt-1.5`}/></label>
        </div> : <label className="block text-xs font-semibold">UPI ID<input required minLength={3} maxLength={100} autoComplete="off" value={address} onChange={(event) => setAddress(event.target.value)} disabled={saving} placeholder="name@bank" className={`${fieldClass} mt-1.5`}/></label>}
        <p className="rounded-lg bg-(--brand-surface) p-3 text-xs leading-5 text-(--brand-text-secondary)">The destination is registered with RazorpayX for company payouts. It is not saved as a raw account number or UPI ID in Ricoz.</p>
        <div className="flex flex-wrap gap-2"><button type="submit" disabled={saving || !enabled} className="inline-flex h-10 items-center gap-2 rounded-lg bg-(--brand-navy) px-4 text-xs font-bold text-white disabled:opacity-50">{saving ? <LoaderCircle size={14} className="animate-spin"/> : <ShieldCheck size={14}/>}Save payout destination</button>{method ? <button type="button" onClick={() => setEditing(false)} disabled={saving} className="h-10 rounded-lg border border-(--brand-border) px-4 text-xs font-semibold">Cancel</button> : null}</div>
      </form> : null}
    </section>

    <section className="rounded-2xl border border-(--brand-border) bg-white p-5 shadow-(--shadow-sm)">
      <h2 className="text-sm font-bold">Payment history</h2>
      <p className="mt-1 text-xs text-(--brand-text-secondary)">A payment is marked received only after RazorpayX confirms that it was processed.</p>
      {!loading && payouts.length === 0 ? <div className="py-10 text-center"><Banknote size={22} className="mx-auto text-(--brand-text-muted)"/><p className="mt-2 text-sm font-semibold">No payments recorded</p></div> : null}
      <ul className="mt-2 divide-y divide-(--brand-border)">
        {payouts.map((payout) => <li key={payout.id} className="flex flex-wrap items-center gap-3 py-4">
          <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold">{monthLabel(payout.payPeriod)} · {payout.description}</h3><p className="mt-1 truncate text-xs text-(--brand-text-secondary)">{dateLabel(payout.createdAt)} · {payout.mode}{payout.utr ? ` · UTR ${payout.utr}` : ""}</p>{payout.statusDetails ? <p className="mt-1 text-xs text-(--brand-text-secondary)">{payout.statusDetails}</p> : null}</div>
          <span className="text-sm font-bold">{money(payout.amount)}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${payout.status === "PROCESSED" ? "bg-emerald-50 text-emerald-700" : ["FAILED", "REJECTED", "REVERSED", "CANCELLED"].includes(payout.status) ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>{statusText(payout.status)}</span>
        </li>)}
      </ul>
    </section>
  </main>;
}
