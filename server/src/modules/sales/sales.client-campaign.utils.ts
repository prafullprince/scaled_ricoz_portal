const emailOptOutKeys = new Set(["emailoptout", "unsubscribedmode"]);
const whatsappOptOutKeys = new Set(["whatsappoptout", "unsubscribedmode"]);

function normalizedKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isSalesClientEmailOptedOut(lead: {
  externalPayload?: Record<string, unknown>;
  filterOverrides?: Record<string, string>;
}) {
  const values = Object.entries({ ...lead.externalPayload, ...lead.filterOverrides })
    .filter(([key]) => emailOptOutKeys.has(normalizedKey(key)))
    .map(([, value]) => String(value ?? "").trim().toLowerCase());
  return values.some((value) => ["true", "yes", "y", "1", "unsubscribe", "unsubscribed"].includes(value)
    || value.includes("all")
    || value.includes("email"));
}

export function isSalesClientWhatsAppOptedOut(lead: {
  externalPayload?: Record<string, unknown>;
  filterOverrides?: Record<string, string>;
}) {
  const fields = Object.entries({ ...lead.externalPayload, ...lead.filterOverrides })
    .map(([key, value]) => [normalizedKey(key), String(value ?? "").trim().toLowerCase()] as const);
  return fields.some(([key, value]) => (
    (key === "whatsappoptout" && ["true", "yes", "y", "1"].includes(value))
    || (key === "whatsappoptin" && ["false", "no", "n", "0"].includes(value))
    || (key === "unsubscribedmode" && (value.includes("whatsapp") || value.includes("all")))
  ));
}

export function isValidSalesClientEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
