import type { NextFunction, Request, Response } from "express";
import { EmployeeProfile, Task, TaskStatus, WorkspaceData } from "../../models/index.js";

export async function getEmployeeDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.authUser!._id;
    const [profile, workspace, tasks] = await Promise.all([
      EmployeeProfile.findOne({ userId }).lean(),
      WorkspaceData.findOne({ userId }).lean(),
      Task.find({ assignedTo: userId }).sort({ deadline: 1 }).lean(),
    ]);
    const pending = tasks.filter((task) => task.status === TaskStatus.PENDING);
    const today = new Date();
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);
    const dueToday = pending.filter((task) => new Date(task.deadline) <= endOfToday);
    const completed = tasks.filter((task) => task.status === TaskStatus.DONE).length;
    return res.json({ success: true, dashboard: { profile: { designation: profile?.currentRole ?? profile?.initialRole ?? null, department: workspace?.department ?? null }, stats: { activeProjects: workspace?.activeProjects ?? null, tasksDueToday: dueToday.length, urgentTasks: dueToday.length, leaveRemaining: workspace?.leaveBalances?.earned ?? null, trainingProgress: workspace?.trainingProgress ?? null }, leaveBalances: workspace?.leaveBalances ?? null, trainingModules: workspace?.trainingModules ?? [], schedule: workspace?.schedule ?? [], productivity: workspace?.productivity ?? [], tasks: tasks.slice(0, 10).map((task) => ({ id: String(task._id), title: task.title, description: task.description, deadline: task.deadline, status: task.status, progress: task.status === TaskStatus.DONE ? 100 : 0 })), completedTasks: completed } });
  } catch (error) { next(error); }
}
