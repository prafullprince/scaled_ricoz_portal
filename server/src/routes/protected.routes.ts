import { Router } from "express";
import { auth, requirePermission, requireRole } from "../middleware/auth.middleware.js";
import { Permission, UserRole } from "../modules/auth/authorization.js";

const router = Router();

router.get("/profile", auth, requirePermission(Permission.PROFILE_READ), (req, res) => {
  const user = req.authUser!;
  return res.json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      roles: user.roles,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
    },
  });
});

router.get(
  "/customer",
  auth,
  requireRole(UserRole.CUSTOMER),
  requirePermission(Permission.CUSTOMER_READ),
  (_req, res) => res.json({ success: true, area: "customer" }),
);
router.get(
  "/investor",
  auth,
  requireRole(UserRole.INVESTOR),
  requirePermission(Permission.INVESTOR_READ),
  (_req, res) => res.json({ success: true, area: "investor" }),
);
router.get(
  "/intern",
  auth,
  requireRole(UserRole.INTERN),
  requirePermission(Permission.INTERN_READ),
  (_req, res) => res.json({ success: true, area: "intern" }),
);
router.get(
  "/employee",
  auth,
  requireRole(UserRole.EMPLOYEE),
  requirePermission(Permission.EMPLOYEE_READ),
  (_req, res) => res.json({ success: true, area: "employee" }),
);

export default router;
