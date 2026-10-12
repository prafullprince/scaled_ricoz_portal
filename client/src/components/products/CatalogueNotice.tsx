import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CatalogueResult } from "@/lib/products/catalogue";

export function CatalogueNotice({ result }: { result: CatalogueResult }) {
  return (
    <div role={result.ok ? "status" : "alert"} className={`rounded-[18px] border p-6 ${result.ok ? "border-(--brand-border) bg-(--brand-surface)" : "border-(--status-danger-border) bg-(--status-danger-bg)"}`}>
      <p className={`text-sm font-semibold ${result.ok ? "text-(--brand-navy)" : "text-(--status-danger)"}`}>
        {result.ok ? "No public products yet" : result.message}
      </p>
      <p className="mt-2 text-sm leading-6 text-(--brand-text-secondary)">
        {result.ok ? "Products from every lifecycle stage will appear here as they are added to the catalogue." : "Please retry the directory, or contact our team for product information."}
      </p>
      <Link href="/products" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-(--brand-red)">
        Product directory <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </div>
  );
}
