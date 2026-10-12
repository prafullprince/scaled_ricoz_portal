import { ArrowUpRight, Compass, Hammer, Sparkles, type LucideIcon } from "lucide-react";

const reasons: { title: string; description: string; icon: LucideIcon }[] = [
  { title: "Build real products", description: "Work on products and systems designed to solve concrete business problems.", icon: Hammer },
  { title: "Learn through practice", description: "Develop your skills through hands-on product, engineering, and delivery work.", icon: Sparkles },
  { title: "Take ownership", description: "Contribute to meaningful parts of the work and see how your decisions shape the result.", icon: ArrowUpRight },
  { title: "Keep perspective", description: "Connect technical decisions to users, teams, and the business context behind the work.", icon: Compass },
];

export function WhyRicoz() {
  return <section id="why-ricoz" className="py-20"><div className="container-ricoz"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">Why work with Ricoz</p><h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-[var(--brand-navy)] md:text-4xl">A place to make useful things and grow through the work.</h2><p className="mt-4 text-base leading-7 text-[var(--brand-text-secondary)]">The opportunity at Ricoz is close to the work: understanding a problem, making thoughtful decisions, and helping turn ideas into technology people can use.</p></div><div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{reasons.map(({ title, description, icon: Icon }) => <article key={title} className="rounded-[20px] border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5"><span className="flex h-11 w-11 items-center justify-center rounded-[11px] bg-[var(--brand-red-pale)] text-[var(--brand-red)]"><Icon size={19} aria-hidden="true" /></span><h3 className="mt-5 text-xl font-bold tracking-[-0.04em] text-[var(--brand-navy)]">{title}</h3><p className="mt-3 text-sm leading-6 text-[var(--brand-text-secondary)]">{description}</p></article>)}</div></div></section>;
}
