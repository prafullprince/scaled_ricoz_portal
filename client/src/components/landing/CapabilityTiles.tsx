"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { investorPillars } from "@/lib/investors/content";
import { Reveal, useRevealMotion } from "./LandingMotion";

const destinations: Record<string, { href: string; cta: string }> = {
  Products: { href: "/products", cta: "Explore our products. Build with confidence." },
  Services: { href: "/services", cta: "Experience our services. Transform your business." },
  Solutions: { href: "/solutions", cta: "Discover our solutions. See the impact." },
};

export function CapabilityTiles() {
  const [active, setActive] = useState(0);
  const { ref, enabled: animate, shown } = useRevealMotion<HTMLDivElement>();

  return (
    <section id="what-we-do" className="scroll-mt-24 bg-(--brand-navy-dark) py-16 text-white md:py-24">
      <div className="container-ricoz">
        <Reveal><h2 className="max-w-3xl text-3xl font-black tracking-[-0.04em] text-white! md:text-5xl">Technology to move your business forward</h2></Reveal>
        <div ref={ref} className="mt-10 flex flex-col gap-4 lg:h-130 lg:flex-row">
          {investorPillars.map(({ title, description, icon: Icon }, index) => {
            const open = active === index;
            const destination = destinations[title];
            return (
              <motion.div
                key={title}
                layout={animate}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                initial={false}
                animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
                transition={{ duration: animate ? 0.55 : 0, delay: animate ? index * 0.12 : 0, layout: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
                className={`group relative min-h-75 overflow-hidden rounded-[22px] border group-hover:transition-all group-hover:duration-700 transition-all duration-400 border-white/10 bg-(--brand-navy) lg:min-h-0 ${open ? "lg:flex-[2.2]" : "lg:flex-1"}`}
              >
                <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,var(--brand-red)_0%,transparent_40%)] opacity-40 transition-opacity duration-700 group-hover:opacity-70 group-hover:duration-700" />
                <motion.div
                  aria-hidden="true"
                  animate={animate ? { rotate: 360 } : { rotate: 0 }}
                  transition={{ duration: 40 + index * 10, repeat: Infinity, ease: "linear" }}
                  className="absolute -right-24 -top-24 size-80 rounded-full border border-dashed border-white/15 transition-all duration-300"
                />
                <Icon aria-hidden="true" size={open ? 120 : 84} strokeWidth={1} className="absolute right-8 top-8 text-white/20 transition-all duration-500" />
                <div className="absolute inset-x-0 bottom-0 bg-(--brand-navy-dark)/80 p-6 backdrop-blur-sm md:p-8 lg:pr-24">
                  <h3 className="text-2xl font-bold text-white! md:text-3xl">{title}</h3>
                  <p className="mt-3 max-w-md text-sm leading-6 text-white/75 md:text-base">{open ? description : destination.cta}</p>
                  <Link href={destination.href} aria-label={`Explore ${title}`} className="mt-5 flex size-12 items-center justify-center rounded-full bg-(--brand-red) text-white transition-transform group-hover:translate-x-1 lg:absolute lg:bottom-8 lg:right-8 lg:mt-0">
                    <ArrowRight size={20} aria-hidden="true" />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
