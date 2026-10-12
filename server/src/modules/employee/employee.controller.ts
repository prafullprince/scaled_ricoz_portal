import type { NextFunction, Request, Response } from "express";
import { getOrCreateEmployeeProfile } from "../verification/profile.service.js";
import type { UpdateEmployeeRoleDto } from "./employee.validation.js";

// my-role (GET) — employee reads their initial (fixed) and current (self-editable) role.
export const getMyEmployeeRole = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const profile = await getOrCreateEmployeeProfile(req.authUser!._id);
    return res.status(200).json({ success: true, initialRole: profile.initialRole, currentRole: profile.currentRole });
  } catch (error) {
    next(error);
  }
};

// my-role (PATCH) — employee may change only their current role; initialRole is immutable once set.
export const updateMyEmployeeRole = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const input: UpdateEmployeeRoleDto = req.body;
    const profile = await getOrCreateEmployeeProfile(req.authUser!._id);
    profile.currentRole = input.currentRole;
    profile.initialRole ??= input.currentRole;
    await profile.save();
    return res.status(200).json({ success: true, message: "Role updated", initialRole: profile.initialRole, currentRole: profile.currentRole });
  } catch (error) {
    next(error);
  }
};
