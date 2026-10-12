"use client";
import Link from "next/link";
import { ArrowRight, Boxes, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { ServicesService, type Service } from "@/services/services.service";
export function LiveServicesBrowser() {
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
    <section
      id="service-marketplace"
      className="border-y border-(--brand-border) bg-(--brand-surface) py-20"
    >
      <div className="container-ricoz">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-(--brand-red)">
            <Sparkles size={15} /> Services marketplace
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.05em] text-(--brand-navy) md:text-4xl">
            Explore services built around your next business move.
          </h2>
          <p className="mt-4 text-base leading-7 text-(--brand-text-secondary)">
            Browse our current catalog. Service availability, pricing, and
            timelines come directly from Ricoz.
          </p>
        </div>
        {loading ? (
          <div className="mt-10 rounded-(--radius-lg) border border-dashed border-(--brand-border-strong) bg-white p-10 text-sm text-(--brand-text-secondary)">
            Loading services...
          </div>
        ) : error ? (
          <div className="mt-10 rounded-(--radius-lg) border border-(--status-danger-border) bg-(--status-danger-bg) p-10 text-sm text-(--status-danger)">
            We could not load services right now.
          </div>
        ) : services.length ? (
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {services.map((service) => (
              <article
                key={service._id}
                className="group rounded-(--radius-lg) border border-(--brand-border) bg-white p-6 transition hover:-translate-y-0.5 hover:border-(--brand-red-soft) hover:shadow-(--shadow-md)"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-(--radius-md) bg-(--brand-red-pale) text-(--brand-red)">
                  <Boxes size={18} />
                </span>
                <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-(--brand-red)">
                  {service.category}
                </p>
                <h3 className="mt-2 text-xl font-bold text-(--brand-navy)">
                  {service.title}
                </h3>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-(--brand-text-secondary)">
                  {service.shortDescription}
                </p>
                {service.techStack.length ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {service.techStack.slice(0, 4).map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-(--brand-surface) px-2.5 py-1 text-xs text-(--brand-text-secondary)"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
                <Link
                  href={`/services/${service.slug}`}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-(--brand-red)"
                >
                  View service{" "}
                  <ArrowRight
                    size={15}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-(--radius-lg) border border-dashed border-(--brand-border-strong) bg-white p-10">
            <p className="font-semibold text-(--brand-navy)">
              No published services yet
            </p>
            <p className="mt-2 text-sm text-(--brand-text-secondary)">
              The catalog will appear here when services are published.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
