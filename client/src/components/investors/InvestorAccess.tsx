import Link from "next/link";
import { ArrowRight, LockKeyhole, PanelsTopLeft, ShieldCheck } from "lucide-react";

export function InvestorAccess() {
  return (
    <section className="py-16 md:py-24">
      <div className="container-ricoz">
        <div className="relative isolate grid gap-8 overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(ellipse_at_90%_0%,rgba(201,29,32,0.28),transparent_38%),linear-gradient(125deg,#101a2c,#1d2a40)] p-6 text-white shadow-(--shadow-xl) sm:p-8 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-36 -left-24 size-72 rounded-full border border-white/5" />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red-soft)">Investor access</p>
            <h2 className="mt-3! text-3xl font-black leading-tight tracking-[-0.055em] text-white md:text-4xl">
              Want to look closer?
            </h2>
            <p className="mt-4! max-w-xl text-base leading-7 text-white/75">
              Create an investor account to continue into the Ricoz investor
              experience. Detailed company information belongs behind authenticated access.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/signup?role=investor" className="ricoz-button-primary rounded-full! px-5!">
                Create investor account <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/login" className="ricoz-button-secondary rounded-full! border-white/20! bg-white/5! px-5! text-white! hover:bg-white/10! hover:text-white!">
                Sign in
              </Link>
            </div>
          </div>
          <div className="relative rounded-[24px] border border-white/10 bg-white/5 p-5 backdrop-blur-sm md:p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-(--brand-red)">
                <LockKeyhole size={18} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">Investor experience</p>
                <p className="text-xs text-white/55">Available after account access</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <PanelsTopLeft size={16} className="text-(--brand-red-soft)" aria-hidden="true" />
                <p className="mt-3! text-xs text-white/60">Business overview</p>
                <p className="mt-2! text-sm font-semibold text-white/75" aria-label="Details available after sign in">••••••</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <ShieldCheck size={16} className="text-(--brand-red-soft)" aria-hidden="true" />
                <p className="mt-3! text-xs text-white/60">Investor updates</p>
                <p className="mt-2! text-sm font-semibold text-white/75" aria-label="Details available after sign in">••••••</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <LockKeyhole size={16} className="text-(--brand-red-soft)" aria-hidden="true" />
                <p className="mt-3! text-xs text-white/60">Private details</p>
                <p className="mt-2! text-sm font-semibold text-white/75" aria-label="Details available after sign in">••••••</p>
              </div>
            </div>
            <p className="mt-5! text-xs leading-5 text-white/50">
              Preview only. No private metrics or financial information are displayed publicly.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
