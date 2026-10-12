import { Router } from "express";
import { auth } from "../../middleware/auth.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { deleteUser, getUserDetails, listUsers, requireDirectoryAccess, updateUserStatus, updateUserProfile } from "./users.controller.js";
import { listUsersSchema, updateUserStatusSchema, userIdSchema, updateUserProfileSchema } from "./users.validation.js";

const router = Router();
const directoryAccess = [auth, requireDirectoryAccess];

router.get("/", ...directoryAccess, validateRequest(listUsersSchema), listUsers);
router.get("/:id", ...directoryAccess, validateRequest(userIdSchema), getUserDetails);
router.patch("/:id", ...directoryAccess, validateRequest(updateUserProfileSchema), updateUserProfile);
router.patch("/:id/status", ...directoryAccess, validateRequest(updateUserStatusSchema), updateUserStatus);
router.delete("/:id", ...directoryAccess, validateRequest(userIdSchema), deleteUser);

router.use(errorHandler);

export default router;
