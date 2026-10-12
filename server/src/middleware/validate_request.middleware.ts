import type { NextFunction, Request, Response } from "express";
import { z, ZodError } from "zod";
import { ApiError } from "../utils/apiError.utils.js";

// Validate Incoming Request By Zod
export const validateRequest =
  (schema: z.ZodType) => (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      }) as {
        body: any;
        query?: any;
        params?: any;
      };
      req.body = parsed.body ?? req.body;
      res.locals.query = parsed.query ?? req.query;
      res.locals.params = parsed.params ?? req.params;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const formatted = err.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        return next(new ApiError(400, "Validation failed", formatted));
      }
      next(err);
    }
  };
