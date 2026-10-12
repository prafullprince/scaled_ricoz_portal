import Link from "next/link";
import { ArrowRight, Boxes, Code2, Network } from "lucide-react";
import { services } from "@/lib/services/services";
import { solutions } from "@/lib/solutions/solutions";

const groups = [
  { title: "Products", label: "The Product Factory", description: "Explore approved product records, their technology, and their current lifecycle in the public directory.", href: "/products", icon: Boxes },
  { title: "Services", label: `${services.length} technology capabilities`, description: "Development, design, AI, cloud, backend, automation, and product engineering capabilities.", href: "/services", icon: Code2 },
  { title: "Solutions", label: `${solutions.length} solution directions`, description: "Business-focused ways to connect technology with financial, operational, product, and communication needs.", href: "/solutions", icon: Network },
];

export function RicozEcosystem() {
  return (
    <section className="py-16 md:py-24">
      <div className="container-ricoz">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red)">The Ricoz ecosystem</p>
            <h2 className="mt-3! text-3xl font-black leading-tight tracking-[-0.055em] text-(--brand-navy) md:text-4xl">
              Three connected ways to build business value.
            </h2>
          </div>
          <Link href="/products" className="inline-flex items-center gap-2 text-sm font-semibold text-(--brand-red) transition-colors hover:text-(--brand-navy)">
            Explore the portfolio <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-9 grid gap-4 lg:grid-cols-3">
          {groups.map(({ title, label, description, href, icon: Icon }, index) => (
            <Link
              href={href}
              key={title}
              className="group relative overflow-hidden rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_100%_0%,rgba(201,29,32,0.2),transparent_42%),linear-gradient(145deg,#101a2c,#1d2a40)] p-6 text-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-(--shadow-xl)"
            >
              <span className="absolute right-5 top-5 text-xs font-bold tracking-[0.14em] text-white/35">0{index + 1}</span>
              <div className="flex items-center justify-between">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-(--brand-red) shadow-(--shadow-brand)">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <ArrowRight size={18} className="text-white/45 transition-transform group-hover:translate-x-1 group-hover:text-white" aria-hidden="true" />
              </div>
              <p className="mt-8! text-[10px] font-bold uppercase tracking-[0.14em] text-(--brand-red-soft)">{label}</p>
              <h3 className="mt-2! text-2xl font-bold tracking-[-0.05em]">{title}</h3>
              <p className="mt-3! text-sm leading-6 text-white/70">{description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
