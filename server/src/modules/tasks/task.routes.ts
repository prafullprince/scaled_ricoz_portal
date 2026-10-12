import { Router } from "express";
import {
  auth,
  requirePermission,
  requireRole,
} from "../../middleware/auth.middleware.js";
import { Permission, UserRole } from "../auth/authorization.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import {
  createTask,
  createDailyReport,
  getAdminReport,
  getTaskReport,
  listAdminTasks,
  listMyTasks,
  listTaskAssignees,
  updateTaskStatus,
  updateMyTaskStatus,
} from "./task.controller.js";
import {
  createWorkflowTask,
  delegateTask,
  listWorkflowCandidates,
  listWorkflowTasks,
  reviewWorkflowTask,
  routeTaskToHead,
  routeTaskToManager,
  submitWorkflowReport,
} from "./task-workflow.controller.js";
import { getHierarchyPerformance, getHierarchyProgress } from "./task-performance.controller.js";
import { createDailyReportSchema, createTaskSchema, createWorkflowTaskSchema, delegateTaskSchema, reviewWorkflowTaskSchema, routeTaskToHeadSchema, routeTaskToManagerSchema, submitMyTaskSchema, submitWorkflowReportSchema, updateTaskStatusSchema } from "./task.validation.js";
import {
  createProductEngineeringPipelineItem,
  listProductEngineeringPipeline,
  moveProductEngineeringPipelineItem,
} from "./product-engineering-pipeline.controller.js";
import {
  createProductEngineeringPipelineItemSchema,
  listProductEngineeringPipelineSchema,
  moveProductEngineeringPipelineItemSchema,
} from "./product-engineering-pipeline.validation.js";
import { createEngineeringDelivery, delegateEngineeringDelivery, listEngineeringDeliveries, listEngineeringDeliveryReports, reportEngineeringDeliveryProgress, transitionEngineeringDelivery } from "./engineering-delivery.controller.js";
import { createEngineeringDeliverySchema, delegateEngineeringDeliverySchema, listEngineeringDeliveryReportsSchema, listEngineeringDeliverySchema, reportEngineeringDeliveryProgressSchema, transitionEngineeringDeliverySchema } from "./engineering-delivery.validation.js";
import { restrictTaskCompanyReads } from "./task-company-access.js";
import { createMyWorkPriorityCategory, deleteMyWorkPriorityCategory, getMyWorkPriorities, resetMyWorkPriority, restoreMyWorkPriorityCategory, updateMyWorkPriority, updateMyWorkPriorityCategory } from "./task-priority-preference.controller.js";
import { createMyWorkPriorityCategorySchema, deleteMyWorkPriorityCategorySchema, resetMyWorkPrioritySchema, restoreMyWorkPriorityCategorySchema, updateMyWorkPriorityCategorySchema, updateMyWorkPrioritySchema } from "./task-priority-preference.validation.js";
import {
  completeMyPersonalTodo,
  createMyPersonalTodo,
  deleteMyPersonalTodo,
  listMyPersonalTodoHistory,
  listMyPersonalTodos,
  updateMyPersonalTodo,
} from "./personal-todo.controller.js";
import {
  createPersonalTodoSchema,
  personalTodoHistorySchema,
  personalTodoIdSchema,
  updatePersonalTodoSchema,
} from "./personal-todo.validation.js";

const router = Router();
const managerRoles = [UserRole.MANAGER, UserRole.PRODUCT_MANAGER, UserRole.MARKETING_MANAGER, UserRole.FINANCE_MANAGER, UserRole.SALES_MANAGER, UserRole.PROJECTS_MANAGER, UserRole.SUPPORT_MANAGER, UserRole.HR_MANAGER, UserRole.DESIGN_MANAGER, UserRole.ENGINEERING_MANAGER, UserRole.IT_MANAGER];
const headRoles = [UserRole.HEAD, UserRole.PRODUCT_HEAD, UserRole.MARKETING_HEAD, UserRole.FINANCE_HEAD, UserRole.SALES_HEAD, UserRole.PROJECTS_HEAD, UserRole.SUPPORT_HEAD, UserRole.HR_HEAD, UserRole.DESIGN_HEAD, UserRole.ENGINEERING_HEAD, UserRole.IT_HEAD];
const taskReaders = [UserRole.INTERN, UserRole.EMPLOYEE, UserRole.HR, UserRole.CFO, UserRole.CEO, UserRole.ADMIN, ...headRoles, ...managerRoles];
const personalTaskReaders = [...taskReaders, UserRole.INVESTOR];
const companyTaskManagers = [UserRole.ADMIN, UserRole.CEO, UserRole.HR];
const workflowRoles = [...companyTaskManagers, ...headRoles, ...managerRoles];

router.get("/my-work-priorities", auth, getMyWorkPriorities, errorHandler);
router.put("/my-work-priorities", auth, validateRequest(updateMyWorkPrioritySchema), updateMyWorkPriority, errorHandler);
router.delete("/my-work-priorities", auth, validateRequest(resetMyWorkPrioritySchema), resetMyWorkPriority, errorHandler);
router.post("/my-work-priorities/categories", auth, validateRequest(createMyWorkPriorityCategorySchema), createMyWorkPriorityCategory, errorHandler);
router.patch("/my-work-priorities/categories", auth, validateRequest(updateMyWorkPriorityCategorySchema), updateMyWorkPriorityCategory, errorHandler);
router.delete("/my-work-priorities/categories", auth, validateRequest(deleteMyWorkPriorityCategorySchema), deleteMyWorkPriorityCategory, errorHandler);
router.post("/my-work-priorities/categories/restore", auth, validateRequest(restoreMyWorkPriorityCategorySchema), restoreMyWorkPriorityCategory, errorHandler);

router.get("/todos", auth, listMyPersonalTodos, errorHandler);
router.get("/todos/history", auth, validateRequest(personalTodoHistorySchema), listMyPersonalTodoHistory, errorHandler);
router.post("/todos", auth, validateRequest(createPersonalTodoSchema), createMyPersonalTodo, errorHandler);
router.patch("/todos/:todoId", auth, validateRequest(updatePersonalTodoSchema), updateMyPersonalTodo, errorHandler);
router.post("/todos/:todoId/complete", auth, validateRequest(personalTodoIdSchema), completeMyPersonalTodo, errorHandler);
router.delete("/todos/:todoId", auth, validateRequest(personalTodoIdSchema), deleteMyPersonalTodo, errorHandler);

router.get("/engineering-delivery", auth, restrictTaskCompanyReads, validateRequest(listEngineeringDeliverySchema), listEngineeringDeliveries, errorHandler);
router.post("/engineering-delivery", auth, validateRequest(createEngineeringDeliverySchema), createEngineeringDelivery, errorHandler);
router.post("/engineering-delivery/:id/work", auth, validateRequest(delegateEngineeringDeliverySchema), delegateEngineeringDelivery, errorHandler);
router.patch("/engineering-delivery/:id/transition", auth, validateRequest(transitionEngineeringDeliverySchema), transitionEngineeringDelivery, errorHandler);
router.get("/engineering-delivery/reports", auth, restrictTaskCompanyReads, requireRole(...taskReaders), requirePermission(Permission.TASK_REPORT_READ), validateRequest(listEngineeringDeliveryReportsSchema), listEngineeringDeliveryReports, errorHandler);
router.patch("/engineering-delivery/:id/progress", auth, requireRole(...taskReaders), requirePermission(Permission.TASK_REPORT_READ), validateRequest(reportEngineeringDeliveryProgressSchema), reportEngineeringDeliveryProgress, errorHandler);

router.get("/product-engineering-pipeline", auth, restrictTaskCompanyReads, validateRequest(listProductEngineeringPipelineSchema), listProductEngineeringPipeline, errorHandler);
router.post("/product-engineering-pipeline", auth, validateRequest(createProductEngineeringPipelineItemSchema), createProductEngineeringPipelineItem, errorHandler);
router.patch("/product-engineering-pipeline/:id/stage", auth, validateRequest(moveProductEngineeringPipelineItemSchema), moveProductEngineeringPipelineItem, errorHandler);

router.get("/workflow", auth, restrictTaskCompanyReads, requireRole(...workflowRoles), requirePermission(Permission.TASK_ASSIGN), listWorkflowTasks, errorHandler);
router.get("/workflow/performance", auth, restrictTaskCompanyReads, requireRole(...workflowRoles), requirePermission(Permission.TASK_REPORT_READ), getHierarchyPerformance, errorHandler);
router.get("/workflow/progress", auth, restrictTaskCompanyReads, requireRole(...workflowRoles), requirePermission(Permission.TASK_REPORT_READ), getHierarchyProgress, errorHandler);
router.get("/workflow/:id/candidates", auth, restrictTaskCompanyReads, requireRole(...workflowRoles), requirePermission(Permission.TASK_ASSIGN), listWorkflowCandidates, errorHandler);
router.post("/workflow", auth, requireRole(...companyTaskManagers), requirePermission(Permission.TASK_ASSIGN), validateRequest(createWorkflowTaskSchema), createWorkflowTask, errorHandler);
router.patch("/workflow/:id/route-head", auth, requireRole(...companyTaskManagers), requirePermission(Permission.TASK_ASSIGN), validateRequest(routeTaskToHeadSchema), routeTaskToHead, errorHandler);
router.patch("/workflow/:id/route-manager", auth, requireRole(...companyTaskManagers, ...headRoles), requirePermission(Permission.TASK_ASSIGN), validateRequest(routeTaskToManagerSchema), routeTaskToManager, errorHandler);
router.post("/workflow/:id/subtasks", auth, requireRole(...companyTaskManagers, ...headRoles, ...managerRoles), requirePermission(Permission.TASK_ASSIGN), validateRequest(delegateTaskSchema), delegateTask, errorHandler);
router.post("/workflow/:id/report", auth, requireRole(...companyTaskManagers, ...headRoles, ...managerRoles), requirePermission(Permission.TASK_ASSIGN), validateRequest(submitWorkflowReportSchema), submitWorkflowReport, errorHandler);
router.patch("/workflow/:id/review", auth, requireRole(...workflowRoles), requirePermission(Permission.TASK_ASSIGN), validateRequest(reviewWorkflowTaskSchema), reviewWorkflowTask, errorHandler);

router.get(
  "/mine",
  auth,
  restrictTaskCompanyReads,
  requireRole(...personalTaskReaders),
  requirePermission(Permission.INTERN_TASK_READ),
  listMyTasks,
  errorHandler,
);
router.get(
  "/report",
  auth,
  restrictTaskCompanyReads,
  requireRole(...taskReaders),
  requirePermission(Permission.TASK_REPORT_READ),
  getTaskReport,
  errorHandler,
);
router.get(
  "/admin/assignees",
  auth,
  restrictTaskCompanyReads,
  requireRole(...workflowRoles),
  requirePermission(Permission.TASK_ASSIGN),
  listTaskAssignees,
  errorHandler,
);
router.get(
  "/admin",
  auth,
  restrictTaskCompanyReads,
  requireRole(...workflowRoles),
  requirePermission(Permission.TASK_ASSIGN),
  listAdminTasks,
  errorHandler,
);
router.get(
  "/admin/report",
  auth,
  restrictTaskCompanyReads,
  requireRole(...workflowRoles),
  requirePermission(Permission.TASK_REPORT_READ),
  getAdminReport,
  errorHandler,
);
router.post(
  "/admin",
  auth,
  requireRole(...workflowRoles),
  requirePermission(Permission.TASK_ASSIGN),
  validateRequest(createTaskSchema),
  createTask,
  errorHandler,
);
router.post("/daily-reports", auth, requireRole(...taskReaders), requirePermission(Permission.TASK_REPORT_READ), validateRequest(createDailyReportSchema), createDailyReport, errorHandler);
router.patch(
  "/:id/status",
  auth,
  requireRole(...personalTaskReaders),
  requirePermission(Permission.INTERN_TASK_READ),
  validateRequest(submitMyTaskSchema),
  updateMyTaskStatus,
  errorHandler,
);
router.patch(
  "/admin/:id/status",
  auth,
  requireRole(...companyTaskManagers),
  requirePermission(Permission.TASK_ASSIGN),
  validateRequest(updateTaskStatusSchema),
  updateTaskStatus,
  errorHandler,
);

export default router;
