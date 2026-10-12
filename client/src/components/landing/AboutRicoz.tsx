import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Building2, ChartNoAxesCombined, FolderKanban, Sparkles } from "lucide-react";

const ecosystemItems = [
  { label: "Products", icon: FolderKanban },
  { label: "Services", icon: BriefcaseBusiness },
  { label: "Technology", icon: Sparkles },
  { label: "Business Solutions", icon: ChartNoAxesCombined },
  { label: "Talent", icon: Building2 },
];

export function AboutRicoz() {
  return (
    <section id="about" className="py-20">
      <div className="container-ricoz grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--brand-red)]">
            About Ricoz
          </p>
          <h2 className="mt-4 max-w-md text-3xl font-black tracking-[-0.06em] text-[var(--brand-navy)] md:text-4xl">
            Technology built for real business outcomes.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-[var(--brand-text-secondary)]">
            Ricoz is a technology company that builds products and delivers practical digital solutions for modern businesses. We help companies improve operations, launch digital experiences, and create stronger customer and internal systems.
          </p>
          <p className="mt-3 max-w-xl text-base leading-7 text-[var(--brand-text-secondary)]">
            From product design to software delivery, our work is rooted in business clarity, technical execution, and long-term value creation.
          </p>

          <Link href="/contact" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-red)] hover:text-[var(--brand-red-hover)]">
            Learn how we work
            <ArrowRight size={15} />
          </Link>
        </div>

        <div className="rounded-[24px] border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ecosystemItems.map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="rounded-[16px] border border-[var(--brand-border)] bg-white p-4 shadow-[var(--shadow-xs)]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[var(--brand-red-pale)] text-[var(--brand-red)]">
                  <Icon size={18} />
                </div>
                <p className="mt-4 text-sm font-semibold text-[var(--brand-navy)]">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[18px] border border-[var(--brand-border)] bg-[var(--brand-navy)] p-5 text-white">
            <p className="text-xs uppercase tracking-[0.14em] text-white/60">We build with focus</p>
            <div className="mt-4 flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-sm text-white/80">Digital products</span>
              <span className="text-sm font-semibold text-[var(--brand-red)]">Strategy</span>
            </div>
            <div className="mt-3 flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-sm text-white/80">Business systems</span>
              <span className="text-sm font-semibold text-[var(--brand-red)]">Delivery</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-white/80">Long-term growth</span>
              <span className="text-sm font-semibold text-[var(--brand-red)]">Scale</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
