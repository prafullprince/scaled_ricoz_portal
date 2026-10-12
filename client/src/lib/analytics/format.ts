const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Backend returns numeric strings (e.g. "2400000.00") — never display them as raw strings. */
export function formatCurrency(value: string | number | null | undefined, currency = "INR"): string {
  if (value === null || value === undefined) return "Not available";
  const numeric = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(numeric)) return "Not available";
  if (currency === "INR") return inrFormatter.format(numeric);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(numeric);
}

export function formatPercent(value: number | null | undefined, fractionDigits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "Not available";
  const trimmed = Number(value.toFixed(fractionDigits));
  return `${trimmed}%`;
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "Not available";
  return new Intl.NumberFormat("en-IN").format(value);
}

export function formatDays(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "Not available";
  return `${Number(value.toFixed(1))} days`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
}

/** Never assume increase == good or decrease == bad — only render direction. */
export function changeDirection(changeType: string | null | undefined): "up" | "down" | "flat" {
  if (changeType === "increase") return "up";
  if (changeType === "decrease") return "down";
  return "flat";
}
