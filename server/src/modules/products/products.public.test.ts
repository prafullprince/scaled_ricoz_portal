import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Request, Response } from "express";
import { Types, type PipelineStage } from "mongoose";
import { Product, Task } from "../../models/index.js";
import { ProductStatus } from "../../models/product.models.js";
import { TaskWorkflowStage } from "../../models/task.models.js";
import { currentScope, runWithCompany, scopeFor, setDefaultCompanyId } from "../company/company.context.js";
import { getPublicProduct, listPublicProducts, publicCatalogueQuery, publicProduct } from "./products.public.js";
import { productSchema } from "./products.validation.js";
import { ApiError } from "../../utils/apiError.utils.js";

const defaultId = new Types.ObjectId();
const otherId = new Types.ObjectId();
const productId = new Types.ObjectId();
const now = new Date("2026-10-07T00:00:00Z");
const record = {
  _id: productId, title: "Test product", description: "A product used only by automated tests.",
  techStack: ["TypeScript"], status: ProductStatus.PRODUCTION, isPublic: false, createdAt: now, updatedAt: now,
  developer: "Private developer", createdBy: new Types.ObjectId(), companyId: defaultId,
  workflow: { currentOwner: "Private owner" }, reports: ["Private report"],
};
const facets = {
  products: [record], total: [{ count: 25 }],
  categories: [{ _id: "Test category", count: 25 }],
  technologies: [{ _id: "TypeScript", count: 25 }],
  statuses: [{ _id: ProductStatus.PRODUCTION, count: 25 }],
};

afterEach(() => mock.restoreAll());

async function invoke(handler: typeof listPublicProducts, query = {}, id = String(productId)) {
  let body: unknown;
  let error: unknown;
  let cacheControl: unknown;
  const req: Partial<Request> = { query, params: { id }, headers: { "x-company-id": String(otherId) } };
  const res = {
    set(name: string, value: string) { if (name === "Cache-Control") cacheControl = value; return this; },
    json(value: unknown) { body = value; return this; },
  } as Response;
  await handler(req as Request, res, (reason: unknown) => { error = reason; });
  return { body, error, cacheControl };
}

test("legacy publication flags remain accepted but new products start unassigned", () => {
  const product = new Product({ title: "Internal product", description: "Internal description", createdBy: record.createdBy });
  assert.equal(product.isPublic, false);
  assert.equal(product.status, ProductStatus.UNASSIGNED);
  const base = { title: "Product", description: "A valid product description" };
  assert.equal(productSchema.parse({ body: base }).body.isPublic, undefined);
  for (const [input, expected] of [["true", true], ["false", false], [true, true], [false, false]] as const) {
    assert.equal(productSchema.parse({ body: { ...base, isPublic: input } }).body.isPublic, expected);
  }
  assert.equal(productSchema.safeParse({ body: { ...base, isPublic: "yes" } }).success, false);
  assert.equal(productSchema.safeParse({ body: { ...base, website: "javascript:alert(1)" } }).success, false);
  assert.equal(productSchema.safeParse({ body: { ...base, website: "https://example.com" } }).success, true);
});

test("public product serialization is an explicit whitelist", () => {
  const result = publicProduct(record);
  assert.deepEqual(Object.keys(result).sort(), [
    "id", "title", "description", "summary", "category", "website", "thumbnail",
    "techStack", "status", "createdAt", "updatedAt",
  ].sort());
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("Private"), false);
  assert.equal(serialized.includes("companyId"), false);
  assert.equal(publicProduct({ ...record, website: "javascript:alert(1)", thumbnail: "data:text/html,test" }).website, null);
  assert.equal(publicProduct({ ...record, thumbnail: "data:text/html,test" }).thumbnail, null);
});

test("query validation bounds pagination and rejects malformed filters", () => {
  assert.equal(publicCatalogueQuery.parse({}).limit, 12);
  assert.equal(publicCatalogueQuery.parse({ page: "2", limit: "3" }).page, 2);
  assert.equal(publicCatalogueQuery.parse({ stages: "all" }).stages, "all");
  for (const query of [{ page: "0" }, { limit: "25" }, { page: "1.5" }, { status: "released" }, { stages: "draft" }, { sort: "random" }, { search: "a".repeat(101) }, { search: ["a", "b"] }]) {
    assert.equal(publicCatalogueQuery.safeParse(query).success, false);
  }
});

test("directory selects production after lifecycle resolution regardless of publication flag", async () => {
  setDefaultCompanyId(defaultId);
  let pipeline: PipelineStage[] = [];
  mock.method(Product, "aggregate", async (stages: PipelineStage[]) => {
    assert.equal(currentScope(), null);
    pipeline = stages;
    return [facets];
  });
  const result = await runWithCompany(scopeFor(otherId), () => invoke(listPublicProducts, {
    search: "a.*", category: "Test category", technology: "TypeScript", status: "production", sort: "name", page: "2", limit: "12",
  }));
  assert.equal(result.error, undefined);
  assert.equal(result.cacheControl, "no-store");
  assert.deepEqual(pipeline[0], { $match: { deletedAt: null } });
  const lifecycle = pipeline.findIndex((stage) => "$set" in stage);
  assert.ok(lifecycle > 0);
  assert.deepEqual(pipeline[lifecycle + 1], { $match: { status: ProductStatus.PRODUCTION } });
  assert.equal(JSON.stringify(pipeline).includes("isPublic"), false);
  const facet = pipeline.find((stage) => "$facet" in stage);
  assert.ok(facet && "$facet" in facet);
  const productStages = facet.$facet.products;
  assert.ok(productStages);
  assert.deepEqual(productStages.slice(1, 4), [{ $sort: { title: 1, _id: 1 } }, { $skip: 12 }, { $limit: 12 }]);
  assert.deepEqual(facet.$facet.total, [{ $match: {
    $or: ["title", "description", "summary"].map((field) => ({ [field]: { $regex: "a\\.\\*", $options: "i" } })),
    category: "Test category", techStack: "TypeScript", status: "production",
  } }, { $count: "count" }]);
  assert.deepEqual(result.body, {
    success: true, products: [publicProduct(record)],
    pagination: { page: 2, limit: 12, total: 25, totalPages: 3 },
    facets: {
      categories: [{ value: "Test category", count: 25 }],
      technologies: [{ value: "TypeScript", count: 25 }],
      statuses: [{ value: "production", count: 25 }],
    },
  });
});

test("catalogue includes products across companies and every lifecycle stage when requested", async () => {
  setDefaultCompanyId(defaultId);
  let pipeline: PipelineStage[] = [];
  const foreignProduct = {
    ...record, _id: new Types.ObjectId(), companyId: otherId, title: "Other company product",
    status: ProductStatus.PRODUCTION,
  };
  const development = { ...record, _id: new Types.ObjectId(), status: ProductStatus.DEVELOPMENT };
  const unassigned = { ...record, _id: new Types.ObjectId(), status: ProductStatus.UNASSIGNED };
  mock.method(Product, "aggregate", async (stages: PipelineStage[]) => {
    assert.equal(currentScope(), null);
    pipeline = stages;
    return [{
      ...facets,
      products: [record, foreignProduct, development, unassigned],
      total: [{ count: 4 }],
      statuses: [
        { _id: ProductStatus.PRODUCTION, count: 2 },
        { _id: ProductStatus.DEVELOPMENT, count: 1 },
        { _id: ProductStatus.UNASSIGNED, count: 1 },
      ],
    }];
  });
  const result = await runWithCompany(scopeFor(otherId), () => invoke(listPublicProducts, { stages: "all" }));
  assert.equal(result.error, undefined);
  assert.deepEqual(pipeline[0], { $match: { deletedAt: null } });
  const lifecycle = pipeline.findIndex((stage) => "$set" in stage);
  assert.ok(lifecycle > 0);
  const nextStage = pipeline[lifecycle + 1];
  assert.ok(nextStage && "$facet" in nextStage);
  assert.equal(JSON.stringify(pipeline).includes('"status":"production"'), false);
  assert.deepEqual(
    (result.body as { products: { status: ProductStatus }[] }).products.map((product) => product.status),
    [ProductStatus.PRODUCTION, ProductStatus.PRODUCTION, ProductStatus.DEVELOPMENT, ProductStatus.UNASSIGNED],
  );
  assert.deepEqual(
    (result.body as { products: { title: string }[] }).products.map((product) => product.title),
    ["Test product", "Other company product", "Test product", "Test product"],
  );
});

test("empty catalogue is explicit and does not fabricate products", async () => {
  setDefaultCompanyId(defaultId);
  mock.method(Product, "aggregate", async () => [{ products: [], total: [], categories: [], technologies: [], statuses: [] }]);
  const result = await invoke(listPublicProducts);
  assert.deepEqual(result.body, { success: true, products: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 }, facets: { categories: [], technologies: [], statuses: [] } });
});

test("invalid filters and database errors propagate, never return an empty success", async () => {
  const aggregate = mock.method(Product, "aggregate", async () => { throw new Error("Database unavailable"); });
  const invalid = await invoke(listPublicProducts, { page: "-1" });
  assert.ok(invalid.error instanceof ApiError);
  assert.equal(invalid.error.statusCode, 400);
  assert.equal(aggregate.mock.callCount(), 0);
  setDefaultCompanyId(defaultId);
  const failed = await invoke(listPublicProducts);
  assert.ok(failed.error instanceof Error);
  assert.equal(failed.error.message, "Database unavailable");
  assert.equal(failed.body, undefined);
});

test("public profile reads products from any company", async () => {
  setDefaultCompanyId(defaultId);
  const find = mock.method(Product, "findOne", (filter: unknown) => {
    assert.deepEqual(filter, { _id: productId, deletedAt: null });
    assert.equal(currentScope(), null);
    return { select() { return this; }, lean: async () => record };
  });
  mock.method(Task, "findOne", (filter: unknown) => {
    assert.deepEqual(filter, { productId, parentTaskId: null });
    assert.equal(currentScope(), null);
    return { sort() { return this; }, select() { return this; }, lean: async () => null };
  });
  const result = await runWithCompany(scopeFor(otherId), () => invoke(getPublicProduct));
  assert.equal(result.error, undefined);
  assert.deepEqual(result.body, { success: true, product: publicProduct(record) });
  assert.equal(find.mock.callCount(), 1);
});

test("public profile rejects deleted products and malformed IDs", async () => {
  setDefaultCompanyId(defaultId);
  const find = mock.method(Product, "findOne", (filter: unknown) => {
    assert.deepEqual(filter, { _id: productId, deletedAt: null });
    return { select() { return this; }, lean: async () => null };
  });
  const missing = await invoke(getPublicProduct);
  assert.ok(missing.error instanceof ApiError);
  assert.equal(missing.error.statusCode, 404);
  const invalid = await invoke(getPublicProduct, {}, "not-an-id");
  assert.ok(invalid.error instanceof ApiError);
  assert.equal(invalid.error.statusCode, 404);
  assert.equal(find.mock.callCount(), 1);
});

test("profile status follows workflow completion without exposing workflow details", async () => {
  setDefaultCompanyId(defaultId);
  mock.method(Product, "findOne", () => ({ select() { return this; }, lean: async () => record }));
  mock.method(Task, "findOne", () => ({
    sort() { return this; }, select() { return this; },
    lean: async () => ({ workflowStage: TaskWorkflowStage.COMPLETED, currentOwner: "Private owner" }),
  }));
  const result = await invoke(getPublicProduct);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.body, { success: true, product: publicProduct({ ...record, status: ProductStatus.PRODUCTION }) });
});

test("production without a workflow is public even when legacy isPublic is false", async () => {
  setDefaultCompanyId(defaultId);
  mock.method(Product, "findOne", () => ({ select() { return this; }, lean: async () => record }));
  mock.method(Task, "findOne", () => ({ sort() { return this; }, select() { return this; }, lean: async () => null }));
  const result = await invoke(getPublicProduct);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.body, { success: true, product: publicProduct(record) });
});

for (const status of [ProductStatus.UNASSIGNED, ProductStatus.DEVELOPMENT]) {
  test(`${status} product profiles are public without exposing workflow details`, async () => {
    setDefaultCompanyId(defaultId);
    mock.method(Product, "findOne", () => ({ select() { return this; }, lean: async () => ({ ...record, status, isPublic: true }) }));
    mock.method(Task, "findOne", () => ({ sort() { return this; }, select() { return this; }, lean: async () => null }));
    const result = await invoke(getPublicProduct);
    assert.equal(result.error, undefined);
    assert.deepEqual(result.body, { success: true, product: publicProduct({ ...record, status }) });
  });
}

test("unfinished workflow overrides stale stored production status", async () => {
  setDefaultCompanyId(defaultId);
  mock.method(Product, "findOne", () => ({ select() { return this; }, lean: async () => record }));
  mock.method(Task, "findOne", () => ({
    sort() { return this; }, select() { return this; },
    lean: async () => ({ workflowStage: TaskWorkflowStage.DELEGATED }),
  }));
  const result = await invoke(getPublicProduct);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.body, {
    success: true,
    product: publicProduct({ ...record, status: ProductStatus.DEVELOPMENT }),
  });
});
