import { BookOpenCheck, Route, Wrench } from "lucide-react";

export function GrowthSection() {
  return (
    <section className="py-20">
      <div className="container-ricoz grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-(--brand-red)">
            Growth & learning
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-(--brand-navy) md:text-4xl">
            Grow by taking on work that teaches you something.
          </h2>
          <p className="mt-4 text-base leading-7 text-(--brand-text-secondary)">
            Ricoz keeps growth connected to practice: better questions, stronger
            technical judgment, clearer communication, and ownership that
            expands with the work.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="border-t-2 border-(--brand-red) pt-4">
            <BookOpenCheck size={19} className="text-(--brand-red)" />
            <h3 className="mt-4 text-lg font-bold text-(--brand-navy)">
              Learn in context
            </h3>
            <p className="mt-2 text-sm leading-6 text-(--brand-text-secondary)">
              Build understanding by working on real product and business
              questions.
            </p>
          </div>
          <div className="border-t-2 border-(--brand-red) pt-4">
            <Wrench size={19} className="text-(--brand-red)" />
            <h3 className="mt-4 text-lg font-bold text-(--brand-navy)">
              Improve your craft
            </h3>
            <p className="mt-2 text-sm leading-6 text-(--brand-text-secondary)">
              Strengthen the practical skills needed to make dependable work.
            </p>
          </div>
          <div className="border-t-2 border-(--brand-red) pt-4">
            <Route size={19} className="text-(--brand-red)" />
            <h3 className="mt-4 text-lg font-bold text-(--brand-navy)">
              Find your direction
            </h3>
            <p className="mt-2 text-sm leading-6 text-(--brand-text-secondary)">
              Explore how your interests connect with the company&apos;s
              evolving needs.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
