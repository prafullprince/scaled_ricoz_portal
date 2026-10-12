import type { NextFunction, Request, Response } from "express";
import { User } from "../../models/index.js";
import { getOrCreateInternProfile } from "../verification/profile.service.js";
import type { UpdateInternRoleDto } from "./intern.validation.js";

// my-role (GET) — intern reads their initial (fixed) and current (self-editable) role.
export const getMyInternRole = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const profile = await getOrCreateInternProfile(req.authUser!._id);
    return res.status(200).json({ success: true, initialRole: profile.initialRole, currentRole: profile.currentRole });
  } catch (error) {
    next(error);
  }
};

// my-role (PATCH) — intern may change only their current role; initialRole is immutable once set.
export const updateMyInternRole = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const input: UpdateInternRoleDto = req.body;
    const profile = await getOrCreateInternProfile(req.authUser!._id);
    profile.currentRole = input.currentRole;
    profile.initialRole ??= input.currentRole;
    await profile.save();
    return res.status(200).json({ success: true, message: "Role updated", initialRole: profile.initialRole, currentRole: profile.currentRole });
  } catch (error) {
    next(error);
  }
};
