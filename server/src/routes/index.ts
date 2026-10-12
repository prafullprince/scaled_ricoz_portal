import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import investorRoutes from "../modules/investor/investor.routes.js";
import internRoutes from "../modules/intern/intern.routes.js";
import employeeRoutes from "../modules/employee/employee.routes.js";
import analyticsRoutes from "../modules/analytics/analytics.routes.js";
import protectedRoutes from "./protected.routes.js";
import recruitmentRoutes from "../modules/recruitment/recruitment.routes.js";
import servicesRoutes from "../modules/services/services.routes.js";
import contactRoutes from "../modules/contact/contact.routes.js";
import taskRoutes from "../modules/tasks/task.routes.js";
import plannerRoutes from "../modules/planner/planner.routes.js";
import assistantRoutes from "../modules/assistant/assistant.routes.js";
import attendanceRoutes from "../modules/attendance/attendance.routes.js";
import leaveRoutes from "../modules/leave/leave.routes.js";
import performanceRoutes from "../modules/performance/performance.routes.js";
import organizationRoutes from "../modules/organization/organization.routes.js";
import chatRoutes from "../modules/chat/chat.routes.js";
import adminRoutes from "../modules/admin/admin.routes.js";
import salesRoutes from "../modules/sales/sales.routes.js";
import hrRoutes from "../modules/hr/hr.routes.js";
import marketingRoutes from "../modules/marketing/marketing.routes.js";
import productsRoutes from "../modules/products/products.routes.js";
import companyRoutes from "../modules/company/company.routes.js";
import userRoutes from "../modules/users/users.routes.js";
import notificationRoutes from "../modules/tasks/notification.routes.js";
import complianceRoutes from "../modules/compliance/compliance.routes.js";
import financeRoutes from "../modules/finance/finance.routes.js";
import integrationRoutes from "../modules/integrations/integration.routes.js";
import documentsRoutes from "../modules/documents/documents.routes.js";

// Router
const router = Router();

// Routes
router.use("/auth", authRoutes);
router.use("/protected", protectedRoutes);
router.use("/investor", investorRoutes);
router.use("/intern", internRoutes);
router.use("/employee", employeeRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/recruitment", recruitmentRoutes);
router.use("/services", servicesRoutes);
router.use("/contact", contactRoutes);
router.use("/tasks", taskRoutes);
router.use("/notifications", notificationRoutes);
router.use("/compliance", complianceRoutes);
router.use("/finance", financeRoutes);
router.use("/planner", plannerRoutes);
router.use("/assistant", assistantRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/leave", leaveRoutes);
router.use("/performance", performanceRoutes);
router.use("/organization", organizationRoutes);
router.use("/chat", chatRoutes);
router.use("/admin", adminRoutes);
router.use("/sales", salesRoutes);
router.use("/hr", hrRoutes);
router.use("/marketing", marketingRoutes);
router.use("/products", productsRoutes);
router.use("/companies", companyRoutes);
router.use("/users", userRoutes);
router.use("/integrations", integrationRoutes);
router.use("/documents", documentsRoutes);

// export router
export default router;
