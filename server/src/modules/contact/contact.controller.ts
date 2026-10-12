import type { NextFunction, Request, Response } from "express";
import { sendContactEmail } from "../../utils/email.utils.js";
import type { ContactInput } from "./contact.validation.js";

export async function submitContact(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as ContactInput;
    await sendContactEmail(input);
    return res.status(200).json({ success: true, message: "Thanks for reaching out. We will be in touch soon." });
  } catch (error) {
    next(error);
  }
}