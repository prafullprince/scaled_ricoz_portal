import type { RevenueStreamInput } from "../../../services/finance-forecast.service";

export interface RevenueImportIssue {
  sheet: string;
  row: number | null;
  message: string;
}

export interface RevenueImportPreview {
  streams: RevenueStreamInput[];
  issues: RevenueImportIssue[];
  sheets: string[];
  rowsRead: number;
}

export interface RevenueImportSheet {
  sheet: string;
  data: readonly (readonly unknown[])[];
}

type RevenueField =
  | "streamId"
  | "name"
  | "description"
  | "unitRevenue"
  | "baseUnits"
  | "marginPercent"
  | "growthType"
  | "growthMultiplier"
  | "color"
  | "startMonth"
  | "endMonth";

const monthNames = ["apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "jan", "feb", "mar"];
const streamColors = ["#3478F6", "#14B88A", "#ED9A24", "#9759DB", "#E45873", "#12A9B8"];
const maxRevenueStreams = 1000;
const headerAliases: Record<RevenueField, readonly string[]> = {
  streamId: ["streamid", "id"],
  name: ["name", "stream", "revenuestream", "streamname"],
  description: ["description", "details"],
  unitRevenue: ["unitrevenue", "revenueperunit", "unitprice", "priceperunit"],
  baseUnits: ["baseunits", "units", "basequantity"],
  marginPercent: ["marginpercent", "grossmarginpercent", "grossmargin", "margin"],
  growthType: ["growthtype", "growth"],
  growthMultiplier: ["growthmultiplier", "monthlymultiplier", "multiplier"],
  color: ["color", "colour"],
  startMonth: ["startmonth", "frommonth", "activemonthstart"],
  endMonth: ["endmonth", "tomonth", "activemonthend"],
};

function cellText(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeHeader(value: unknown) {
  return cellText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseNumber(value: unknown, field: string, allowMultiplierSuffix = false): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = cellText(value);
  if (!text) throw new Error(`${field} is required.`);
  const numberText = allowMultiplierSuffix ? text.replace(/[x×]\s*$/i, "") : text;
  const normalized = numberText
    .replace(/[₹$£€,]/g, "")
    .replace(/%/g, "")
    .replace(/\s/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`${field} must be a number.`);
  return parsed;
}

function parseMonth(value: unknown, field: string): number {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return (value.getUTCMonth() + 9) % 12;
  }
  const text = cellText(value);
  const parsed = Number(text);
  if (text && Number.isInteger(parsed) && parsed >= 0 && parsed <= 11) return parsed;
  const normalized = text.toLowerCase();
  const monthIndex = monthNames.findIndex((month) => normalized.startsWith(month));
  if (monthIndex >= 0) return monthIndex;
  throw new Error(`${field} must be a fiscal month name (Apr–Mar) or a zero-based month number (0–11).`);
}

function columnIndexes(headers: readonly unknown[]) {
  const indexFor = (field: RevenueField) =>
    headers.findIndex((header) => headerAliases[field].includes(normalizeHeader(header)));
  return {
    streamId: indexFor("streamId"),
    name: indexFor("name"),
    description: indexFor("description"),
    unitRevenue: indexFor("unitRevenue"),
    baseUnits: indexFor("baseUnits"),
    marginPercent: indexFor("marginPercent"),
    growthType: indexFor("growthType"),
    growthMultiplier: indexFor("growthMultiplier"),
    color: indexFor("color"),
    startMonth: indexFor("startMonth"),
    endMonth: indexFor("endMonth"),
  };
}

function getCell(row: readonly unknown[], indexes: Record<RevenueField, number>, field: RevenueField) {
  const index = indexes[field];
  return index < 0 ? "" : row[index];
}

function parseGrowth(
  typeValue: unknown,
  multiplierValue: unknown,
): { growthType: RevenueStreamInput["growthType"]; growthMultiplier: number } {
  const growthText = cellText(typeValue);
  const normalized = growthText.toLowerCase();
  const multiplierFromGrowth = growthText.match(/(\d+(?:\.\d+)?)\s*[x×]\s*$/i);
  const type = normalized === "fixed" || normalized.startsWith("fixed")
    ? "FIXED"
    : normalized.includes("multiplier") || multiplierFromGrowth
      ? "MULTIPLIER"
      : null;
  if (!type) throw new Error("Growth type must be Fixed or Multiplier (for example, 1.2x).");

  if (type === "FIXED") {
    return {
      growthType: type,
      growthMultiplier: cellText(multiplierValue)
        ? parseNumber(multiplierValue, "Growth multiplier", true)
        : 1,
    };
  }

  const multiplier = cellText(multiplierValue)
    ? parseNumber(multiplierValue, "Growth multiplier", true)
    : multiplierFromGrowth
      ? Number(multiplierFromGrowth[1])
      : Number.NaN;
  if (!Number.isFinite(multiplier)) {
    throw new Error("Growth multiplier is required for Multiplier growth.");
  }
  if (multiplier < 1 || multiplier > 10) {
    throw new Error("Growth multiplier must be between 1 and 10.");
  }
  return { growthType: type, growthMultiplier: multiplier };
}

function parseRevenueRow(
  row: readonly unknown[],
  indexes: Record<RevenueField, number>,
  colorIndex: number,
): RevenueStreamInput {
  const name = cellText(getCell(row, indexes, "name"));
  if (!name) throw new Error("Stream name is required.");
  if (name.length > 120) throw new Error("Stream name cannot exceed 120 characters.");

  const description = cellText(getCell(row, indexes, "description"));
  if (description.length > 2000) throw new Error("Description cannot exceed 2,000 characters.");

  const rawId = cellText(getCell(row, indexes, "streamId"));
  const streamId = rawId || globalThis.crypto.randomUUID();
  if (streamId.length > 80) throw new Error("Stream ID cannot exceed 80 characters.");

  const unitRevenue = parseNumber(getCell(row, indexes, "unitRevenue"), "Unit revenue");
  if (unitRevenue < 0 || unitRevenue > 1_000_000_000_000) {
    throw new Error("Unit revenue must be between 0 and 1,000,000,000,000.");
  }

  const baseUnits = parseNumber(getCell(row, indexes, "baseUnits"), "Base units");
  if (baseUnits < 0 || baseUnits > 1_000_000_000) {
    throw new Error("Base units must be between 0 and 1,000,000,000.");
  }

  const rawMargin = getCell(row, indexes, "marginPercent");
  const parsedMargin = parseNumber(rawMargin, "Gross margin (%)");
  const marginPercent = typeof rawMargin === "number" && parsedMargin > 0 && parsedMargin <= 1
    ? parsedMargin * 100
    : parsedMargin;
  if (marginPercent < 0 || marginPercent > 100) {
    throw new Error("Gross margin must be between 0 and 100.");
  }

  const growth = parseGrowth(
    getCell(row, indexes, "growthType"),
    getCell(row, indexes, "growthMultiplier"),
  );
  const startMonth = parseMonth(getCell(row, indexes, "startMonth"), "Start month");
  const endMonth = parseMonth(getCell(row, indexes, "endMonth"), "End month");
  if (endMonth < startMonth) throw new Error("End month must be on or after the start month.");

  const rawColor = cellText(getCell(row, indexes, "color"));
  const color = rawColor || streamColors[colorIndex % streamColors.length];
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error("Color must be a six-digit hex value such as #3478F6.");

  return {
    streamId,
    name,
    description,
    unitRevenue,
    baseUnits,
    marginPercent,
    ...growth,
    color,
    startMonth,
    endMonth,
  };
}

export function parseRevenueSheets(
  sheets: readonly RevenueImportSheet[],
  existingStreams: readonly RevenueStreamInput[],
): RevenueImportPreview {
  const preview: RevenueImportPreview = { streams: [], issues: [], sheets: [], rowsRead: 0 };
  const streamIds = new Set(existingStreams.map((stream) => stream.streamId));
  const requiredFields: RevenueField[] = [
    "name", "unitRevenue", "baseUnits", "marginPercent", "growthType", "startMonth", "endMonth",
  ];

  for (const sheet of sheets) {
    const rows = sheet.data;
    if (!rows.some((row) => row.some((cell) => cellText(cell)))) continue;
    const headerRow = rows[0] ?? [];
    const indexes = columnIndexes(headerRow);
    const missing = requiredFields.filter((field) => indexes[field] < 0);
    if (missing.length) {
      preview.issues.push({
        sheet: sheet.sheet,
        row: 1,
        message: `Missing required columns: ${missing.map((field) => headerAliases[field][0]).join(", ")}.`,
      });
      continue;
    }

    preview.sheets.push(sheet.sheet);
    for (const [index, row] of rows.entries()) {
      if (index === 0 || !row.some((cell) => cellText(cell))) continue;
      preview.rowsRead += 1;
      try {
        const stream = parseRevenueRow(row, indexes, preview.streams.length);
        if (streamIds.has(stream.streamId)) {
          throw new Error(`Stream ID "${stream.streamId}" already exists in this forecast or workbook.`);
        }
        streamIds.add(stream.streamId);
        preview.streams.push(stream);
      } catch (error) {
        preview.issues.push({
          sheet: sheet.sheet,
          row: index + 1,
          message: error instanceof Error ? error.message : "This row contains invalid revenue stream data.",
        });
      }
    }
  }

  if (!preview.rowsRead) {
    preview.issues.push({
      sheet: "Workbook",
      row: null,
      message: "No revenue stream rows were found. Add rows below the header row.",
    });
  }
  if (existingStreams.length + preview.streams.length > maxRevenueStreams) {
    preview.issues.push({
      sheet: "Workbook",
      row: null,
      message: `A forecast can contain at most ${maxRevenueStreams.toLocaleString("en-IN")} revenue streams. Remove rows or existing streams before importing.`,
    });
  }
  return preview;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("The CSV file has an unterminated quoted field.");
  if (field || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }
  return rows;
}

export function parseRevenueCsv(
  text: string,
  fileName: string,
  existingStreams: readonly RevenueStreamInput[],
) {
  return parseRevenueSheets([{ sheet: fileName, data: parseCsv(text) }], existingStreams);
}

export async function parseRevenueWorkbook(
  file: File,
  existingStreams: readonly RevenueStreamInput[],
): Promise<RevenueImportPreview> {
  if (!file.size) throw new Error("The selected file is empty.");
  if (file.size > 10 * 1024 * 1024) throw new Error("The selected file exceeds the 10 MB import limit.");

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") {
    return parseRevenueCsv(await file.text(), file.name, existingStreams);
  }
  if (extension !== "xlsx") {
    throw new Error("Choose an .xlsx workbook or a .csv file. Save legacy .xls workbooks as .xlsx first.");
  }

  try {
    const readXlsxFile = (await import("read-excel-file/browser")).default;
    const workbookSheets = await readXlsxFile(file);
    return parseRevenueSheets(
      workbookSheets.map(({ sheet, data }) => ({ sheet, data })),
      existingStreams,
    );
  } catch {
    throw new Error("Could not read this workbook. Check that it is a valid .xlsx file and try again.");
  }
}

export function downloadRevenueImportTemplate() {
  const headers = [
    "streamId",
    "name",
    "description",
    "unitRevenue",
    "baseUnits",
    "marginPercent",
    "growthType",
    "growthMultiplier",
    "color",
    "startMonth",
    "endMonth",
  ];
  const content = `${headers.join(",")}\r\n`;
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "revenue-stream-import-template.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
