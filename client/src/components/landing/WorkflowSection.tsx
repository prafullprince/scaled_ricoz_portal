const steps = [
  {
    number: "01",
    title: "Tell us what you need",
    description: "Share the challenge, opportunity, or product idea you want to move forward.",
  },
  {
    number: "02",
    title: "We understand the problem",
    description: "We clarify the business context, user needs, and strategic priorities that matter most.",
  },
  {
    number: "03",
    title: "We design the solution",
    description: "We map the path forward, define scope, and shape the right product or technology approach.",
  },
  {
    number: "04",
    title: "We build and deliver",
    description: "We design, develop, and validate the solution with a clear emphasis on quality and outcome.",
  },
  {
    number: "05",
    title: "We support and improve",
    description: "After launch, we help refine, optimize, and evolve the solution as the business grows.",
  },
];

export function WorkflowSection() {
  return (
    <section className="border-y border-[var(--brand-border)] bg-[var(--brand-surface)] py-20">
      <div className="container-ricoz">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">
            How we work
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-[var(--brand-navy)] md:text-4xl">
            A practical process for building what matters.
          </h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {steps.map(({ number, title, description }) => (
            <div key={number} className="rounded-[20px] border border-[var(--brand-border)] bg-[var(--brand-background)] p-5 shadow-[var(--shadow-sm)]">
              <p className="text-sm font-black tracking-[0.12em] text-[var(--brand-red)]">{number}</p>
              <h3 className="mt-4 text-xl font-bold tracking-[-0.04em] text-[var(--brand-navy)]">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[var(--brand-text-secondary)]">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
