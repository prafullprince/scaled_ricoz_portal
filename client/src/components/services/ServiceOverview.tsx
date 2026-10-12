import { services } from "@/lib/services/services";
import { ServiceCard } from "@/components/services/ServiceCard";

export function ServiceOverview() {
  const featured = services.filter((service) => service.featured).slice(0, 3);

  return (
    <section id="services-overview" className="py-20">
      <div className="container-ricoz">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-red)]">
            What can Ricoz help you build?
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-[var(--brand-navy)] md:text-4xl">
            Services designed to turn business needs into technology outcomes.
          </h2>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {featured.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      </div>
    </section>
  );
}
