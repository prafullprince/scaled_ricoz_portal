"use client";

import Link from "next/link";
import { ArrowUpRight, Boxes, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { ServicesService, type Service } from "@/services/services.service";

export function ServicesSection() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    ServicesService.list()
      .then(setServices)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="services" className="border-y border-[var(--brand-border)] bg-[var(--brand-surface)] py-20">
      <div className="container-ricoz">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">Services</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.06em] text-[var(--brand-navy)] md:text-4xl">Built to solve business problems with technology.</h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-border)] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-gray)]"><Sparkles size={12} className="text-[var(--brand-red)]" />Database catalog</span>
        </div>
        {loading ? <div className="mt-10 rounded-[16px] border border-dashed border-[var(--brand-border-strong)] bg-white p-8 text-sm text-[var(--brand-text-secondary)]">Loading services...</div> : error ? <div className="mt-10 rounded-[16px] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-8 text-sm text-[var(--status-danger)]">We could not load services right now.</div> : services.length === 0 ? <div className="mt-10 rounded-[16px] border border-dashed border-[var(--brand-border-strong)] bg-white p-8"><p className="font-semibold text-[var(--brand-navy)]">No published services yet</p><p className="mt-2 text-sm text-[var(--brand-text-secondary)]">Published services will appear here.</p></div> : <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">{services.map((service) => <article key={service._id} className="group flex h-full flex-col rounded-[22px] border border-[var(--brand-border)] bg-white p-5 shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-1 hover:border-[var(--brand-border-strong)] hover:shadow-[var(--shadow-md)]"><div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-[var(--brand-red-pale)] text-[var(--brand-red)]"><Boxes size={20} /></div><p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-red)]">{service.category}</p><h3 className="mt-2 text-2xl font-bold tracking-[-0.05em] text-[var(--brand-navy)]">{service.title}</h3><p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--brand-text-secondary)]">{service.shortDescription}</p>{service.techStack.length ? <div className="mt-5 flex flex-wrap gap-2">{service.techStack.slice(0, 4).map((item) => <span key={item} className="rounded-full bg-[var(--brand-surface)] px-2.5 py-1 text-xs text-[var(--brand-text-secondary)]">{item}</span>)}</div> : null}<Link href={`/services/${service.slug}`} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-red)]">Explore service <ArrowUpRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" /></Link></article>)}</div>}
      </div>
    </section>
  );
}
