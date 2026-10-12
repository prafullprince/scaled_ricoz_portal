import type { NextFunction, Request, Response } from "express";
import { CustomerProject, Service, ServiceRequest, ServiceRequestStatus, ServiceStatus } from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { UserRole } from "../auth/authorization.js";
import { requestRoles } from "../organization/organization.roles.js";

const published = { status: ServiceStatus.PUBLISHED };
export async function listPublicServices(_req: Request, res: Response, next: NextFunction) { try { return res.json({ success: true, services: await Service.find(published).select("-createdBy").sort({ publishedAt: -1 }).lean() }); } catch (error) { next(error); } }
export async function getPublicService(req: Request, res: Response, next: NextFunction) { try { const service = await Service.findOne({ slug: req.params.slug, ...published } as any).select("-createdBy").lean(); if (!service) throw new ApiError(404, "Service not found"); return res.json({ success: true, service }); } catch (error) { next(error); } }
export async function listAdminServices(_req: Request, res: Response, next: NextFunction) { try { return res.json({ success: true, services: await Service.find().sort({ createdAt: -1 }).lean() }); } catch (error) { next(error); } }
export async function createService(req: Request, res: Response, next: NextFunction) { try { const service = await Service.create({ ...req.body, createdBy: req.authUser!._id, status: ServiceStatus.DRAFT }); return res.status(201).json({ success: true, service }); } catch (error) { next(error); } }
export async function updateService(req: Request, res: Response, next: NextFunction) { try { const service = await Service.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true }); if (!service) throw new ApiError(404, "Service not found"); return res.json({ success: true, service }); } catch (error) { next(error); } }
export async function changeServiceStatus(req: Request, res: Response, next: NextFunction) { try { const update: Record<string, unknown> = { status: req.body.status }; if (req.body.status === ServiceStatus.PUBLISHED) update.publishedAt = new Date(); const service = await Service.findByIdAndUpdate(req.params.id, update, { new: true }); if (!service) throw new ApiError(404, "Service not found"); return res.json({ success: true, service }); } catch (error) { next(error); } }
export async function createRequest(req: Request, res: Response, next: NextFunction) { try { if (!requestRoles(req).includes(UserRole.CUSTOMER)) throw new ApiError(403, "Service booking is available to customer accounts"); const service = await Service.findOne({ _id: req.params.id, ...published } as any); if (!service) throw new ApiError(404, "Service is not available"); try { const request = await ServiceRequest.create({ ...req.body, serviceId: service._id, customerId: req.authUser!._id }); return res.status(201).json({ success: true, request }); } catch (error: unknown) { if ((error as { code?: number }).code === 11000) throw new ApiError(409, "You have already submitted this request"); throw error; } } catch (error) { next(error); } }
export async function listCustomerRequests(req: Request, res: Response, next: NextFunction) { try { return res.json({ success: true, requests: await ServiceRequest.find({ customerId: req.authUser!._id }).populate("serviceId", "title slug category").sort({ createdAt: -1 }).lean() }); } catch (error) { next(error); } }
export async function getCustomerRequest(req: Request, res: Response, next: NextFunction) { try { const request = await ServiceRequest.findOne({ _id: req.params.id, customerId: req.authUser!._id } as any).populate("serviceId").lean(); if (!request) throw new ApiError(404, "Service request not found"); return res.json({ success: true, request }); } catch (error) { next(error); } }
export async function listCustomerProjects(req: Request, res: Response, next: NextFunction) { try { return res.json({ success: true, projects: await CustomerProject.find({ customerId: req.authUser!._id }).populate("serviceId", "title slug category").sort({ createdAt: -1 }).lean() }); } catch (error) { next(error); } }
export async function listAdminRequests(_req: Request, res: Response, next: NextFunction) { try { return res.json({ success: true, requests: await ServiceRequest.find().populate("customerId", "name email roles phoneNumber").populate("serviceId", "title slug category").sort({ createdAt: -1 }).lean() }); } catch (error) { next(error); } }
async function review(req: Request, res: Response, next: NextFunction, status: ServiceRequestStatus) { try { const request = await ServiceRequest.findById(req.params.id); if (!request) throw new ApiError(404, "Service request not found"); if (![ServiceRequestStatus.PENDING, ServiceRequestStatus.UNDER_REVIEW].includes(request.status)) throw new ApiError(409, "This request has already been reviewed"); request.status = status; request.reviewedAt = new Date(); request.reviewedBy = req.authUser!._id; if (status === ServiceRequestStatus.ACCEPTED) { request.acceptedAt = new Date(); await CustomerProject.findOneAndUpdate({ serviceRequestId: request._id }, { $setOnInsert: { customerId: request.customerId, serviceId: request.serviceId, serviceRequestId: request._id, title: request.projectTitle } }, { upsert: true, new: true, setDefaultsOnInsert: true }); } else request.declineReason = req.body.reason ?? null; await request.save(); return res.json({ success: true, request }); } catch (error) { next(error); } }
export const acceptRequest = (req: Request, res: Response, next: NextFunction) => review(req, res, next, ServiceRequestStatus.ACCEPTED);
export const declineRequest = (req: Request, res: Response, next: NextFunction) => review(req, res, next, ServiceRequestStatus.DECLINED);
export async function completeRequest(req: Request, res: Response, next: NextFunction) {
	try {
		const request = await ServiceRequest.findById(req.params.id);
		if (!request) throw new ApiError(404, "Service request not found");
		if (request.status !== ServiceRequestStatus.ACCEPTED) throw new ApiError(409, "Only accepted requests can be marked done");
		const project = await CustomerProject.findOneAndUpdate(
			{ serviceRequestId: request._id },
			{ $set: { status: "COMPLETED" } },
			{ new: true },
		);
		if (!project) throw new ApiError(404, "Customer project not found");
		return res.json({ success: true, message: "Service marked as done", request, project });
	} catch (error) { next(error); }
}