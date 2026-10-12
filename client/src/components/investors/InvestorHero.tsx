import Link from "next/link";
import { ArrowDown, ArrowRight, Boxes, Network, Sparkles } from "lucide-react";

export function InvestorHero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-(--brand-border) bg-[radial-gradient(ellipse_at_82%_8%,rgba(201,29,32,0.1),transparent_34%),linear-gradient(180deg,var(--brand-background),var(--brand-surface))]">
      <div aria-hidden="true" className="pointer-events-none absolute -right-36 -top-24 hidden size-[34rem] rounded-full border border-(--brand-red)/10 md:block" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-8 top-0 hidden size-72 rounded-full border border-(--brand-red)/10 md:block" />
      <div className="container-ricoz relative grid gap-10 py-14 md:grid-cols-[1.05fr_0.95fr] md:items-center md:gap-8 md:py-20">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-(--brand-red)/15 bg-(--brand-red-pale) px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red)">
            <Sparkles size={14} aria-hidden="true" />
            Ricoz investors
          </p>
          <h1 className="mt-6! text-4xl font-black leading-[1.02] tracking-[-0.06em] text-(--brand-navy) sm:text-5xl xl:text-6xl">
            Building technology.
            <span className="block text-(--brand-red)">Creating what comes next.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-(--brand-text-secondary) md:text-lg md:leading-8">
            Ricoz is building products, services, and business solutions for modern
            companies. Explore the high-level direction behind the ecosystem, then
            create an investor account to learn more.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="#ecosystem" className="ricoz-button-primary rounded-full! px-5!">
              Explore Ricoz <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/signup?role=investor" className="ricoz-button-secondary rounded-full! px-5!">
              Create investor account
            </Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-lg overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_80%_0%,rgba(201,29,32,0.35),transparent_40%),linear-gradient(145deg,#101a2c,#24324b)] p-3 text-white shadow-(--shadow-xl)">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full border border-white/10" />
          <div className="relative rounded-[23px] border border-white/10 bg-white/5 p-5 backdrop-blur-sm md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">The Ricoz ecosystem</p>
                <p className="mt-1 text-lg font-bold tracking-[-0.03em] text-white">One connected direction</p>
              </div>
              <span className="flex size-10 items-center justify-center rounded-2xl bg-(--brand-red) shadow-(--shadow-brand)">
                <Sparkles size={17} aria-hidden="true" />
              </span>
            </div>
            <div className="mt-6 space-y-2.5">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-(--brand-red-soft)">
                  <Boxes size={18} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">01</p>
                  <p className="mt-0.5 text-sm font-semibold">Products</p>
                </div>
              </div>
              <div className="flex justify-center text-(--brand-red-soft)">
                <ArrowDown size={15} aria-hidden="true" />
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-(--brand-red-soft)/50 bg-(--brand-red) p-3.5 shadow-(--shadow-brand)">
                <span className="flex size-10 items-center justify-center rounded-xl bg-white/15">
                  <Network size={18} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">02</p>
                  <p className="mt-0.5 text-sm font-semibold">Services + solutions</p>
                </div>
              </div>
              <div className="flex justify-center text-(--brand-red-soft)">
                <ArrowDown size={15} aria-hidden="true" />
              </div>
              <div className="rounded-2xl border border-white/10 bg-white p-3.5 text-(--brand-navy)">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--brand-gray)">03</p>
                <p className="mt-0.5 text-sm font-bold">Business value</p>
              </div>
            </div>
            <p className="mt-5 text-xs leading-5 text-white/60">
              Useful technology, shaped around real business needs.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
