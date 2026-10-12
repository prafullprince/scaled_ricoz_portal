import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FactoryHeadline } from "./LandingMotion";
import styles from "./ProductFactory.module.css";

export function HeroSection() {
  return (
    <section
      className={`${styles.hero} relative isolate overflow-hidden border-b border-(--brand-border) bg-(--brand-background) w-full mx-auto`}
    >
      <div className="container-ricoz relative z-10 py-16 text-center md:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-(--brand-red)">
          Ricoz Innovation
        </p>
        <FactoryHeadline />
        <p className="mx-auto mt-7 max-w-xl text-base leading-8 text-(--brand-text-secondary) md:text-lg">
          We turn business needs into useful technology. Explore the products,
          the engineering behind them, and the direction of Ricoz Innovation.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/products" className="ricoz-button-primary">
            Explore products <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="#investors" className="ricoz-button-secondary">
            Investor Relations
          </Link>
        </div>
      </div>
    </section>
  );
}
