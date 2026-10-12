import { Router, type NextFunction, type Request, type Response } from "express";
import { auth } from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { authorizeHrDocumentManager } from "../hr/hr-documents.controller.js";
import { Permission } from "../auth/authorization.js";
import { requireRecruitmentAccess } from "../recruitment/recruitment-access.middleware.js";
import {
  emailDocument,
  generateAndSendDocument,
  generateDocument,
} from "./documents.controller.js";
import {
  emailDocumentSchema,
  generateAndSendDocumentSchema,
  generateDocumentSchema,
} from "./documents.validation.js";

const router = Router();

const requireDocumentAccess = async (req: Request, res: Response, next: NextFunction) => {
  if (req.body?.documentType === "OFFER_LETTER") {
    return requireRecruitmentAccess(Permission.RECRUITMENT_ADMIN)(req, res, next);
  }
  if (req.body?.documentType !== "HR_DOCUMENT") return next(new ApiError(400, "Unsupported document type"));
  try {
    await authorizeHrDocumentManager(req);
    next();
  } catch (error) {
    next(error);
  }
};

router.post("/generate", auth, validateRequest(generateDocumentSchema), requireDocumentAccess, generateDocument, errorHandler);
router.post("/send-email", auth, validateRequest(emailDocumentSchema), requireDocumentAccess, emailDocument, errorHandler);
router.post("/generate-and-send", auth, validateRequest(generateAndSendDocumentSchema), requireDocumentAccess, generateAndSendDocument, errorHandler);

export default router;
