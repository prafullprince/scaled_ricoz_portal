import Link from "next/link";
import { ArrowRight, Blocks, Building2, Layers3, LineChart, Network, type LucideIcon } from "lucide-react";
import { AnimatedCard } from "./LandingMotion";
import { SwipeCarousel } from "./SwipeCarousel";

const hubs: { title: string; description: string; href: string; icon: LucideIcon }[] = [
  { title: "Product directory", description: "Browse every Ricoz product that is live in production.", href: "/products", icon: Blocks },
  { title: "Investor relations", description: "Understand the Ricoz opportunity and request verified investor access.", href: "/investors", icon: LineChart },
  { title: "Technology services", description: "See how Ricoz designs, builds, and delivers digital systems.", href: "/services", icon: Layers3 },
  { title: "Business solutions", description: "Connect real business problems to practical technology outcomes.", href: "/solutions", icon: Network },
  { title: "About Ricoz", description: "Meet the team and the beliefs behind the Product Factory.", href: "/about", icon: Building2 },
];

export function ExploreRicoz() {
  return (
    <section id="explore" className="scroll-mt-24 border-t border-(--brand-border) bg-(--brand-background) py-16 md:py-24">
      <div className="container-ricoz">
        <SwipeCarousel label="Explore Ricoz" heading={<h2 className="text-3xl font-black tracking-[-0.04em] text-(--brand-navy) md:text-5xl">Explore Ricoz</h2>}>
          {hubs.map(({ title, description, href, icon: Icon }, index) => (
            <AnimatedCard key={title} index={index % 3} className="group h-full">
              <Link href={href} className="flex h-full flex-col overflow-hidden rounded-[18px] border border-(--brand-border) bg-white transition-shadow hover:shadow-(--shadow-lg)">
                <div aria-hidden="true" className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-(--brand-red-pale)">
                  <span className="absolute size-44 rounded-full bg-(--brand-red)/10 transition-transform duration-700 group-hover:scale-150" />
                  <Icon size={56} strokeWidth={1.4} className="relative text-(--brand-red) transition-transform duration-500 group-hover:-translate-y-1 group-hover:scale-110" />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="text-xl font-bold text-(--brand-navy)">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-(--brand-text-secondary)">{description}</p>
                  <span className="mt-auto flex items-center gap-2 pt-6 text-sm font-semibold text-(--brand-red)">Learn more <ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-1" /></span>
                </div>
              </Link>
            </AnimatedCard>
          ))}
        </SwipeCarousel>
      </div>
    </section>
  );
}
