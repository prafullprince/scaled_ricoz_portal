import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-(--brand-surface) px-6 text-center">
      <div className="max-w-md">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-(--brand-red)">
          403
        </p>
        <h1 className="mt-4 text-4xl font-semibold text-(--brand-navy)">
          You don&apos;t have access
        </h1>
        <p className="mt-4 text-(--brand-text-secondary)">
          Your account is signed in, but this area requires additional Ricoz
          permissions.
        </p>
        <Link
          href="/dashboard"
          className="mt-7 inline-block rounded-md bg-(--brand-red) px-5 py-3 text-sm font-semibold text-white hover:bg-(--brand-red-hover)"
        >
          Return to dashboard
        </Link>
      </div>
    </main>
  );
}
