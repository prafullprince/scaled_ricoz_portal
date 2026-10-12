import type { NextFunction, Request, Response } from "express";
import { PerformanceProfile, Task, TaskStatus } from "../../models/index.js";

const defaultCompetencies = { quality: 0, delivery: 0, collaboration: 0, innovation: 0, clientFocus: 0, learning: 0 };
export async function getPerformance(req: Request, res: Response, next: NextFunction) {
  try {
    const [profile, tasks] = await Promise.all([PerformanceProfile.findOne({ userId: req.authUser!._id }).lean(), Task.find({ assignedTo: req.authUser!._id }).lean()]);
    const competencies = profile?.competencies ?? defaultCompetencies;
    const completed = tasks.filter((task) => task.status === TaskStatus.DONE).length;
    const output = tasks.length ? Math.round((completed / tasks.length) * 100) : null;
    const values = Object.values(competencies);
    const overall = values.length && values.some((value) => value > 0) ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : output;
    return res.json({ success: true, performance: { period: profile?.period ?? "Current period", competencies, overall, output, feedback: profile?.feedback ?? [] } });
  } catch (error) { next(error); }
}
