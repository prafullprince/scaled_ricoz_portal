import Link from "next/link";
import { ArrowRight } from "lucide-react";

const steps = [
  "Requirements",
  "Architecture",
  "Design",
  "Development",
  "Testing",
  "Deployment",
  "Maintenance",
];

export function CustomSoftwareSection() {
  return (
    <section className="py-20">
      <div className="container-ricoz">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">
              Custom software
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-[var(--brand-navy)] md:text-4xl">
              Built around your exact business requirements.
            </h2>
            <p className="mt-4 text-base leading-7 text-[var(--brand-text-secondary)]">
              Ricoz works with businesses that need more than a template. We create technology solutions shaped around the specific problem, workflow, and operational reality of the organization.
            </p>
            <Link href="/contact" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-red)]">
              Discuss your project
              <ArrowRight size={15} />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step} className="rounded-[18px] border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-red)]">
                  0{index + 1}
                </p>
                <p className="mt-3 text-base font-semibold text-[var(--brand-navy)]">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
