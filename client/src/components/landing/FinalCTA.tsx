import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="py-20">
      <div className="container-ricoz">
        <div className="rounded-[26px] border border-[var(--brand-border)] bg-[var(--brand-surface)] p-7 md:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">
                Explore Ricoz
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-[var(--brand-navy)] md:text-4xl">
                See the portfolio and the opportunity.
              </h2>
              <p className="mt-4 text-base leading-7 text-[var(--brand-text-secondary)]">
                Review Ricoz’s products and company overview, or reach out to start a conversation with our team.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/investors" className="ricoz-button-primary">
                Investor overview
                <ArrowRight size={16} />
              </Link>
              <Link href="/products" className="ricoz-button-secondary">
                Product portfolio
              </Link>
              <Link href="/contact" className="ricoz-button-secondary">
                Contact Ricoz
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
