import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function BuildWithRicoz() {
  return (
    <section className="py-20">
      <div className="container-ricoz">
        <div className="rounded-[26px] border border-[var(--brand-border)] bg-[var(--brand-navy)] p-7 text-white md:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">
                Build with Ricoz
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-white md:text-4xl">
                Don&apos;t see what you need?
              </h2>
              <p className="mt-4 text-base leading-7 text-white/75">
                Ricoz can also help businesses design and build custom digital systems, product experiences, and technology solutions tailored to unique operational needs.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/services" className="ricoz-button-primary">
                Build with Ricoz
                <ArrowRight size={16} />
              </Link>
              <Link href="/contact" className="ricoz-button-secondary border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                Book a service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
