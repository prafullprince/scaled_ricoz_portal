import type { NextFunction, Request, Response } from "express";
import { HelpOptions } from "../../models/index.js";
import type { HelpOptionsInput } from "./help-options.validation.js";

const defaultOptions: HelpOptionsInput = {
  selfHelp: [
    {
      id: "my-work",
      title: "My Work",
      description: "Review your assigned work, tasks, and updates.",
      url: "/dashboard/my-work",
    },
    {
      id: "daily-planner",
      title: "Daily Planner",
      description: "Plan your day and keep track of what is next.",
      url: "/dashboard/planner",
    },
  ],
  usefulLinks: [
    {
      id: "whats-new",
      title: "What's New",
      description: "See the latest Ricoz product updates.",
      url: "/whats-new",
    },
    {
      id: "contact-ricoz",
      title: "Contact Ricoz",
      description: "Send a message to the Ricoz team.",
      url: "/contact",
    },
  ],
};

export async function getHelpOptions(_req: Request, res: Response, next: NextFunction) {
  try {
    const saved = await HelpOptions.findById("default").lean();
    return res.json({
      success: true,
      options: saved
        ? { selfHelp: saved.selfHelp, usefulLinks: saved.usefulLinks }
        : defaultOptions,
    });
  } catch (error) {
    return next(error);
  }
}

export async function saveHelpOptions(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as HelpOptionsInput;
    const saved = await HelpOptions.findOneAndUpdate(
      { _id: "default" },
      {
        $set: {
          selfHelp: input.selfHelp,
          usefulLinks: input.usefulLinks,
          updatedBy: req.authUser!._id,
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
    return res.json({
      success: true,
      options: { selfHelp: saved.selfHelp, usefulLinks: saved.usefulLinks },
    });
  } catch (error) {
    return next(error);
  }
}
