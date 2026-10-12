const requiredProductionVariables = [
  "MONGO_URI",
  "REDIS_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "CLIENT_URL",
] as const;

export function validateEnvironment() {
  if (process.env.NODE_ENV !== "production") return;

  const missing = requiredProductionVariables.filter(
    (name) => !process.env[name]?.trim(),
  );
  if (missing.length) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(", ")}`,
    );
  }

  const port = Number(process.env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  for (const origin of process.env.CLIENT_URL!.split(",")) {
    const url = new URL(origin.trim());
    if (url.protocol !== "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      throw new Error(
        `Production CLIENT_URL origins must use HTTPS and cannot be localhost: ${origin.trim()}`,
      );
    }
  }
}