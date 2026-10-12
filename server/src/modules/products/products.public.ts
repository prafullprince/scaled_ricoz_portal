import type { NextFunction, Request, Response } from "express";
import { Types, type PipelineStage } from "mongoose";
import { z } from "zod";
import { Product, Task } from "../../models/index.js";
import { ProductStatus } from "../../models/product.models.js";
import { TaskWorkflowStage } from "../../models/task.models.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { runWithCompany } from "../company/company.context.js";
import { productLifecycle } from "./products.lifecycle.js";

export const publicCatalogueQuery = z.object({
  search: z.string().trim().max(100).default(""),
  category: z.string().trim().max(80).default(""),
  technology: z.string().trim().max(60).default(""),
  status: z.enum(ProductStatus).optional(),
  stages: z.enum(["all"]).optional(),
  sort: z.enum(["newest", "oldest", "name"]).default("newest"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(24).default(12),
});

type PublicProductRecord = {
  _id: Types.ObjectId;
  title: string;
  description: string;
  summary?: string | null;
  category?: string | null;
  website?: string | null;
  thumbnail?: string | null;
  techStack: string[];
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
};

export function publicProduct(record: PublicProductRecord) {
  return {
    id: String(record._id),
    title: record.title,
    description: record.description,
    summary: record.summary || null,
    category: record.category || null,
    website: record.website && /^https?:\/\//i.test(record.website) ? record.website : null,
    thumbnail: record.thumbnail && /^https?:\/\//i.test(record.thumbnail) ? record.thumbnail : null,
    techStack: [...new Set(record.techStack)],
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

const publicFields = {
  _id: 1, title: 1, description: 1, summary: 1, category: 1,
  website: 1, thumbnail: 1, techStack: 1, status: 1, createdAt: 1, updatedAt: 1,
} as const;

export async function listPublicProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = publicCatalogueQuery.safeParse(req.query);
    if (!parsed.success) throw new ApiError(400, "Invalid product catalogue filters.");
    const input = parsed.data;
    const match: Record<string, unknown> = {};
    if (input.search) {
      const literal = input.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      match.$or = ["title", "description", "summary"].map((field) => ({ [field]: { $regex: literal, $options: "i" } }));
    }
    if (input.category) match.category = input.category;
    if (input.technology) match.techStack = input.technology;
    if (input.status) match.status = input.status;
    const sort: Record<string, 1 | -1> = input.sort === "name"
      ? { title: 1, _id: 1 }
      : { createdAt: input.sort === "oldest" ? 1 : -1, _id: input.sort === "oldest" ? 1 : -1 };
    const pipeline: PipelineStage[] = [
      { $match: { deletedAt: null } },
      {
        $lookup: {
          from: Task.collection.name,
          let: { productId: "$_id" },
          pipeline: [
            { $match: { parentTaskId: null, $expr: { $eq: ["$productId", "$$productId"] } } },
            { $sort: { createdAt: -1, _id: -1 } },
            { $limit: 1 },
            { $project: { _id: 0, workflowStage: 1 } },
          ],
          as: "publicLifecycle",
        },
      },
      {
        $set: {
          status: {
            $cond: [
              { $gt: [{ $size: "$publicLifecycle" }, 0] },
              { $cond: [{ $eq: [{ $arrayElemAt: ["$publicLifecycle.workflowStage", 0] }, TaskWorkflowStage.COMPLETED] }, ProductStatus.PRODUCTION, ProductStatus.DEVELOPMENT] },
              { $cond: [{ $in: ["$status", [ProductStatus.PRODUCTION, ProductStatus.DEVELOPMENT]] }, "$status", ProductStatus.UNASSIGNED] },
            ],
          },
        },
      },
    ];
    if (input.stages !== "all") {
      pipeline.push({ $match: { status: ProductStatus.PRODUCTION } });
    }
    pipeline.push({
        $facet: {
          products: [{ $match: match }, { $sort: sort }, { $skip: (input.page - 1) * input.limit }, { $limit: input.limit }, { $project: publicFields }],
          total: [{ $match: match }, { $count: "count" }],
          categories: [{ $match: { category: { $type: "string", $ne: "" } } }, { $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
          technologies: [{ $project: { techStack: { $setUnion: ["$techStack", []] } } }, { $unwind: "$techStack" }, { $group: { _id: "$techStack", count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
          statuses: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        },
      });
    type Facet = { products: PublicProductRecord[]; total: { count: number }[]; categories: { _id: string; count: number }[]; technologies: { _id: string; count: number }[]; statuses: { _id: ProductStatus; count: number }[] };
      const [result] = await runWithCompany(null, async () => await Product.aggregate<Facet>(pipeline));
    if (!result) throw new ApiError(500, "Unable to read the public product catalogue.");
    const total = result.total[0]?.count ?? 0;
    res.set("Cache-Control", "no-store");
    return res.json({
      success: true,
      products: result.products.map(publicProduct),
      pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) },
      facets: {
        categories: result.categories.map((item) => ({ value: item._id, count: item.count })),
        technologies: result.technologies.map((item) => ({ value: item._id, count: item.count })),
        statuses: result.statuses.map((item) => ({ value: item._id, count: item.count })),
      },
    });
  } catch (error) { next(error); }
}

export async function getPublicProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    if (!/^[a-f\d]{24}$/i.test(id)) throw new ApiError(404, "Product not found.");
    const record = await runWithCompany(null, async () => await Product.findOne({
      _id: new Types.ObjectId(id), deletedAt: null,
    }).select(publicFields).lean());
    if (!record) throw new ApiError(404, "Product not found.");
    const workflow = await runWithCompany(null, async () => await Task.findOne({
      productId: record._id, parentTaskId: null,
    }).sort({ createdAt: -1, _id: -1 }).select("workflowStage").lean());
    const status = productLifecycle(workflow, record.status);
    res.set("Cache-Control", "no-store");
    return res.json({ success: true, product: publicProduct({ ...record, status }) });
  } catch (error) { next(error); }
}
