import Link from "next/link";
import type { Job } from "@/lib/careers/careers";

function JobCard({ job }: { job: Job }) {
  return (
    <article className="rounded-[20px] border border-(--brand-border) bg-(--brand-background) p-5 shadow-(--shadow-sm)">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-(--brand-red)">
            {job.department}
          </p>
          <h3 className="mt-2 text-xl font-bold text-(--brand-navy)">
            {job.title}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-(--brand-gray)">
          <span className="rounded-full border border-(--brand-border) px-2.5 py-1">
            {job.employmentType}
          </span>
          {job.location ? (
            <span className="rounded-full border border-(--brand-border) px-2.5 py-1">
              {job.location}
            </span>
          ) : null}
        </div>
      </div>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-(--brand-text-secondary)">
        {job.description}
      </p>
      {job.skills?.length ? (
        <p className="mt-4 text-xs text-(--brand-gray)">
          Skills: {job.skills.join(", ")}
        </p>
      ) : null}
      {job.href ? (
        <Link
          href={job.href}
          className="mt-5 inline-flex text-sm font-semibold text-(--brand-red)"
        >
          View role{" "}
          <span aria-hidden="true" className="ml-2">
            →
          </span>
        </Link>
      ) : null}
    </article>
  );
}

export function JobList({ jobs }: { jobs: Job[] }) {
  const openJobs = jobs.filter((job) => job.status === "open");
  return (
    <section
      id="open-roles"
      className="scroll-mt-24 border-y border-(--brand-border) bg-(--brand-surface) py-20"
    >
      <div className="container-ricoz">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-(--brand-red)">
              Open opportunities
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-(--brand-navy) md:text-4xl">
              Find your next place to contribute.
            </h2>
            <p className="mt-4 text-base leading-7 text-(--brand-text-secondary)">
              When roles are open, they will appear here with the details needed
              to decide whether the opportunity is right for you.
            </p>
          </div>
          {openJobs.length ? (
            <span className="text-sm font-medium text-(--brand-gray)">
              {openJobs.length} open role{openJobs.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <div className="mt-10">
          {openJobs.length ? (
            <div className="grid gap-5">
              {openJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-(--brand-border-strong) bg-white p-7 md:p-10">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-(--brand-red)">
                No open roles at the moment
              </p>
              <h3 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-(--brand-navy)">
                The right opportunity may still start with a conversation.
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-(--brand-text-secondary)">
                We are keeping this space honest rather than filling it with
                generic listings. If your skills connect with the kind of work
                Ricoz does, share your profile through the open application
                section below.
              </p>
              <Link
                href="#open-application"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-(--brand-red)"
              >
                Send your profile <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
