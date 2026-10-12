import { getPublicCatalogue } from "@/lib/products/catalogue.server";
import { ProductCard } from "./ProductCard";

export async function FeaturedProduct() {
  const result = await getPublicCatalogue("limit=1");
  if (!result.ok || !result.data.products.length) return null;
  return <section className="py-16"><div className="container-ricoz"><p className="mb-6 text-xs font-semibold uppercase tracking-[0.16em] text-(--brand-red)">Latest catalogue addition</p><ProductCard product={result.data.products[0]} /></div></section>;
}
