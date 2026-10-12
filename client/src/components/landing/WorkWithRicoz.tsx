import Link from "next/link";
import { ArrowRight, MessageSquareMore } from "lucide-react";

export function WorkWithRicoz() {
  return (
    <section className="bg-[var(--brand-navy)] py-20 text-white">
      <div className="container-ricoz">
        <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,_rgba(255,255,255,0.04)_0%,_rgba(201,29,32,0.08)_100%)] p-7 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">
                Work with Ricoz
              </p>
              <h2 className="mt-3 max-w-xl text-3xl font-black tracking-[-0.06em] text-white md:text-4xl">
                Have a business problem to solve?
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/75">
                Whether you need a product improved, a digital experience rebuilt, or a new system aligned to business goals, Ricoz helps companies turn complex problems into practical solutions.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link href="/services#service-marketplace" className="ricoz-button-primary">
                Book a service
                <ArrowRight size={16} />
              </Link>
              <Link href="/contact" className="ricoz-button-secondary border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                Talk to our team
                <MessageSquareMore size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
