import assert from "node:assert/strict";
import { test } from "node:test";
import { isProductCatalogue, isPublicProduct, productPath, type PublicProduct } from "./catalogue";

const product: PublicProduct = {
  id: "000000000000000000000001",
  title: "Catalogue test record",
  description: "A fixture for validating the public catalogue response.",
  summary: null,
  category: null,
  website: null,
  thumbnail: null,
  techStack: ["TypeScript"],
  status: "development",
  createdAt: "2026-10-07T00:00:00.000Z",
  updatedAt: "2026-10-07T00:00:00.000Z",
};

test("public product profiles use database IDs rather than hardcoded slugs", () => {
  assert.equal(isPublicProduct(product), true);
  assert.equal(productPath(product), "/products/000000000000000000000001");
  for (const changes of [
    { id: "hardcoded-slug" }, { title: null }, { description: 1 },
    { techStack: "TypeScript" }, { status: "Available" }, { createdAt: "invalid" },
    { updatedAt: null }, { thumbnail: undefined },
  ]) assert.equal(isPublicProduct({ ...product, ...changes }), false);
});

test("empty and populated catalogues are valid while malformed API responses are rejected", () => {
  const empty = { products: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 }, facets: { categories: [], technologies: [], statuses: [] } };
  assert.equal(isProductCatalogue(empty), true);
  assert.equal(isProductCatalogue({
    products: [product],
    pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
    facets: { categories: [], technologies: [{ value: "TypeScript", count: 1 }], statuses: [{ value: "development", count: 1 }] },
  }), true);
  assert.equal(isProductCatalogue(null), false);
  assert.equal(isProductCatalogue({ products: "not an array" }), false);
  assert.equal(isProductCatalogue({ ...empty, products: [{ ...product, status: "unknown" }] }), false);
  assert.equal(isProductCatalogue({ ...empty, pagination: { ...empty.pagination, total: -1 } }), false);
  assert.equal(isProductCatalogue({ ...empty, facets: { ...empty.facets, statuses: [{ value: "Available", count: 1 }] } }), false);
  assert.equal(isProductCatalogue({ ...empty, facets: { ...empty.facets, categories: [{ value: "Category", count: -1 }] } }), false);
});
