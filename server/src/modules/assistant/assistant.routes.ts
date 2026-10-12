import { Router } from "express";
import { auth, requirePermission } from "../../middleware/auth.middleware.js";
import { Permission } from "../auth/authorization.js";
import { chatAssistant } from "./assistant.controller.js";

const router = Router();
router.post("/chat", auth, requirePermission(Permission.PROFILE_READ), chatAssistant);
export default router;
