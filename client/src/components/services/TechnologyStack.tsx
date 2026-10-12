const stacks = [
  "Next.js",
  "React",
  "Node.js",
  "TypeScript",
  "MongoDB",
  "PostgreSQL",
  "AI integrations",
  "Cloud hosting",
  "API development",
  "DevOps",
  "Automation",
  "Analytics",
];

export function TechnologyStack() {
  return (
    <section className="py-20">
      <div className="container-ricoz">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">
            Tech stack
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-[var(--brand-navy)] md:text-4xl">
            Flexible systems built for speed, scale, and reliability.
          </h2>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          {stacks.map((item) => (
            <span
              key={item}
              className="rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)] px-4 py-2 text-sm font-medium text-[var(--brand-navy)]"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
