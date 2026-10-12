import { Router } from "express";
import { auth, requirePermission } from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { Permission } from "../auth/authorization.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { attendanceActionSchema, attendanceMonthSchema } from "./attendance.validation.js";
import { checkIn, checkOut, getAttendance } from "./attendance.controller.js";

const router = Router();
const guard = [auth, requirePermission(Permission.ATTENDANCE_USE)];
router.get("/", ...guard, validateRequest(attendanceMonthSchema), getAttendance, errorHandler);
router.post("/check-in", ...guard, validateRequest(attendanceActionSchema), checkIn, errorHandler);
router.post("/check-out", ...guard, validateRequest(attendanceActionSchema), checkOut, errorHandler);
export default router;
