import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import {
  OrganizationAssignment,
  OrganizationLevel,
  ProductEngineeringPipelineDepartment,
  ProductEngineeringPipelineItem,
  ProductEngineeringPipelineStage,
} from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { UserRole } from "../auth/authorization.js";
import { requestRoles } from "../organization/organization.roles.js";

const pageSizeDefault = 100;

type PipelineRoleAssignment = {
  level?: OrganizationLevel;
  department?: string;
};

function isPipelineDepartment(value: string): value is ProductEngineeringPipelineDepartment {
  return Object.values(ProductEngineeringPipelineDepartment).some((department) => department === value);
}

export function canMoveProductEngineeringPipelineStage(
  roles: readonly string[],
  assignment: PipelineRoleAssignment | null,
  department: ProductEngineeringPipelineDepartment,
) {
  if (roles.includes(UserRole.CEO) || roles.includes(UserRole.ADMIN)) return true;
  return assignment?.level === OrganizationLevel.HEAD
    && assignment.department === department
    && roles.includes(`${department}_HEAD`);
}

async function resolvePipelineAccess(req: Request, requestedDepartment?: ProductEngineeringPipelineDepartment) {
  const roles = requestRoles(req);
  const executive = roles.includes(UserRole.CEO) || roles.includes(UserRole.ADMIN);
  if (executive) {
    return {
      department: requestedDepartment ?? ProductEngineeringPipelineDepartment.PRODUCT,
      canMoveStages: true,
      canCreate: true,
      executive: true,
      assignment: null,
    };
  }

  const assignment = await OrganizationAssignment.findOne({
    userId: req.authUser!._id,
    active: true,
  }).select("level department").lean();
  const assignmentDepartment = assignment ? String(assignment.department) : "";
  if (!assignment || !isPipelineDepartment(assignmentDepartment)) {
    throw new ApiError(403, "Product or Engineering department access is required");
  }
  if (requestedDepartment && requestedDepartment !== assignmentDepartment) {
    throw new ApiError(403, "You cannot view another department's pipeline");
  }

  const department = assignmentDepartment;
  return {
    department,
    canMoveStages: canMoveProductEngineeringPipelineStage(roles, assignment, department),
    canCreate: true,
    executive: false,
    assignment,
  };
}

const populatePipelineItem = (query: any) => query
  .populate("createdBy", "name email")
  .populate("stageHistory.actorId", "name email");

export async function listProductEngineeringPipeline(req: Request, res: Response, next: NextFunction) {
  try {
    const queryDepartment = req.query.department as ProductEngineeringPipelineDepartment | undefined;
    const access = await resolvePipelineAccess(req, queryDepartment);
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? pageSizeDefault);
    const filter = { department: access.department };
    const [items, total] = await Promise.all([
      populatePipelineItem(
        ProductEngineeringPipelineItem.find(filter)
          .sort({ updatedAt: -1, _id: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize),
      ).lean(),
      ProductEngineeringPipelineItem.countDocuments(filter),
    ]);
    return res.json({
      success: true,
      items,
      access: {
        department: access.department,
        canMoveStages: access.canMoveStages,
        canCreate: access.canCreate,
        canSelectDepartment: access.executive,
      },
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    next(error);
  }
}

export async function createProductEngineeringPipelineItem(req: Request, res: Response, next: NextFunction) {
  try {
    const requestedDepartment = req.body.department as ProductEngineeringPipelineDepartment | undefined;
    const access = await resolvePipelineAccess(req, requestedDepartment);
    const item = await ProductEngineeringPipelineItem.create({
      ...req.body,
      department: access.department,
      stage: ProductEngineeringPipelineStage.TASK_INTAKE,
      createdBy: req.authUser!._id,
      stageHistory: [],
    });
    return res.status(201).json({
      success: true,
      item: await populatePipelineItem(ProductEngineeringPipelineItem.findById(item._id)).lean(),
    });
  } catch (error) {
    next(error);
  }
}

export async function moveProductEngineeringPipelineItem(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid pipeline item");
    const current = await ProductEngineeringPipelineItem.findById(id);
    if (!current) throw new ApiError(404, "Pipeline item not found");

    const access = await resolvePipelineAccess(req, current.department);
    if (!access.canMoveStages) throw new ApiError(403, "Only the Product or Engineering Head, CEO, or Admin can move pipeline stages");

    const destination = req.body.stage as ProductEngineeringPipelineStage;
    if (destination === current.stage) {
      return res.json({
        success: true,
        item: await populatePipelineItem(ProductEngineeringPipelineItem.findById(current._id)).lean(),
      });
    }

    const updated = await ProductEngineeringPipelineItem.findOneAndUpdate(
      { _id: current._id, stage: current.stage },
      {
        $set: { stage: destination },
        $push: {
          stageHistory: {
            fromStage: current.stage,
            toStage: destination,
            actorId: req.authUser!._id,
            note: req.body.note ?? "",
            createdAt: new Date(),
          },
        },
      },
      { returnDocument: "after", runValidators: true },
    );
    if (!updated) throw new ApiError(409, "This item was moved by another user. Refresh and try again.");
    return res.json({
      success: true,
      item: await populatePipelineItem(ProductEngineeringPipelineItem.findById(updated._id)).lean(),
    });
  } catch (error) {
    next(error);
  }
}
