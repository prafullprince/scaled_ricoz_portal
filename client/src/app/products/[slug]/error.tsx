"use client";

import Link from "next/link";

export default function ProductError({ reset }: { reset: () => void }) {
  return (
    <main className="container-ricoz py-20">
      <h1 className="text-3xl font-bold text-(--brand-navy)">
        Unable to load this product
      </h1>
      <p
        role="alert"
        className="mt-5 text-sm leading-6 text-(--brand-text-secondary)"
      >
        The product catalogue is temporarily unavailable. Please retry or return
        to the directory.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="ricoz-button-primary">
          Retry
        </button>
        <Link href="/products" className="ricoz-button-secondary">
          Product directory
        </Link>
      </div>
    </main>
  );
}
