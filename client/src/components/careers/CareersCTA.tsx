import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CareersCTA() {
  return (
    <section className="pb-20">
      <div className="container-ricoz">
        <div className="rounded-[26px] bg-(--brand-navy) p-7 text-white md:p-10">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-(--brand-red-soft)">
                Build with Ricoz
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-white md:text-4xl">
                Your next meaningful project could start here.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/75">
                Explore the work, understand the opportunity, and start a
                conversation when you are ready.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="#open-roles" className="ricoz-button-primary">
                View opportunities <ArrowRight size={16} />
              </Link>
              <Link
                href="/contact"
                className="ricoz-button-secondary border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                Send your profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
