const audiences = [
  ["Startups", "Turn an early idea or workflow into a focused product foundation."],
  ["Small businesses", "Connect everyday operations and reduce avoidable manual work."],
  ["Growing companies", "Extend systems and workflows as business complexity increases."],
  ["Founders and product teams", "Move from a business opportunity to a useful digital experience."],
];

export function WhoWeHelp() {
  return (
    <section className="py-20">
      <div className="container-ricoz grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">Who we help</p><h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-[var(--brand-navy)] md:text-4xl">Solutions for teams building what comes next.</h2></div>
        <div className="grid gap-4 sm:grid-cols-2">{audiences.map(([title, description]) => <div key={title} className="border-l-2 border-[var(--brand-red)] pl-4"><h3 className="text-lg font-bold tracking-[-0.03em] text-[var(--brand-navy)]">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--brand-text-secondary)]">{description}</p></div>)}</div>
      </div>
    </section>
  );
}
