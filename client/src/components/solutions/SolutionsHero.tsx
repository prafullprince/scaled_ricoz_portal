import Link from "next/link";
import { ArrowDown, ArrowRight, BriefcaseBusiness, Check, Cog, TrendingUp } from "lucide-react";

const flow = [
  { label: "Business challenge", icon: BriefcaseBusiness },
  { label: "Ricoz solution", icon: Cog },
  { label: "Business outcome", icon: TrendingUp },
];

export function SolutionsHero() {
  return (
    <section className="border-b border-[var(--brand-border)] bg-[linear-gradient(180deg,_#ffffff_0%,_#f7f8fa_100%)]">
      <div className="container-ricoz grid gap-12 py-14 md:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">RICOZ SOLUTIONS</p>
          <h1 className="mt-4 max-w-xl text-4xl font-black tracking-[-0.06em] text-[var(--brand-navy)] md:text-5xl">
            Turn complex business challenges into scalable solutions.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[var(--brand-text-secondary)] md:text-lg">
            Ricoz helps businesses solve operational, financial, technology, automation, communication, and digital product challenges through products, software, and technology services.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="#solutions-contact" className="ricoz-button-primary">Talk to Ricoz <ArrowRight size={16} /></Link>
            <Link href="#solution-categories" className="ricoz-button-secondary">Explore solutions</Link>
          </div>
        </div>

        <div className="relative rounded-[26px] border border-[var(--brand-border)] bg-[var(--brand-background)] p-4 shadow-[var(--shadow-xl)]">
          <div className="rounded-[20px] border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-gray)]">From challenge to outcome</p>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-red-pale)] text-[var(--brand-red)]"><Check size={15} /></span>
            </div>
            <div className="mt-6 space-y-3">
              {flow.map(({ label, icon: Icon }, index) => (
                <div key={label}>
                  <div className={`flex items-center gap-4 rounded-[16px] border p-4 ${index === 1 ? "border-[var(--brand-red-soft)] bg-[var(--brand-red-pale)]" : "border-[var(--brand-border)] bg-white"}`}>
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${index === 1 ? "bg-[var(--brand-red)] text-white" : "bg-[var(--brand-surface)] text-[var(--brand-red)]"}`}><Icon size={17} aria-hidden="true" /></span>
                    <div><p className="text-xs uppercase tracking-[0.12em] text-[var(--brand-gray)]">0{index + 1}</p><p className="mt-1 text-sm font-semibold text-[var(--brand-navy)]">{label}</p></div>
                  </div>
                  {index < flow.length - 1 ? <div className="flex justify-center py-1 text-[var(--brand-red)]"><ArrowDown size={16} /></div> : null}
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm leading-6 text-[var(--brand-text-secondary)]">A practical path from understanding the problem to building the right technology response.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
