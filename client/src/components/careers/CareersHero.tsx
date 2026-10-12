import Link from "next/link";
import { ArrowDown, ArrowRight, Code2, Lightbulb, Users } from "lucide-react";

export function CareersHero() {
  return (
    <section className="border-b border-(--brand-border) bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fa_100%)]">
      <div className="container-ricoz grid gap-12 py-14 md:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-(--brand-red)">
            RICOZ CAREERS
          </p>
          <h1 className="mt-4 max-w-xl text-4xl font-black tracking-[-0.06em] text-(--brand-navy) md:text-5xl">
            Build what comes next.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-(--brand-text-secondary) md:text-lg">
            Ricoz brings together products, technology, and business solutions.
            We are looking for people who want to solve real problems, learn
            through meaningful work, and help build useful software.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="#open-roles" className="ricoz-button-primary">
              View opportunities <ArrowRight size={16} />
            </Link>
            <Link href="#why-ricoz" className="ricoz-button-secondary">
              Why Ricoz?
            </Link>
          </div>
        </div>
        <div className="rounded-[26px] border border-(--brand-border) bg-(--brand-background) p-4 shadow-(--shadow-xl)">
          <div className="rounded-[20px] border border-(--brand-border) bg-(--brand-surface) p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-(--brand-gray)">
                The work in motion
              </p>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-(--brand-red-pale) text-(--brand-red)">
                <Code2 size={15} />
              </span>
            </div>
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 rounded-[15px] border border-(--brand-border) bg-white p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-(--brand-red-pale) text-(--brand-red)">
                  <Lightbulb size={17} />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-(--brand-gray)">
                    01
                  </p>
                  <p className="mt-1 text-sm font-semibold text-(--brand-navy)">
                    Understand the problem
                  </p>
                </div>
              </div>
              <div className="flex justify-center text-(--brand-red)">
                <ArrowDown size={16} />
              </div>
              <div className="flex items-center gap-3 rounded-[15px] border border-(--brand-red-soft) bg-(--brand-red-pale) p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-(--brand-red) text-white">
                  <Users size={17} />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-(--brand-gray)">
                    02
                  </p>
                  <p className="mt-1 text-sm font-semibold text-(--brand-navy)">
                    Build with others
                  </p>
                </div>
              </div>
              <div className="flex justify-center text-(--brand-red)">
                <ArrowDown size={16} />
              </div>
              <div className="flex items-center gap-3 rounded-[15px] border border-(--brand-border) bg-white p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-(--brand-surface) text-(--brand-red)">
                  <Code2 size={17} />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-(--brand-gray)">
                    03
                  </p>
                  <p className="mt-1 text-sm font-semibold text-(--brand-navy)">
                    Ship useful technology
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
