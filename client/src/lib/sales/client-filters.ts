export type ClientFilterOperator =
  | "contains"
  | "does not contain"
  | "is"
  | "is not"
  | "starts with"
  | "ends with"
  | "greater than"
  | "less than"
  | "before"
  | "after"
  | "is empty"
  | "is not empty";

export type ClientFilter = { property: string; operator: ClientFilterOperator; value: string };

export const CLIENT_LIST_BULK_UPDATE_FIELDS = [
  "Client Name",
  "Company Name",
  "Phone",
  "Email",
  "Lead Source",
  "Notes",
  "Service Interest",
  "Ref",
  "Email Opt Out",
  "Full address",
  "Company address",
  "Feedback 1",
  "Feedback 2",
  "Feedback 3",
  "Alternative Mob Number",
  "Team Leader call feedback",
  "Unsubscribed Mode",
  "Unsubscribed Time",
] as const;

export const CLIENT_FILTER_PROPERTIES = [
  "Touched Records",
  "Untouched Records",
  "Record Action",
  "Related Record Action",
  "Activities",
  "Notes",
  "Pipelines",
  "Pipeline Sub-Pipeline",
  "Pipeline Amount",
  "Pipeline Stage",
  "Pipeline Closing Date",
  "Pipeline Record Owner",
  "Alternative Mob Number",
  "Client Name",
  "Client Owner",
  "Company Name",
  "Company address",
  "Created By",
  "Created Time",
  "Description",
  "Email",
  "Email Opt Out",
  "Feedback 1",
  "Feedback 2",
  "Feedback 3",
  "First Name",
  "Full address",
  "Last Activity Time",
  "Last Name",
  "Lead Source",
  "Modified By",
  "Modified Time",
  "Phone",
  "Ref",
  "Team Leader call feedback",
  "Unsubscribed Mode",
  "Unsubscribed Time",
] as const;

export function clientFilterKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function clientFilterKind(property: string) {
  if (property === "Touched Records" || property === "Untouched Records") return "boolean";
  if (property === "Pipeline Amount") return "number";
  if (["Pipeline Closing Date", "Created Time", "Last Activity Time", "Modified Time", "Unsubscribed Time"].includes(property)) return "date";
  return "text";
}

export function clientFilterOperators(property: string): ClientFilterOperator[] {
  const kind = clientFilterKind(property);
  if (kind === "boolean") return ["is", "is not"];
  if (kind === "number") return ["is", "is not", "greater than", "less than", "is empty", "is not empty"];
  if (kind === "date") return ["is", "is not", "before", "after", "is empty", "is not empty"];
  return ["contains", "does not contain", "is", "is not", "starts with", "ends with", "is empty", "is not empty"];
}

export function matchesClientFilter(
  lead: {
    name: string;
    company?: string;
    email?: string;
    phone: string;
    filterValues?: Record<string, string | number | boolean>;
  },
  filter: ClientFilter,
) {
  const key = clientFilterKey(filter.property);
  const fallback = filter.property === "Client Name" ? lead.name
    : filter.property === "Company Name" ? lead.company ?? ""
      : filter.property === "Email" ? lead.email ?? ""
        : filter.property === "Phone" ? lead.phone : "";
  const actualValue = lead.filterValues?.[key] ?? fallback;
  const actualText = String(actualValue ?? "").trim();
  const expected = filter.value.trim();

  if (filter.operator === "is empty") return actualText.length === 0;
  if (filter.operator === "is not empty") return actualText.length > 0;

  if (clientFilterKind(filter.property) === "boolean") {
    const normalized = actualText.toLowerCase();
    const actual = actualValue === true || ["true", "yes", "1"].includes(normalized);
    const expectedBoolean = expected.toLowerCase() === "yes";
    return filter.operator === "is" ? actual === expectedBoolean : actual !== expectedBoolean;
  }

  if (clientFilterKind(filter.property) === "number") {
    const parseNumber = (value: string) => {
      const normalized = value.replace(/,/g, "").replace(/^[^\d.-]+|[^\d.-]+$/g, "");
      return normalized ? Number(normalized) : Number.NaN;
    };
    const actualNumber = typeof actualValue === "number" ? actualValue : parseNumber(actualText);
    const expectedNumber = parseNumber(expected);
    if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) return false;
    if (filter.operator === "greater than") return actualNumber > expectedNumber;
    if (filter.operator === "less than") return actualNumber < expectedNumber;
    if (filter.operator === "is not") return actualNumber !== expectedNumber;
    return actualNumber === expectedNumber;
  }

  if (clientFilterKind(filter.property) === "date") {
    const dateOnly = (value: string) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      const timestamp = Date.parse(value);
      return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : "";
    };
    const actualDay = dateOnly(actualText);
    const expectedDay = dateOnly(expected);
    if (!actualDay || !expectedDay) return false;
    if (filter.operator === "before") return actualDay < expectedDay;
    if (filter.operator === "after") return actualDay > expectedDay;
    if (filter.operator === "is not") return actualDay !== expectedDay;
    return actualDay === expectedDay;
  }

  const value = actualText.toLocaleLowerCase();
  const query = expected.toLocaleLowerCase();
  if (filter.operator === "is") return value === query;
  if (filter.operator === "is not") return value !== query;
  if (filter.operator === "starts with") return value.startsWith(query);
  if (filter.operator === "ends with") return value.endsWith(query);
  if (filter.operator === "does not contain") return !value.includes(query);
  return value.includes(query);
}
