import { Boxes, Code2, Network } from "lucide-react";

const modelLayers = [
  {
    title: "Products",
    description: "Software products that address repeatable business needs.",
    icon: Boxes,
  },
  {
    title: "Services",
    description: "Technology capabilities for building and improving digital systems.",
    icon: Code2,
  },
  {
    title: "Solutions",
    description: "Business-focused implementations that connect needs to technology.",
    icon: Network,
  },
];

export function BusinessModel() {
  return (
    <section className="border-y border-(--brand-border) bg-(--brand-surface) py-16 md:py-24">
      <div className="container-ricoz">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red)">High-level business model</p>
          <h2 className="mt-3! text-3xl font-black leading-tight tracking-[-0.055em] text-(--brand-navy) md:text-4xl">
            A simple public view of how the pieces fit.
          </h2>
          <p className="mt-4! text-base leading-7 text-(--brand-text-secondary)">
            Ricoz combines software products, technology services, and
            business-focused implementations. Detailed commercial and financial
            information is reserved for authenticated investor access.
          </p>
        </div>
        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {modelLayers.map(({ title, description, icon: Icon }, index) => (
            <article
              key={title}
              className="group rounded-[24px] border border-(--brand-border) bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-(--brand-red)/25 hover:shadow-(--shadow-lg)"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-(--brand-red-pale) text-(--brand-red) transition-colors group-hover:bg-(--brand-red) group-hover:text-white">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="text-xs font-bold tracking-[0.14em] text-(--brand-gray)/60">0{index + 1}</span>
              </div>
              <h3 className="mt-6! text-xl font-bold tracking-[-0.04em] text-(--brand-navy)">{title}</h3>
              <p className="mt-2! text-sm leading-6 text-(--brand-text-secondary)">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
