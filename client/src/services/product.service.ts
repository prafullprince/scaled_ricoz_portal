import api from "./axios";
import type { Task, TaskPerson } from "./task.service";

export type ProductStatus = "unassigned" | "production" | "development";

export interface Product {
  _id: string;
  title: string;
  description: string;
  summary?: string | null;
  category?: string | null;
  website?: string | null;
  isPublic?: boolean;
  thumbnail?: string | null;
  techStack: string[];
  developer?: string | null;
  status: ProductStatus;
  progress: number;
  workflow: Task | null;
  taskCount: number;
  completedTaskCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  title: string;
  description: string;
  summary?: string;
  category?: string;
  website?: string;
  isPublic?: boolean;
  techStack: string[];
  developer?: string;
  status?: ProductStatus;
  thumbnail?: File | null;
}

export interface ProductDetails {
  product: Product;
  tasks: Array<Task & { progress: number }>;
  reports: Array<{ _id: string; taskId: string; userId: TaskPerson | null; reportDate: string; summary: string; progress: number }>;
  pagination: { page: number; total: number; totalPages: number };
}

export type ProductHead = { _id: string; department: string; userId: TaskPerson };

function productForm(input: CreateProductInput) {
  const formData = new FormData();
  formData.append("title", input.title);
  formData.append("description", input.description);
  if (input.summary !== undefined) formData.append("summary", input.summary);
  if (input.category !== undefined) formData.append("category", input.category);
  if (input.website !== undefined) formData.append("website", input.website);
  if (input.isPublic !== undefined) formData.append("isPublic", String(input.isPublic));
  formData.append("techStack", input.techStack.join(","));
  formData.append("developer", input.developer?.trim() ?? "");
  if (input.status) formData.append("status", input.status);
  if (input.thumbnail) formData.append("thumbnail", input.thumbnail);
  return formData;
}

export const ProductService = {
  async list(department?: string) {
    const response = await api.get<{ products: Product[] }>("/products", { params: { department } });
    return response.data.products;
  },
  async details(id: string, page = 1) {
    return (await api.get<ProductDetails>(`/products/${id}/progress`, { params: { page } })).data;
  },
  async heads(department: string) {
    return (await api.get<{ heads: ProductHead[] }>("/products/heads", { params: { department } })).data.heads;
  },
  async dispatch(id: string, input: { department: string; headId?: string; executiveAssignment?: boolean; deadline: string }) {
    return (await api.post<{ taskId: string }>(`/products/admin/${id}/dispatch`, input)).data;
  },
  async remove(id: string) {
    await api.delete(`/products/admin/${id}`);
  },
  async update(id: string, input: CreateProductInput) {
    return (await api.put<{ product: Product }>(`/products/admin/${id}`, productForm(input), {
      headers: { "Content-Type": "multipart/form-data" },
    })).data.product;
  },
  async listAdmin() {
    const response = await api.get<{ products: Product[] }>("/products/admin");
    return response.data.products;
  },

  async create(input: CreateProductInput) {
    const response = await api.post<{ product: Product }>(
      "/products/admin",
      productForm(input),
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return response.data.product;
  },
};
