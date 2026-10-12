const capabilities = ["Next.js", "React", "TypeScript", "Node.js", "MongoDB", "PostgreSQL", "API development", "Cloud deployment", "AI integrations", "Automation"];

export function TechnologyCapabilities() {
  return <section className="py-16"><div className="container-ricoz flex flex-col gap-6 md:flex-row md:items-center md:justify-between"><div className="max-w-md"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">Technology capabilities</p><h2 className="mt-3 text-2xl font-black tracking-[-0.05em] text-[var(--brand-navy)]">The execution layer behind the solution.</h2></div><div className="flex max-w-2xl flex-wrap gap-2.5">{capabilities.map((capability) => <span key={capability} className="rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3.5 py-2 text-sm font-medium text-[var(--brand-navy)]">{capability}</span>)}</div></div></section>;
}
