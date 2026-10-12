import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request } from "node:https";
import { ApiError } from "../../utils/apiError.utils.js";

function encryptionKey() {
  const value = process.env.INTEGRATIONS_ENCRYPTION_KEY ?? "";
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new ApiError(503, "Integrations require INTEGRATIONS_ENCRYPTION_KEY (64 hexadecimal characters)");
  return Buffer.from(value, "hex");
}
export function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), encrypted.toString("hex")].join(":");
}
export function decryptSecret(encrypted: string) {
  const [iv, tag, text] = encrypted.split(":");
  if (!iv || !tag || text === undefined) throw new ApiError(500, "Stored integration credential is invalid");
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "hex"));
  cipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([cipher.update(Buffer.from(text, "hex")), cipher.final()]).toString("utf8");
}

export function verifyWebhookSignature(secret: string, timestamp: string, signature: string, body: Buffer, now = Date.now()) {
  if (!/^\d{10}$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300 || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(timestamp).update(".").update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(address, prefix);

export function publicIPv4(address: string) {
  return isIP(address) === 4 && !blocked.check(address);
}
export function apiEndpoint(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new ApiError(400, "Enter a valid HTTPS API endpoint"); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || (url.port && url.port !== "443")) {
    throw new ApiError(400, "API endpoints must use HTTPS on port 443 without embedded credentials or fragments");
  }
  if (/^(localhost|.*\.localhost|.*\.local)$/i.test(url.hostname)) throw new ApiError(400, "Private API endpoints are not allowed");
  if (isIP(url.hostname) && !publicIPv4(url.hostname)) throw new ApiError(400, "Private API endpoints are not allowed");
  for (const key of url.searchParams.keys()) {
    if (/token|secret|password|api[-_]?key|authorization/i.test(key)) throw new ApiError(400, "Put API credentials in authentication headers, not the endpoint URL");
  }
  return url;
}

export async function fetchIntegrationJson(endpoint: string, headers: Record<string, string>): Promise<unknown> {
  const url = apiEndpoint(endpoint);
  const addresses = await lookup(url.hostname, { family: 4, all: true });
  if (!addresses.length || addresses.some(({ address }) => !publicIPv4(address))) throw new ApiError(400, "API endpoint must resolve only to public IPv4 addresses");
  const address = addresses[0]!.address;
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: "GET",
      family: 4,
      headers: { Accept: "application/json", ...headers },
      lookup: (_hostname, _options, callback) => callback(null, address, 4),
    }, (res) => {
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new ApiError(502, `Provider returned HTTP ${res.statusCode ?? "unknown"}. Redirects are not followed.`));
        return;
      }
      let size = 0;
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 2 * 1024 * 1024) req.destroy(new ApiError(413, "Provider response exceeds 2 MB"));
        else chunks.push(chunk);
      });
      res.on("error", () => reject(new ApiError(502, "Provider response was interrupted")));
      res.on("end", () => {
        if (size > 2 * 1024 * 1024) return;
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
        catch { reject(new ApiError(502, "Provider did not return valid JSON")); }
      });
    });
    const timer = setTimeout(() => req.destroy(new ApiError(504, "Provider request exceeded 20 seconds")), 20_000);
    req.on("close", () => clearTimeout(timer));
    req.on("error", (error) => reject(error instanceof ApiError ? error : new ApiError(502, "Provider connection failed; check endpoint and credentials")));
    req.end();
  });
}
