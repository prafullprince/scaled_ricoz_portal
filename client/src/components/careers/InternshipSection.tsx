import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";

export function InternshipSection() {
  return (
    <section id="internships" className="scroll-mt-24 py-20">
      <div className="container-ricoz">
        <div className="grid gap-8 rounded-[26px] border border-(--brand-border) bg-(--brand-navy) p-7 text-white md:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-2xl">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-(--brand-red)">
              <GraduationCap size={21} />
            </span>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-(--brand-red-soft)">
              Internship opportunities
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-white md:text-4xl">
              Start close to the work.
            </h2>
            <p className="mt-4 text-base leading-7 text-white/75">
              Ricoz is open to connecting with students and early-career talent
              interested in building products, learning technology, and solving
              business problems. Areas may include engineering, product, design,
              AI, and operations depending on current needs.
            </p>
            <p className="mt-4 text-sm leading-6 text-white/60">
              Internship details are discussed based on the opportunity and the
              candidate&apos;s background. No fixed duration, stipend, or
              placement promise is being published here.
            </p>
          </div>
          <Link href="#open-application" className="ricoz-button-primary">
            Explore internships <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
