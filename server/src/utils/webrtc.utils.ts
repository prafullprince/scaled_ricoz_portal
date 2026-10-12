import { createHmac } from "node:crypto";

export function callIceServers(userId: string, now = Date.now()) {
  const iceServers: { urls: string[]; username?: string; credential?: string }[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ];
  const urls = (process.env.TURN_URLS ?? "").split(",").map((url) => url.trim()).filter(Boolean);
  const secret = process.env.TURN_SHARED_SECRET;
  if (urls.length && secret) {
    if (urls.some((url) => !/^turns?:[^\s]+$/.test(url))) {
      throw new Error("TURN_URLS must contain valid turn: or turns: URLs");
    }
    const username = `${Math.floor(now / 1000) + 3600}:${userId}`;
    iceServers.push({
      urls,
      username,
      credential: createHmac("sha1", secret).update(username).digest("base64"),
    });
  }
  return iceServers;
}