import { hiringSteps } from "@/lib/careers/careers";

export function HiringProcess() {
  return (
    <section className="border-y border-(--brand-border) bg-(--brand-surface) py-20">
      <div className="container-ricoz">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-(--brand-red)">
            How we hire
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-(--brand-navy) md:text-4xl">
            A clear conversation about the work and the fit.
          </h2>
          <p className="mt-4 text-base leading-7 text-(--brand-text-secondary)">
            The exact steps depend on the role. This is the shape candidates can
            expect when an opportunity is a match.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {hiringSteps.map(([number, title, description]) => (
            <div
              key={number}
              className="rounded-[18px] border border-(--brand-border) bg-white p-5"
            >
              <p className="text-sm font-black tracking-[0.12em] text-(--brand-red)">
                {number}
              </p>
              <h3 className="mt-4 text-lg font-bold tracking-[-0.03em] text-(--brand-navy)">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-(--brand-text-secondary)">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
