import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SolutionsCTA() {
  return <section className="pb-20"><div className="container-ricoz"><div id="solutions-contact" className="scroll-mt-24 rounded-[26px] bg-[var(--brand-navy)] p-7 text-white md:p-10"><div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red-soft)]">Start with the challenge</p><h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-white md:text-4xl">Have a business problem worth solving?</h2><p className="mt-4 text-base leading-7 text-white/75">Share what is difficult today. Ricoz can help you think through the right product, service, and technology path.</p></div><div className="flex flex-col gap-3 sm:flex-row"><Link href="#solutions-contact" className="ricoz-button-primary">Talk to Ricoz <ArrowRight size={16} /></Link><Link href="/services" className="ricoz-button-secondary border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">Book a service</Link></div></div></div></div></section>;
}
