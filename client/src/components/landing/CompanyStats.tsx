import { getPublicCatalogue } from "@/lib/products/catalogue.server";

export async function CompanyStats() {
  const result = await getPublicCatalogue();
  if (!result.ok || !result.data.pagination.total) return null;
  const counts = [
    { value: result.data.pagination.total, label: "Production products" },
    ...(result.data.facets.categories.length ? [{ value: result.data.facets.categories.length, label: "Product categories" }] : []),
    ...(result.data.facets.technologies.length ? [{ value: result.data.facets.technologies.length, label: "Technologies used" }] : []),
  ];
  return (
    <section aria-label="Production database portfolio" className="border-b border-(--brand-border) bg-(--brand-background)">
      <div className="container-ricoz flex flex-wrap items-center justify-center gap-x-14 gap-y-6 py-8">
        {counts.map(({ label, value }) => <div key={label} className="text-center"><p className="text-3xl font-black tracking-[-0.04em] text-(--brand-navy)">{value}</p><p className="mt-2 text-xs text-(--brand-gray)">{label}</p></div>)}
      </div>
    </section>
  );
}
