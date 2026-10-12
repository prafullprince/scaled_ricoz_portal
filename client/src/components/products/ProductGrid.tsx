import { getPublicCatalogue } from "@/lib/products/catalogue.server";
import { ProductDirectory } from "./ProductDirectory";

export async function ProductGrid() {
  const result = await getPublicCatalogue();
  return <section id="all-products" className="py-16"><div className="container-ricoz"><ProductDirectory result={result} query="" /></div></section>;
}
