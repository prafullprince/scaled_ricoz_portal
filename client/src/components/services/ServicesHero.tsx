import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Cloud, Code2, Rocket } from "lucide-react";

export function ServicesHero() {
  return (
    <section className="border-b border-(--brand-border) bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fa_100%)]">
      <div className="container-ricoz grid gap-12 py-14 md:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">
            RICOZ SERVICES
          </p>
          <h1 className="mt-4 max-w-xl text-4xl font-black tracking-[-0.06em] text-[var(--brand-navy)] md:text-5xl">
            Technology solutions built around your business.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[var(--brand-text-secondary)] md:text-lg">
            Ricoz helps businesses design, build, improve, and scale digital products, internal systems, and technology experiences that support stronger operations and long-term growth.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/services#service-marketplace" className="ricoz-button-primary">
              Book a service
              <ArrowRight size={16} />
            </Link>
            <Link href="/services#service-marketplace" className="ricoz-button-secondary">
              Explore services
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -left-8 top-8 h-24 w-24 rounded-full bg-[var(--brand-red-soft)] blur-3xl" />
          <div className="absolute -bottom-4 right-2 h-24 w-24 rounded-full bg-[var(--brand-red-pale)] blur-3xl" />

          <div className="relative rounded-[24px] border border-[var(--brand-border)] bg-[var(--brand-background)] p-4 shadow-[var(--shadow-xl)]">
            <div className="rounded-[20px] border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--brand-red)] text-white">
                  <BriefcaseBusiness size={18} />
                </div>
                <span className="rounded-full border border-[var(--brand-border)] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-gray)]">
                  Strategy to launch
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Strategy", icon: Rocket },
                  { label: "Design", icon: BriefcaseBusiness },
                  { label: "Build", icon: Code2 },
                  { label: "Deploy", icon: Cloud },
                ].map(({ label, icon: Icon }) => (
                  <div key={label} className="rounded-[16px] border border-[var(--brand-border)] bg-white p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--brand-red-pale)] text-[var(--brand-red)]">
                      <Icon size={16} aria-hidden="true" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[var(--brand-navy)]">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-[16px] border border-[var(--brand-border)] bg-[var(--brand-navy)] p-4 text-white">
                <p className="text-xs uppercase tracking-[0.14em] text-white/60">Project flow</p>
                <div className="mt-3 space-y-2 text-sm text-white/80">
                  <div className="flex items-center justify-between">
                    <span>Discover</span>
                    <span className="text-[var(--brand-red)]">01</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Design</span>
                    <span className="text-[var(--brand-red)]">02</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Build</span>
                    <span className="text-[var(--brand-red)]">03</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
