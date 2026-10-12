const examples = [
  {
    problem: "I need a business website.",
    solution: "Web Development",
  },
  {
    problem: "I need a custom internal platform.",
    solution: "Custom Software Development",
  },
  {
    problem: "I want to automate repetitive workflows.",
    solution: "Business Automation",
  },
  {
    problem: "I want to launch an AI-powered product.",
    solution: "AI Solutions",
  },
  {
    problem: "I need better product experience design.",
    solution: "UI/UX Development",
  },
  {
    problem: "I need operational stability and scale.",
    solution: "Cloud & Deployment",
  },
];

export function ProblemSolutions() {
  return (
    <section className="bg-[var(--brand-surface)] py-20">
      <div className="container-ricoz">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">
            Problem → solution
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-[var(--brand-navy)] md:text-4xl">
            Have a problem? Let&apos;s turn it into a product.
          </h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {examples.map(({ problem, solution }) => (
            <div key={problem} className="rounded-[20px] border border-[var(--brand-border)] bg-[var(--brand-background)] p-5 shadow-[var(--shadow-sm)]">
              <p className="text-sm leading-6 text-[var(--brand-text-secondary)]">{problem}</p>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--brand-border)] pt-4">
                <span className="text-sm font-semibold text-[var(--brand-navy)]">→</span>
                <span className="text-sm font-semibold text-[var(--brand-red)]">{solution}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
