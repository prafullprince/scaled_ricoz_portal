import Link from "next/link";
import type { Service } from "@/lib/services/services";

interface ServiceCardProps {
  service: Service;
}

export function ServiceCard({ service }: ServiceCardProps) {
  const Icon = service.icon;

  return (
    <article className="group flex h-full flex-col rounded-[22px] border border-[var(--brand-border)] bg-[var(--brand-background)] p-5 shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-1 hover:border-[var(--brand-border-strong)] hover:shadow-[var(--shadow-md)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-[var(--brand-red-pale)] text-[var(--brand-red)]">
          <Icon size={20} aria-hidden="true" />
        </div>

        <span className="rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-gray)]">
          {service.category}
        </span>
      </div>

      <h3 className="mt-5 text-2xl font-bold tracking-[-0.05em] text-[var(--brand-navy)]">
        {service.title}
      </h3>

      <p className="mt-3 text-sm leading-6 text-[var(--brand-text-secondary)]">
        {service.shortDescription}
      </p>

      {service.outcome ? (
        <div className="mt-5 rounded-[14px] border border-[var(--brand-border)] bg-[var(--brand-surface)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-gray)]">
            Value delivered
          </p>
          <p className="mt-2 text-sm font-medium leading-6 text-[var(--brand-navy)]">
            {service.outcome}
          </p>
        </div>
      ) : null}

      <Link
        href={service.href}
        className="mt-6 inline-flex items-center gap-2 self-start text-sm font-semibold text-[var(--brand-red)] transition-transform duration-200 group-hover:translate-x-0.5"
      >
        Explore service
        <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
