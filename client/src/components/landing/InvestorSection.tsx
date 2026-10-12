import Link from "next/link";
import {
  ArrowRight,
  Blocks,
  BriefcaseBusiness,
  Network,
} from "lucide-react";

const investorLenses = [
  {
    label: "Product portfolio",
    description: "Software products designed around repeatable business needs.",
    icon: Blocks,
  },
  {
    label: "Technology services",
    description: "Capabilities to design, build, and improve digital systems.",
    icon: BriefcaseBusiness,
  },
  {
    label: "Business solutions",
    description: "Practical implementations that connect technology to workflows.",
    icon: Network,
  },
];

export function InvestorSection() {
  return (
    <section id="investors" className="scroll-mt-24 bg-[var(--brand-navy)] py-14 text-white md:py-20">
      <div className="container-ricoz">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">
              Investor Relations
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-white! md:text-4xl">
              Interested in Ricoz?
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-white/75">
              Learn more about our company, products, and long-term direction. Explore the investor overview, request information from our team, or continue through the existing investor account flow.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/investors" className="ricoz-button-primary">
                Investor overview
                <ArrowRight size={16} />
              </Link>
              <Link href="/signup?role=investor" className="ricoz-button-secondary border-white/15! bg-white/5! text-white! hover:bg-white/10! hover:text-white!">
                Create investor account
              </Link>
              <Link href="/contact" className="inline-flex items-center justify-center gap-2 px-1 py-3 text-sm font-semibold text-white/80 hover:text-white">
                Request Investor Information <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <p className="mt-5 text-xs leading-5 text-white/60">
              Already have an account? <Link href="/login" className="font-semibold text-white underline underline-offset-4">Sign in</Link>. Investor analytics require verification.
            </p>
          </div>

          <div className="grid gap-4">
            {investorLenses.map(({ label, description, icon: Icon }) => (
              <div key={label} className="rounded-[18px] border border-white/10 bg-white/5 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[var(--brand-red)] text-white">
                  <Icon size={18} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-white!">
                  {label}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/65">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
