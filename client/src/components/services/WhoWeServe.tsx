const audiences = [
  {
    title: "Startups",
    description: "Launch MVPs, shape product direction, and establish a scalable technical foundation.",
  },
  {
    title: "Small businesses",
    description: "Improve operations, connect systems, and build better customer experiences with practical technology.",
  },
  {
    title: "Growing companies",
    description: "Scale internal processes, streamline delivery, and support more complex business operations.",
  },
  {
    title: "Product teams",
    description: "Build, improve, and extend software experiences with a dependable technology partner.",
  },
];

export function WhoWeServe() {
  return (
    <section className="py-20">
      <div className="container-ricoz">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">
            Who we serve
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-[var(--brand-navy)] md:text-4xl">
            Businesses that need technology to work harder for them.
          </h2>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {audiences.map(({ title, description }) => (
            <div key={title} className="rounded-[22px] border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 shadow-[var(--shadow-sm)]">
              <h3 className="text-xl font-bold tracking-[-0.04em] text-[var(--brand-navy)]">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--brand-text-secondary)]">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
