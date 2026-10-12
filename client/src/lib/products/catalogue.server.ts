import "server-only";
import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { isProductCatalogue, isPublicProduct, type CatalogueResult, type PublicProduct } from "./catalogue";

export class CatalogueError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function catalogueRequest(path: string): Promise<unknown> {
  const base = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!base) throw new CatalogueError("The product catalogue API is not configured.", 503);
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, "")}/products/public${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error("Public product catalogue request failed", error);
    throw new CatalogueError("We could not reach the product catalogue. Please try again.", 503);
  }
  if (!response.ok) {
    console.error(`Public product catalogue returned HTTP ${response.status}`);
    throw new CatalogueError(
      response.status === 404 ? "Product not found." : response.status === 400 ? "Invalid catalogue filters. Please clear your filters and try again." : "The product catalogue is temporarily unavailable.",
      response.status,
    );
  }
  try {
    return await response.json();
  } catch (error) {
    console.error("Invalid public product catalogue response", error);
    throw new CatalogueError("The product catalogue returned an invalid response.", 502);
  }
}

export const getPublicCatalogue = cache(async (query = ""): Promise<CatalogueResult> => {
  try {
    const data = await catalogueRequest(query ? `?${query}` : "");
    if (!isProductCatalogue(data)) {
      console.error("Public product catalogue did not match the expected response shape");
      throw new CatalogueError("The product catalogue returned an invalid response.", 502);
    }
    return { ok: true, data };
  } catch (error) {
    if (!(error instanceof CatalogueError)) throw error;
    return { ok: false, message: error.message, status: error.status };
  }
});

export const getPublicProduct = cache(async (id: string): Promise<PublicProduct> => {
  const data = await catalogueRequest(`/${encodeURIComponent(id)}`);
  if (typeof data !== "object" || data === null || !("product" in data) || !isPublicProduct(data.product)) {
    console.error("Public product profile did not match the expected response shape");
    throw new CatalogueError("The product catalogue returned an invalid response.", 502);
  }
  return data.product;
});
