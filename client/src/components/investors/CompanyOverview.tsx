import { investorPillars } from "@/lib/investors/content";

export function CompanyOverview() {
  return (
    <section className="py-16 md:py-24">
      <div className="container-ricoz">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red)">Ricoz at a glance</p>
            <h2 className="mt-3! max-w-2xl text-3xl font-black leading-tight tracking-[-0.055em] text-(--brand-navy) md:text-4xl">
              A technology company building around modern business needs.
            </h2>
          </div>
          <p className="max-w-xl text-base leading-7 text-(--brand-text-secondary) lg:justify-self-end">
            Ricoz brings together software products, technology services, and
            business-focused solutions. The public story is intentionally high-level;
            detailed company information belongs inside the investor experience.
          </p>
        </div>
        <div id="ecosystem" className="mt-9 grid scroll-mt-24 gap-4 md:grid-cols-3">
          {investorPillars.map(({ title, description, icon: Icon }, index) => (
            <article
              key={title}
              className="group relative overflow-hidden rounded-[24px] border border-(--brand-border) bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-(--brand-red)/25 hover:shadow-(--shadow-lg)"
            >
              <span className="absolute right-5 top-5 text-xs font-bold tracking-[0.14em] text-(--brand-gray)/60">
                0{index + 1}
              </span>
              <span className="flex size-12 items-center justify-center rounded-2xl bg-(--brand-red-pale) text-(--brand-red) transition-colors group-hover:bg-(--brand-red) group-hover:text-white">
                <Icon size={20} aria-hidden="true" />
              </span>
              <h3 className="mt-6! text-xl font-bold tracking-[-0.04em] text-(--brand-navy)">{title}</h3>
              <p className="mt-3! text-sm leading-6 text-(--brand-text-secondary)">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
