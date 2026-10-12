import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { Product, Task, TaskDailyReport, TaskStatus, TaskWorkflowAction, TaskWorkflowStage, OrganizationAssignment, OrganizationLevel } from "../../models/index.js";
import { ProductStatus } from "../../models/product.models.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { uploadProductThumbnail } from "../../utils/cloudinary.utils.js";
import { contributionScopeFilter, isOrganizationExecutive, requestedDepartmentFilter, resolveOrganizationAccess, workflowScopeFilter } from "../organization/organization.access.js";
import { findActiveDepartmentHead } from "../tasks/task-workflow.controller.js";
import { productLifecycle, productProgress } from "./products.lifecycle.js";
import { hasCompanyFeatureGrant, requestRoles } from "../organization/organization.roles.js";
import { Permission } from "../auth/authorization.js";

function requireExecutive(req: Request) {
  if (!isOrganizationExecutive(requestRoles(req)) && !hasCompanyFeatureGrant(req, Permission.PRODUCT_ADMIN)) throw new ApiError(403, "Company product management access is required");
}

function productId(req: Request) {
  const value = String(req.params.id);
  if (!Types.ObjectId.isValid(value)) throw new ApiError(400, "Invalid product id");
  return new Types.ObjectId(value);
}

async function scopedProducts(req: Request, id?: Types.ObjectId) {
  const access = await resolveOrganizationAccess(req.authUser!._id, requestRoles(req), hasCompanyFeatureGrant(req, Permission.PRODUCT_ADMIN));
  const department = requestedDepartmentFilter(access, req.query.department);
  let visibleProductIds: Types.ObjectId[] | undefined;
  if (!access.executive || req.query.department) {
    const member = !access.executive && access.assignment.level === OrganizationLevel.MEMBER;
    const visibleTasks = await Task.find({
      ...(member ? contributionScopeFilter(access) : { parentTaskId: null, ...workflowScopeFilter(access, req.authUser!._id) }),
      ...department,
    }).select("productId").lean();
    visibleProductIds = visibleTasks.flatMap((task) => task.productId ? [task.productId] : []);
  }
  const products = await Product.find({
    deletedAt: null,
    ...(visibleProductIds ? { _id: { $in: visibleProductIds, ...(id ? { $eq: id } : {}) } } : id ? { _id: id } : {}),
  }).sort({ createdAt: -1, _id: -1 }).lean();
  const workflows = await Task.find({ productId: { $in: products.map((product) => product._id) }, parentTaskId: null })
    .populate("currentOwner", "name email").lean();
  const workflowIds = workflows.map((task) => task._id);
  const contributions = await Task.find({ parentTaskId: { $in: workflowIds }, ...contributionScopeFilter(access) })
    .populate("assignedTo", "name email").sort({ createdAt: 1 }).lean();
  const latestReports = await TaskDailyReport.aggregate<{ _id: Types.ObjectId; progress: number }>([
    { $match: { taskId: { $in: contributions.map((task) => task._id) } } },
    { $sort: { reportDate: -1, updatedAt: -1, _id: -1 } },
    { $group: { _id: "$taskId", progress: { $first: "$progress" } } },
  ]);
  const progressByTask = new Map(latestReports.map((report) => [String(report._id), report.progress]));
  const rows = products.map((product) => {
    const workflow = workflows.find((task) => String(task.productId) === String(product._id));
    const work = contributions.filter((task) => String(task.parentTaskId) === String(workflow?._id));
    const status = productLifecycle(workflow, product.status);
    return {
      ...product,
      status,
      progress: status === "production" ? 100 : productProgress(work.map((task) => ({
        completed: task.status === TaskStatus.DONE,
        progress: progressByTask.get(String(task._id)) ?? 0,
      }))),
      workflow: workflow ?? null,
      taskCount: work.length,
      completedTaskCount: work.filter((task) => task.status === TaskStatus.DONE).length,
    };
  });
  return { products: rows, contributions, progressByTask };
}

function getThumbnailFile(req: Request) {
  const uploaded = req.files?.thumbnail;
  const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;
  if (!file) return null;

  if (!file.mimetype.startsWith("image/")) {
    throw new ApiError(400, "Thumbnail must be an image file");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new ApiError(400, "Thumbnail must be 5 MB or smaller");
  }

  return file;
}

export async function listProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const { products } = await scopedProducts(req);
    return res.json({ success: true, products });
  } catch (error) {
    next(error);
  }
}

export async function createProduct(req: Request, res: Response, next: NextFunction) {
  try {
    requireExecutive(req);
    const thumbnail = getThumbnailFile(req);
    let thumbnailUrl: string | null = null;

    if (thumbnail) {
      const uploaded = await uploadProductThumbnail(
        thumbnail.data,
        String(req.authUser!._id),
        thumbnail.name,
      );
      thumbnailUrl = uploaded.secure_url;
    }

    const product = await Product.create({
      ...req.body,
      status: req.body.status ?? ProductStatus.UNASSIGNED,
      thumbnail: thumbnailUrl,
      createdBy: req.authUser!._id,
    });

    return res.status(201).json({ success: true, product: { ...product.toObject(), progress: product.status === ProductStatus.PRODUCTION ? 100 : 0, workflow: null, taskCount: 0, completedTaskCount: 0 } });
  } catch (error) {
    next(error);
  }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    requireExecutive(req);
    const id = productId(req);
    if (!await Product.exists({ _id: id, deletedAt: null })) throw new ApiError(404, "Product not found");
    const thumbnail = getThumbnailFile(req);
    const updates: Record<string, unknown> = { title: req.body.title, description: req.body.description, techStack: req.body.techStack, developer: req.body.developer ?? null };
    for (const field of ["summary", "category", "website", "isPublic"] as const) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (req.body.status) {
      if (await Task.exists({ productId: id, parentTaskId: null } as any))
        throw new ApiError(409, "This product is in a delivery workflow, so its status follows that workflow");
      updates.status = req.body.status;
    }
    const upload = thumbnail ? await uploadProductThumbnail(thumbnail.data, String(req.authUser!._id), thumbnail.name) : null;
    const product = await Product.findOneAndUpdate({ _id: id, deletedAt: null }, {
      $set: { ...updates, ...(upload ? { thumbnail: upload.secure_url } : {}) },
    }, { new: true, runValidators: true });
    if (!product) throw new ApiError(404, "Product not found");
    const result = await scopedProducts(req, id);
    return res.json({ success: true, product: result.products[0] });
  } catch (error) { next(error); }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction) {
  try {
    requireExecutive(req);
    const product = await Product.findOneAndUpdate({ _id: productId(req), deletedAt: null }, { $set: { deletedAt: new Date() } });
    if (!product) throw new ApiError(404, "Product not found");
    return res.json({ success: true });
  } catch (error) { next(error); }
}

export async function listProductHeads(req: Request, res: Response, next: NextFunction) {
  try {
    requireExecutive(req);
    const access = await resolveOrganizationAccess(req.authUser!._id, requestRoles(req), hasCompanyFeatureGrant(req, Permission.PRODUCT_ADMIN));
    const department = requestedDepartmentFilter(access, req.query.department);
    const heads = await OrganizationAssignment.find({ active: true, level: OrganizationLevel.HEAD, ...department })
      .populate({ path: "userId", select: "name email", match: { status: "ACTIVE" } }).lean();
    return res.json({ success: true, heads: heads.filter((head) => head.userId) });
  } catch (error) { next(error); }
}

export async function dispatchProduct(req: Request, res: Response, next: NextFunction) {
  try {
    requireExecutive(req);
    const id = productId(req);
    const head = req.body.executiveAssignment ? null : await findActiveDepartmentHead(req.body.department, req.body.headId);
    if (!head && !req.body.executiveAssignment) throw new ApiError(400, "This department does not have an active Head");
    const product = await Product.findOne({ _id: id, deletedAt: null }).lean();
    if (!product) throw new ApiError(404, "Product is no longer available");
    if (product.status === ProductStatus.PRODUCTION)
      throw new ApiError(409, "Production products cannot be sent for delivery. Change the status first.");
    try {
      await Task.create({
        _id: product._id,
        productId: product._id,
        title: product.title,
        description: product.description.slice(0, 4000),
        recommendedStack: product.techStack,
        deadline: req.body.deadline,
        department: req.body.department,
        assignedBy: req.authUser!._id,
        createdBy: req.authUser!._id,
        currentOwner: head?.userId ?? req.authUser!._id,
        workflowStage: head ? TaskWorkflowStage.HEAD_PLANNING : TaskWorkflowStage.ADMIN_REVIEW,
        workflowHistory: [
          { action: TaskWorkflowAction.CREATED, actorId: req.authUser!._id },
          ...(head ? [{ action: TaskWorkflowAction.ROUTED_TO_HEAD, actorId: req.authUser!._id, recipientId: head.userId, note: req.body.note }] : []),
        ],
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new ApiError(409, "Product is already assigned");
      throw error;
    }
    return res.status(201).json({ success: true, taskId: product._id });
  } catch (error) { next(error); }
}

export async function productDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page ?? 1);
    if (!Number.isSafeInteger(page) || page < 1) throw new ApiError(400, "Invalid report page");
    const { products, contributions, progressByTask } = await scopedProducts(req, productId(req));
    if (!products[0]) throw new ApiError(404, "Product not found in your reporting scope");
    const filter = { taskId: { $in: contributions.map((task) => task._id) } };
    const total = await TaskDailyReport.countDocuments(filter);
    const reports = await TaskDailyReport.find(filter).populate("userId", "name email")
      .sort({ reportDate: -1, updatedAt: -1, _id: -1 }).skip((page - 1) * 20).limit(20).lean();
    return res.json({ success: true, product: products[0], tasks: contributions.map((task) => ({
      ...task, progress: task.status === TaskStatus.DONE ? 100 : progressByTask.get(String(task._id)) ?? 0,
    })), reports, pagination: { page, total, totalPages: Math.max(1, Math.ceil(total / 20)) } });
  } catch (error) { next(error); }
}
