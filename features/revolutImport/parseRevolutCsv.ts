import { z } from "zod";

export interface ParsedRevolutRow {
  date: string;
  description: string;
  amountMinor: number;
  currency: string;
  rawType?: string;
}

export type RevolutParseResult =
  | { ok: true; rows: ParsedRevolutRow[]; skippedRowCount: number }
  | { ok: false; reason: "empty" | "unrecognized-columns" };

/**
 * Minimal RFC4180-style CSV parser: handles quoted fields (embedded commas,
 * newlines, and `""` as an escaped quote) without pulling in a dependency
 * for a format this constrained. No dependency on `\r\n` vs `\n`.
 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && (r[0] ?? "").trim() === ""));
}

const DATE_COLUMN_ALIASES = ["completed date", "started date", "date", "transaction date"];
const DESCRIPTION_COLUMN_ALIASES = ["description", "reference", "name"];
const AMOUNT_COLUMN_ALIASES = ["amount"];
const CURRENCY_COLUMN_ALIASES = ["currency"];
const TYPE_COLUMN_ALIASES = ["type"];

function findColumn(header: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const index = header.indexOf(alias);
    if (index !== -1) return index;
  }
  return -1;
}

/** Normalizes Revolut's common `"YYYY-MM-DD HH:mm:ss"` export format (and any other Date-parseable string) into a real ISO timestamp, or null if unparseable. */
function toIsoDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(trimmed) ? trimmed.replace(" ", "T") : trimmed;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toAmountMinor(raw: string): number | null {
  const cleaned = raw.trim().replace(/[,\s]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/**
 * Every field is re-validated here even though `parseRevolutCsv` already
 * skips rows it can't confidently parse — this is the Phase-13 boundary
 * check: no NaN/Infinity, a genuinely parseable date, no unexpected extra
 * fields smuggled onto the object (a CSV row is already a fixed shape, but
 * this keeps the contract explicit and matches how every other import path
 * in the app validates at its boundary).
 */
const parsedRevolutRowSchema = z.object({
  date: z
    .string()
    .min(1)
    .refine((value) => !Number.isNaN(new Date(value).getTime())),
  description: z.string().min(1),
  amountMinor: z.number().finite(),
  currency: z.string(),
  rawType: z.string().optional(),
});

/**
 * Tolerant of different real-world Revolut CSV export variants (older
 * exports use "Started Date", newer ones "Completed Date"; some omit
 * Currency) by matching column headers against known aliases rather than
 * fixed positions. If the header row doesn't contain a recognizable
 * date/description/amount column at all, the whole file is rejected
 * up front — never a partial, guessed import. Individual data rows that
 * fail to parse (a blank line, a malformed date) are skipped and counted,
 * not fatal to the rest of the file.
 */
export function parseRevolutCsv(text: string): RevolutParseResult {
  const rawRows = parseCsvRows(text);
  if (rawRows.length < 2) return { ok: false, reason: "empty" };

  const header = rawRows[0]!.map((cell) => cell.trim().toLowerCase());
  const dateIdx = findColumn(header, DATE_COLUMN_ALIASES);
  const descriptionIdx = findColumn(header, DESCRIPTION_COLUMN_ALIASES);
  const amountIdx = findColumn(header, AMOUNT_COLUMN_ALIASES);
  const currencyIdx = findColumn(header, CURRENCY_COLUMN_ALIASES);
  const typeIdx = findColumn(header, TYPE_COLUMN_ALIASES);

  if (dateIdx === -1 || descriptionIdx === -1 || amountIdx === -1) {
    return { ok: false, reason: "unrecognized-columns" };
  }

  const rows: ParsedRevolutRow[] = [];
  let skippedRowCount = 0;

  for (const rawRow of rawRows.slice(1)) {
    if (rawRow.every((cell) => cell.trim() === "")) continue;

    const isoDate = toIsoDate(rawRow[dateIdx] ?? "");
    const description = (rawRow[descriptionIdx] ?? "").trim();
    const amountMinor = toAmountMinor(rawRow[amountIdx] ?? "");
    const currency = currencyIdx >= 0 ? (rawRow[currencyIdx] ?? "").trim() : "";
    const rawType = typeIdx >= 0 ? (rawRow[typeIdx] ?? "").trim() : undefined;

    if (!isoDate || !description || amountMinor === null) {
      skippedRowCount++;
      continue;
    }

    const candidate = { date: isoDate, description, amountMinor, currency, rawType };
    const result = parsedRevolutRowSchema.safeParse(candidate);
    if (!result.success) {
      skippedRowCount++;
      continue;
    }
    rows.push(result.data);
  }

  return { ok: true, rows, skippedRowCount };
}

/** date + amount + description together, not currency (existing WealthOS transactions carry no currency field to compare against). Case/whitespace-insensitive on description so re-exporting the same CSV never double-imports. */
export function revolutRowFingerprint(row: { date: string; amountMinor: number; description: string }): string {
  return `${row.date}|${row.amountMinor}|${row.description.trim().toLowerCase()}`;
}
