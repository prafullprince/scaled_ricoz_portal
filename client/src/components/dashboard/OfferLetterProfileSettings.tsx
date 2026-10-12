"use client";

import Link from "next/link";
import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import { ArrowLeft, Building2, ImagePlus, LoaderCircle, Save, ShieldCheck, Signature } from "lucide-react";
import { RecruitmentService, type OfferLetterProfile } from "@/services/recruitment.service";

type ImageField = "logoDataUrl" | "signatureDataUrl";

export function OfferLetterProfileSettings() {
  const [profile, setProfile] = useState<OfferLetterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loadRevision, setLoadRevision] = useState(0);

  useEffect(() => {
    let active = true;
    RecruitmentService.offerLetterProfile()
      .then((value) => { if (active) setProfile(value); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Offer-letter profile could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadRevision]);

  function setField<Key extends keyof OfferLetterProfile>(key: Key, value: OfferLetterProfile[Key]) {
    setProfile((current) => current ? { ...current, [key]: value } : current);
  }

  function readImage(event: ChangeEvent<HTMLInputElement>, field: ImageField) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > 70 * 1024) {
      setError("Branding images must be 70 KB or smaller.");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onerror = () => setError("The selected image could not be read.");
    reader.onload = () => {
      if (typeof reader.result === "string") setField(field, reader.result);
      else setError("The selected image could not be read.");
    };
    reader.readAsDataURL(file);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      setProfile(await RecruitmentService.saveOfferLetterProfile(profile));
      setNotice("Company offer-letter profile saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The company offer-letter profile could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="mx-auto w-full max-w-5xl space-y-5 pb-10 text-slate-800">
    <Link href="/dashboard/admin/recruitment-pipeline" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950">
      <ArrowLeft size={16}/> Back to recruitment pipeline
    </Link>
    <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-xl sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-blue-200 ring-1 ring-white/15"><Building2 size={22}/></span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200">Company settings</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Offer letter profile</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Manage the company branding, contact details, and authorized sign-off used in generated offer letters.</p>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-slate-300"><ShieldCheck size={15} className="text-emerald-300"/>Profile changes are saved as a snapshot in each newly generated offer.</div>
    </header>
    {error ? <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    {notice ? <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p> : null}
    {loading ? <div role="status" className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-16 text-sm text-slate-500 shadow-sm"><LoaderCircle size={18} className="animate-spin"/>Loading company profile…</div> : !profile ? <section className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm"><p className="text-sm font-semibold text-slate-700">Company profile is unavailable.</p><button type="button" onClick={() => { setError(""); setLoading(true); setLoadRevision((value) => value + 1); }} className="mt-4 inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Try again</button></section> : <form onSubmit={(event) => void save(event)} className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <SectionHeading icon={<Building2 size={17}/>} title="Company letterhead" description="Set the legal identity and contact details shown on the offer."/>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Legal company name"><input required minLength={2} maxLength={200} value={profile.legalName} onChange={(event) => setField("legalName", event.target.value)} className={inputClass}/></Field>
          <Field label="Company display name"><input required minLength={2} maxLength={120} value={profile.displayName} onChange={(event) => setField("displayName", event.target.value)} className={inputClass}/></Field>
          <Field label="Company address" className="sm:col-span-2"><textarea required minLength={5} maxLength={500} rows={3} value={profile.address} onChange={(event) => setField("address", event.target.value)} className={`${inputClass} h-auto min-h-24 resize-y py-3`}/></Field>
          <Field label="Company contact email"><input required type="email" maxLength={200} value={profile.contactEmail} onChange={(event) => setField("contactEmail", event.target.value)} className={inputClass}/></Field>
          <Field label="Company contact phone (optional)"><input maxLength={80} value={profile.contactPhone} onChange={(event) => setField("contactPhone", event.target.value)} className={inputClass}/></Field>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <SectionHeading icon={<ImagePlus size={17}/>} title="Branding assets" description="Upload clear, compact images for the company logo and authorized signature."/>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <ImageFieldControl label="Company logo" hint="PNG, JPEG, or WebP · max 70 KB" value={profile.logoDataUrl} onChange={(event) => readImage(event, "logoDataUrl")} onRemove={() => setField("logoDataUrl", "")}/>
          <ImageFieldControl label="Authorized signature" hint="Transparent PNG recommended · max 70 KB" value={profile.signatureDataUrl} onChange={(event) => readImage(event, "signatureDataUrl")} onRemove={() => setField("signatureDataUrl", "")}/>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <SectionHeading icon={<Signature size={17}/>} title="People and sign-off" description="Choose the HR contact and authorized signatory for offer letters."/>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="HR contact name"><input required minLength={2} maxLength={120} value={profile.hrContactName} onChange={(event) => setField("hrContactName", event.target.value)} className={inputClass}/></Field>
          <Field label="HR contact email"><input required type="email" maxLength={200} value={profile.hrContactEmail} onChange={(event) => setField("hrContactEmail", event.target.value)} className={inputClass}/></Field>
          <Field label="Authorized signatory name"><input required minLength={2} maxLength={120} value={profile.signatoryName} onChange={(event) => setField("signatoryName", event.target.value)} className={inputClass}/></Field>
          <Field label="Signatory designation"><input required minLength={2} maxLength={120} value={profile.signatoryDesignation} onChange={(event) => setField("signatoryDesignation", event.target.value)} className={inputClass}/></Field>
        </div>
      </section>
      <footer className="flex flex-col-reverse items-stretch justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:px-6">
        <p className="text-xs leading-5 text-slate-500">Saving updates the profile used for offers generated from this point forward.</p>
        <button type="submit" disabled={saving} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60">{saving ? <LoaderCircle size={16} className="animate-spin"/> : <Save size={16}/>}Save profile</button>
      </footer>
    </form>}
  </main>;
}

const inputClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

function SectionHeading({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <header className="flex items-start gap-3 border-b border-slate-100 pb-4">
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">{icon}</span>
    <div><h2 className="text-sm font-bold text-slate-900">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div>
  </header>;
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={`block space-y-1.5 text-xs font-semibold tracking-wide text-slate-600 ${className ?? ""}`}>{label}{children}</label>;
}

function ImageFieldControl({ label, hint, value, onChange, onRemove }: {
  label: string;
  hint: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 shadow-sm transition hover:border-slate-300">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-xs font-semibold text-slate-700">{label}</p><p className="mt-1 text-[11px] text-slate-500">{hint}</p></div>
      {value ? <button type="button" onClick={onRemove} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-white hover:text-red-700">Remove</button> : null}
    </div>
    <div className="mt-4 flex min-h-28 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-4">
      {value ? <Image src={value} alt={`${label} preview`} width={320} height={100} unoptimized className="max-h-24 max-w-full object-contain"/> : <span className="flex flex-col items-center gap-2 text-xs font-medium text-slate-400"><ImagePlus size={19}/>{label} preview</span>}
    </div>
    <label className="mt-4 inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50/40">
      <Signature size={14}/>Choose image
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onChange} className="sr-only"/>
    </label>
  </div>;
}
