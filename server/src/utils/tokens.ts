import jwt from "jsonwebtoken";
import type mongoose from "mongoose";
import crypto from "crypto";
import "dotenv/config";

export async function createAccessToken(
  id: mongoose.Types.ObjectId,
  name: string,
  email: string,
): Promise<string> {
  const access_token = jwt.sign({ id: id.toString(), name, email }, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: "10m",
  });
  return access_token;
}

export async function createRefreshToken(
  id: mongoose.Types.ObjectId,
  name: string,
  email: string,
): Promise<string> {
  const payload = { id, name, email };
  const refresh_token = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: "7d",
  });
  return refresh_token;
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
