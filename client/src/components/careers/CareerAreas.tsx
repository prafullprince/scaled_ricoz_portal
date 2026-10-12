import { careerAreas, type CareerArea } from "@/lib/careers/careers";

function CareerAreaCard({ area }: { area: CareerArea }) {
  const Icon = area.icon;
  return (
    <article className="rounded-[20px] border border-(--brand-border) bg-(--brand-background) p-5 shadow-(--shadow-sm)">
      <span className="flex h-11 w-11 items-center justify-center rounded-[11px] bg-(--brand-red-pale) text-(--brand-red)">
        <Icon size={19} aria-hidden="true" />
      </span>
      <h3 className="mt-5 text-xl font-bold tracking-[-0.04em] text-(--brand-navy)">
        {area.title}
      </h3>
      <p className="mt-3 text-sm leading-6 text-(--brand-text-secondary)">
        {area.description}
      </p>
    </article>
  );
}

export function CareerAreas() {
  return (
    <section className="py-20">
      <div className="container-ricoz">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-(--brand-red)">
            Career areas
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-(--brand-navy) md:text-4xl">
            Find the kind of work you want to grow into.
          </h2>
          <p className="mt-4 text-base leading-7 text-(--brand-text-secondary)">
            These are the areas connected to the work Ricoz is building. They
            describe where you may fit, not a promise that every area currently
            has an opening.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {careerAreas.map((area) => (
            <CareerAreaCard key={area.id} area={area} />
          ))}
        </div>
      </div>
    </section>
  );
}
