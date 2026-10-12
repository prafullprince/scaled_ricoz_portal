export type PublicProductStatus = "unassigned" | "development" | "production";

export interface PublicProduct {
  id: string;
  title: string;
  description: string;
  summary: string | null;
  category: string | null;
  website: string | null;
  thumbnail: string | null;
  techStack: string[];
  status: PublicProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogueFacet {
  value: string;
  count: number;
}

export interface ProductCatalogue {
  products: PublicProduct[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  facets: {
    categories: CatalogueFacet[];
    technologies: CatalogueFacet[];
    statuses: Array<{ value: PublicProductStatus; count: number }>;
  };
}

export type CatalogueResult =
  | { ok: true; data: ProductCatalogue }
  | { ok: false; message: string; status: number };

export const productStatusLabels: Record<PublicProductStatus, string> = {
  unassigned: "Unassigned",
  development: "Development",
  production: "Production",
};

export function productPath(product: PublicProduct) {
  return `/products/${product.id}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStatus(value: unknown): value is PublicProductStatus {
  return value === "unassigned" || value === "development" || value === "production";
}

export function isPublicProduct(value: unknown): value is PublicProduct {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && /^[a-f\d]{24}$/i.test(value.id)
    && typeof value.title === "string" && typeof value.description === "string"
    && ["summary", "category", "website", "thumbnail"].every((key) => value[key] === null || typeof value[key] === "string")
    && Array.isArray(value.techStack) && value.techStack.every((item) => typeof item === "string")
    && isStatus(value.status)
    && typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt))
    && typeof value.updatedAt === "string" && Number.isFinite(Date.parse(value.updatedAt));
}

export function isProductCatalogue(value: unknown): value is ProductCatalogue {
  if (!isRecord(value) || !Array.isArray(value.products) || !value.products.every(isPublicProduct)
    || !isRecord(value.pagination) || !isRecord(value.facets)) return false;
  const pagination = value.pagination;
  if (!["page", "limit", "total", "totalPages"].every((key) => typeof pagination[key] === "number" && Number.isInteger(pagination[key]) && pagination[key] >= 0)) return false;
  if (typeof pagination.page !== "number" || pagination.page < 1 || typeof pagination.limit !== "number" || pagination.limit < 1) return false;
  const facets = value.facets;
  return ["categories", "technologies", "statuses"].every((key) => {
    const entries = facets[key];
    return Array.isArray(entries) && entries.every((entry: unknown) => isRecord(entry)
      && typeof entry.value === "string" && typeof entry.count === "number" && Number.isInteger(entry.count) && entry.count >= 0
      && (key !== "statuses" || isStatus(entry.value)));
  });
}
