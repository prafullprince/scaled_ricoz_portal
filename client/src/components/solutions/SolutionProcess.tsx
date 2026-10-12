const steps = [
  ["01", "Understand", "Understand the business and the actual problem."],
  ["02", "Define", "Identify users, workflows, requirements, and constraints."],
  ["03", "Design", "Shape the right product or technology response."],
  ["04", "Build", "Develop and integrate the solution with care."],
  ["05", "Deploy", "Make the solution ready for production use."],
  ["06", "Improve", "Keep adapting as the business evolves."],
];

export function SolutionProcess() {
  return (
    <section className="border-y border-[var(--brand-border)] bg-[var(--brand-surface)] py-20"><div className="container-ricoz"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">How Ricoz solves problems</p><h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-[var(--brand-navy)] md:text-4xl">A thoughtful process from understanding to improvement.</h2></div><div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{steps.map(([number, title, description]) => <div key={number} className="rounded-[18px] border border-[var(--brand-border)] bg-white p-5"><p className="text-sm font-black tracking-[0.12em] text-[var(--brand-red)]">{number}</p><h3 className="mt-4 text-xl font-bold tracking-[-0.04em] text-[var(--brand-navy)]">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--brand-text-secondary)]">{description}</p></div>)}</div></div></section>
  );
}
