const process = [
  {
    step: "01",
    title: "Discover",
    description: "Understand your business, requirements, users, and goals.",
  },
  {
    step: "02",
    title: "Plan",
    description: "Define scope, architecture, technology direction, and milestones.",
  },
  {
    step: "03",
    title: "Design",
    description: "Create the experience, product structure, and technical blueprint.",
  },
  {
    step: "04",
    title: "Build",
    description: "Develop, test, and integrate the solution with quality in mind.",
  },
  {
    step: "05",
    title: "Launch",
    description: "Deploy the product and make it ready for real-world use.",
  },
  {
    step: "06",
    title: "Improve",
    description: "Keep refining the product based on business needs and performance.",
  },
];

export function ServiceProcess() {
  return (
    <section className="border-y border-[var(--brand-border)] bg-[var(--brand-surface)] py-20">
      <div className="container-ricoz">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">
            How we work
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-[var(--brand-navy)] md:text-4xl">
            A clear process for moving from idea to delivery.
          </h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {process.map(({ step, title, description }) => (
            <div key={step} className="rounded-[20px] border border-[var(--brand-border)] bg-white p-5 shadow-[var(--shadow-sm)]">
              <p className="text-sm font-black tracking-[0.12em] text-[var(--brand-red)]">{step}</p>
              <h3 className="mt-4 text-xl font-bold tracking-[-0.04em] text-[var(--brand-navy)]">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--brand-text-secondary)]">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
