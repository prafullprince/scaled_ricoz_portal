import { Router } from "express";
import { Types } from "mongoose";
import { auth } from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { Notification } from "../../models/notification.models.js";
import { Task } from "../../models/task.models.js";

const router = Router();
router.use(auth);
router.get("/task/:taskId", async (req, res, next) => {
  try {
    const taskId = String(req.params.taskId);
    if (!Types.ObjectId.isValid(taskId)) return res.status(400).json({ success: false, message: "Invalid task" });
    const notification = await Notification.exists({ userId: req.authUser!._id, taskId });
    const taskFilter = notification
      ? { _id: taskId }
      : {
        _id: taskId,
        $or: [
          { assignedTo: req.authUser!._id },
          { currentOwner: req.authUser!._id },
          { createdBy: req.authUser!._id },
          { assignedBy: req.authUser!._id },
        ],
      };
    const detail = await Task.findOne(taskFilter)
      .populate("assignedTo", "name email roles")
      .populate("assignedBy", "name email")
      .populate("createdBy", "name email")
      .populate("currentOwner", "name email")
      .lean();
    if (!detail) return res.status(404).json({ success: false, message: "Task not found" });
    return res.json({ success: true, task: detail });
  } catch (error) { next(error); }
});
router.get("/", async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return res.status(400).json({ success: false, message: "Invalid page" });
    const filter = { userId: req.authUser!._id };
    const [notifications, total, unread] = await Promise.all([Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 20).limit(20).lean(), Notification.countDocuments(filter), Notification.countDocuments({ ...filter, readAt: null })]);
    return res.json({ success: true, notifications, unread, pagination: { page, totalPages: Math.ceil(total / 20), total } });
  } catch (error) { next(error); }
});
router.patch("/:id/read", async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(String(req.params.id))) return res.status(400).json({ success: false, message: "Invalid notification" });
    const filter = { _id: req.params.id, userId: req.authUser!._id };
    const result = await Notification.updateOne(
      { ...filter, readAt: null },
      { $set: { readAt: new Date() } },
    );
    if (result.matchedCount) return res.json({ success: true });
    const exists = await Notification.exists(filter);
    return res.status(exists ? 200 : 404).json({ success: Boolean(exists) });
  } catch (error) { next(error); }
});
router.patch("/read", async (req, res, next) => {
  try { await Notification.updateMany({ userId: req.authUser!._id, readAt: null }, { $set: { readAt: new Date() } }); return res.json({ success: true }); } catch (error) { next(error); }
});
router.delete("/:id", async (req, res, next) => {
  try {
    if (!Types.ObjectId.isValid(String(req.params.id))) return res.status(400).json({ success: false, message: "Invalid notification" });
    const result = await Notification.deleteOne({ _id: req.params.id, userId: req.authUser!._id });
    return res.status(result.deletedCount ? 200 : 404).json({ success: Boolean(result.deletedCount) });
  } catch (error) { next(error); }
});
router.use(errorHandler);
export default router;