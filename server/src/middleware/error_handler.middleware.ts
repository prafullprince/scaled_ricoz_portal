import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError.utils.js";

// Error Handler
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  console.error("Unhandled error:", err);

  return res.status((err as { statusCode?: number })?.statusCode ?? 500).json({
    success: false,
    message: err instanceof Error ? err.message : "Internal server error",
  });
};
