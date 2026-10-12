import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import {
  Company,
  EmployeeProfile,
  HrDocument,
  HrDocumentStatus,
  HrDocumentType,
  InternProfile,
  User,
} from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { UserRole } from "../auth/authorization.js";
import { currentScope } from "../company/company.context.js";
import { requestRoles } from "../organization/organization.roles.js";
import { findEmployee } from "./hr-finance.controller.js";
import { hrOperationalAccess } from "./hr.controller.js";
import { renderHrDocumentPdf } from "./hr-document.pdf.js";

const maximumDocumentSize = 10 * 1024 * 1024;
const documentTitles: Record<HrDocumentType, string> = {
  [HrDocumentType.APPOINTMENT_LETTER]: "Appointment Letter",
  [HrDocumentType.SERVICE_CERTIFICATE]: "Employment / Service Certificate",
  [HrDocumentType.EXPERIENCE_CERTIFICATE]: "Experience Certificate",
  [HrDocumentType.RELIEVING_LETTER]: "Relieving Letter",
  [HrDocumentType.SALARY_REVISION_LETTER]: "Salary Revision Letter",
  [HrDocumentType.PROMOTION_LETTER]: "Promotion Letter / Certificate",
  [HrDocumentType.TRANSFER_DESIGNATION_LETTER]: "Transfer / Designation Change Letter",
  [HrDocumentType.PROBATION_CONFIRMATION]: "Probation Confirmation Letter",
  [HrDocumentType.FULL_FINAL_SETTLEMENT]: "Full & Final Settlement Document",
  [HrDocumentType.NO_OBJECTION_CERTIFICATE]: "No Objection Certificate",
  [HrDocumentType.EMPLOYMENT_VERIFICATION]: "Employment Verification Letter",
  [HrDocumentType.LEAVE_APPROVAL_RECORD]: "Leave Approval / Record",
  [HrDocumentType.STATUTORY_TAX_DOCUMENT]: "Statutory / Tax Document",
  [HrDocumentType.EXIT_SEPARATION_DOCUMENT]: "Exit / Separation Documentation",
  [HrDocumentType.EMPLOYEE_OF_MONTH]: "Employee of the Month",
  [HrDocumentType.EMPLOYEE_OF_WEEK]: "Employee of the Week",
  [HrDocumentType.EMPLOYEE_OF_YEAR]: "Employee of the Year",
};

const templateFieldLabels: Record<string, string> = {
  annualCtc: "Annual CTC",
  employeeNumber: "Employee ID",
  hrReviewedInformation: "HR-reviewed information",
  monthlyGrossSalary: "Monthly gross salary",
  noObjectionScope: "Scope of no-objection",
  salaryStructureReference: "Salary structure reference",
};

function templateFieldLabel(key: string) {
  return templateFieldLabels[key]
    ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

export async function authorizeHrDocumentManager(req: Request) {
  const access = await hrOperationalAccess(req.authUser!._id, requestRoles(req));
  if (!access.executive && access.assignment.department !== "HR") {
    throw new ApiError(403, "HR document access is required");
  }
}

function documentMetadata(document: {
  _id: Types.ObjectId;
  employeeId: Types.ObjectId;
  type: HrDocumentType;
  title: string;
  referenceNumber: string;
  issueDate: Date;
  effectiveDate: Date | null;
  status: HrDocumentStatus;
  fileName: string;
  fileSize: number;
  publishedAt: Date | null;
  createdAt: Date;
}, employee?: { name: string; email: string }) {
  return {
    id: String(document._id),
    employeeId: String(document.employeeId),
    employeeName: employee?.name ?? "",
    employeeEmail: employee?.email ?? "",
    type: document.type,
    title: document.title,
    referenceNumber: document.referenceNumber,
    issueDate: document.issueDate,
    effectiveDate: document.effectiveDate,
    status: document.status,
    fileName: document.fileName,
    fileSize: document.fileSize,
    publishedAt: document.publishedAt,
    createdAt: document.createdAt,
  };
}

function sendHrDocumentFile(res: Response, file: { fileName: string; fileData?: Buffer }) {
  if (!Buffer.isBuffer(file.fileData) || !file.fileData.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new ApiError(404, "HR document PDF not found or invalid");
  }
  res.set({
    "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    "Content-Type": "application/pdf",
    "X-Content-Type-Options": "nosniff",
  });
  return res.send(file.fileData);
}

export async function listHrDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    await authorizeHrDocumentManager(req);
    const documents = await HrDocument.find({})
      .select("employeeId type title referenceNumber issueDate effectiveDate status fileName fileSize publishedAt createdAt")
      .sort({ createdAt: -1 })
      .lean();
    const employeeIds = [...new Set(documents.map((document) => String(document.employeeId)))];
    const employees = employeeIds.length
      ? await User.find({ _id: { $in: employeeIds } }).select("name email").lean()
      : [];
    const employeesById = new Map(employees.map((employee) => [String(employee._id), employee]));
    return res.json({
      success: true,
      documents: documents.map((document) =>
        documentMetadata(document, employeesById.get(String(document.employeeId))),
      ),
    });
  } catch (error) { next(error); }
}

export async function createHrDocument(req: Request, res: Response, next: NextFunction) {
  try {
    await authorizeHrDocumentManager(req);
    const input = req.body as {
      employeeId: string;
      type: HrDocumentType;
      issueDate: string;
      effectiveDate?: string;
      details?: string;
      fields?: Record<string, string>;
    };
    const employee = await findEmployee(input.employeeId);
    const scope = currentScope();
    if (!scope) throw new ApiError(500, "An active company scope is required");
    const employeeId = new Types.ObjectId(employee.id);
    const [company, employeeProfile, internProfile] = await Promise.all([
      Company.findById(scope.companyId).select("name offerLetterProfile").lean(),
      EmployeeProfile.findOne({ userId: employeeId }).select("joiningDate endDate address currentRole department").lean(),
      InternProfile.findOne({ userId: employeeId }).select("joiningDate endDate address currentRole department").lean(),
    ]);
    if (!company) throw new ApiError(404, "Active company not found");

    const details = input.fields
      ? Object.entries(input.fields)
        .filter(([, value]) => value.trim())
        .map(([key, value]) => `${templateFieldLabel(key)}:\n${value.trim()}`)
        .join("\n\n")
      : input.details?.trim();
    if (!details || details.length < 10) throw new ApiError(400, "Document details are required");
    if (details.length > 5_000) throw new ApiError(400, "Document details must not exceed 5,000 characters");

    const documentId = new Types.ObjectId();
    const referenceNumber = `RICOZ-HR-${input.issueDate.slice(0, 4)}-${documentId.toString().slice(-8).toUpperCase()}`;
    const title = documentTitles[input.type];
    const issueDate = new Date(`${input.issueDate}T00:00:00.000Z`);
    const effectiveDate = input.effectiveDate
      ? new Date(`${input.effectiveDate}T00:00:00.000Z`)
      : null;
    const fileName = `${referenceNumber.toLowerCase()}.pdf`;
    const fileData = await renderHrDocumentPdf({
      companyName: company.name,
      companyLegalName: company.offerLetterProfile?.legalName ?? company.name,
      companyDisplayName: company.offerLetterProfile?.displayName ?? company.name,
      companyAddress: company.offerLetterProfile?.address ?? null,
      employeeName: employee.name,
      employeeEmail: employee.email,
      employeeAddress: employeeProfile?.address ?? internProfile?.address ?? null,
      role: employeeProfile?.currentRole ?? internProfile?.currentRole ?? employee.role,
      department: employeeProfile?.department ?? internProfile?.department ?? employee.department,
      joiningDate: employeeProfile?.joiningDate ?? internProfile?.joiningDate ?? null,
      employmentEndDate: employeeProfile?.endDate ?? internProfile?.endDate ?? null,
      type: input.type,
      title,
      referenceNumber,
      issueDate,
      effectiveDate,
      details,
    });
    if (!fileData.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      throw new ApiError(500, "Generated HR document is not a valid PDF");
    }
    if (fileData.length > maximumDocumentSize) throw new ApiError(413, "Generated HR document exceeds the 10 MB file limit");
    const document = await HrDocument.create({
      _id: documentId,
      employeeId,
      type: input.type,
      title,
      referenceNumber,
      issueDate,
      effectiveDate,
      details,
      status: HrDocumentStatus.DRAFT,
      fileName,
      fileSize: fileData.length,
      fileData,
      createdBy: req.authUser!._id,
    });
    return res.status(201).json({
      success: true,
      document: documentMetadata(document, { name: employee.name, email: employee.email }),
    });
  } catch (error) { next(error); }
}

export async function publishHrDocument(req: Request, res: Response, next: NextFunction) {
  try {
    await authorizeHrDocumentManager(req);
    const document = await HrDocument.findById(req.params.documentId).exec();
    if (!document || document.status !== HrDocumentStatus.DRAFT) {
      throw new ApiError(404, "Draft HR document not found");
    }
    document.status = HrDocumentStatus.PUBLISHED;
    document.publishedBy = req.authUser!._id;
    document.publishedAt = new Date();
    await document.save();
    return res.json({ success: true, document: documentMetadata(document) });
  } catch (error) { next(error); }
}

export async function discardHrDocument(req: Request, res: Response, next: NextFunction) {
  try {
    await authorizeHrDocumentManager(req);
    const document = await HrDocument.findById(req.params.documentId).exec();
    if (!document || document.status !== HrDocumentStatus.DRAFT) {
      throw new ApiError(404, "Draft HR document not found");
    }
    await document.deleteOne();
    return res.json({ success: true });
  } catch (error) { next(error); }
}

export async function downloadHrDocument(req: Request, res: Response, next: NextFunction) {
  try {
    await authorizeHrDocumentManager(req);
    const document = await HrDocument.findById(req.params.documentId).select("+fileData").exec();
    if (!document) throw new ApiError(404, "HR document not found");
    return sendHrDocumentFile(res, document);
  } catch (error) { next(error); }
}

async function authorizeMyHrDocuments(req: Request) {
  if (!requestRoles(req).some((role) =>
    role !== UserRole.USER && role !== UserRole.CUSTOMER && role !== UserRole.INVESTOR,
  )) {
    throw new ApiError(403, "Employee document access is required");
  }
}

export async function listMyHrDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    await authorizeMyHrDocuments(req);
    const documents = await HrDocument.find({
      employeeId: req.authUser!._id,
      status: HrDocumentStatus.PUBLISHED,
      publishedAt: { $lte: new Date() },
    }).select("employeeId type title referenceNumber issueDate effectiveDate status fileName fileSize publishedAt createdAt")
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, documents: documents.map((document) => documentMetadata(document)) });
  } catch (error) { next(error); }
}

export async function downloadMyHrDocument(req: Request, res: Response, next: NextFunction) {
  try {
    await authorizeMyHrDocuments(req);
    const document = await HrDocument.findById(req.params.documentId).select("+fileData").exec();
    if (!document
      || String(document.employeeId) !== String(req.authUser!._id)
      || document.status !== HrDocumentStatus.PUBLISHED
      || !document.publishedAt
      || document.publishedAt > new Date()) {
      throw new ApiError(404, "HR document not found");
    }
    return sendHrDocumentFile(res, document);
  } catch (error) { next(error); }
}

export { documentTitles };
