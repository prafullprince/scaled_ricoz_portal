import { Router } from "express";
import { auth, requirePermission, requireRole } from "../../middleware/auth.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { Permission, UserRole } from "../auth/authorization.js";
import { createProduct, listProducts, updateProduct, deleteProduct, dispatchProduct, listProductHeads, productDetails } from "./products.controller.js";
import { productSchema, dispatchProductSchema } from "./products.validation.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { getPublicProduct, listPublicProducts } from "./products.public.js";

const router = Router();

const productAdminOnly = [
  auth,
  requireRole(UserRole.ADMIN, UserRole.CEO, UserRole.HR),
  requirePermission(Permission.PRODUCT_ADMIN),
];

router.get("/admin", ...productAdminOnly, listProducts);
router.get("/public", listPublicProducts);
router.get("/public/:id", getPublicProduct);
router.get("/", auth, listProducts);
router.get("/heads", ...productAdminOnly, listProductHeads);
router.get("/:id/progress", auth, productDetails);
router.put("/admin/:id", ...productAdminOnly, validateRequest(productSchema), updateProduct);
router.delete("/admin/:id", ...productAdminOnly, deleteProduct);
router.post("/admin/:id/dispatch", ...productAdminOnly, validateRequest(dispatchProductSchema), dispatchProduct);
router.post(
  "/admin",
  ...productAdminOnly,
  validateRequest(productSchema),
  createProduct,
);

router.use(errorHandler);

export default router;
