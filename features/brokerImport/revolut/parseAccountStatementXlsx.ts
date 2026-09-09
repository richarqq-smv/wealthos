import * as XLSX from "xlsx";
import type { NormalizedBrokerTransaction } from "../types";
import { mapAccountStatementFields } from "./mapAccountStatementRow";

/**
 * Parses Revolut's "Trading Account Statement" Excel export. Revolut's own
 * web app offers "PDF" or "Excel" as the two Rekeningoverzicht download
 * formats — NOT "PDF" or "CSV" — confirmed from the real download-flow
 * screenshots this feature was built from, which is why this parser exists
 * alongside the CSV one rather than assuming CSV is always available.
 *
 * UNVERIFIED ASSUMPTION, stated plainly rather than hidden: this parser
 * assumes the .xlsx export contains the identical eight columns as the
 * proven CSV export (Date, Ticker, Type, Quantity, Price per share, Total
 * Amount, Currency, FX Rate) on the first sheet — a reasonable assumption
 * (same underlying data, different container format) but not one verified
 * against a real .xlsx file the way the CSV/PDF parsers were against real
 * exports. If a real Excel export ever fails to parse, that assumption is
 * exactly where to look first.
 */

const KNOWN_HEADER = ["date", "ticker", "type", "quantity", "price per share", "total amount", "currency", "fx rate"];

export interface ParsedXlsxResult {
  ok: true;
  rows: NormalizedBrokerTransaction[];
  skippedCashRows: number;
}
export interface ParsedXlsxError {
  ok: false;
  reason: "empty" | "unrecognized-columns" | "unreadable";
}

export function parseRevolutAccountStatementXlsx(bytes: Uint8Array, fileName: string): ParsedXlsxResult | ParsedXlsxError {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, { type: "array" });
  } catch {
    return { ok: false, reason: "unreadable" };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { ok: false, reason: "empty" };
  const sheet = workbook.Sheets[sheetName]!;
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
  if (grid.length < 2) return { ok: false, reason: "empty" };

  const header = (grid[0] as unknown[]).map((h) => String(h ?? "").trim().toLowerCase());
  const hasAllExpectedColumns = KNOWN_HEADER.every((expected) => header.includes(expected));
  if (!hasAllExpectedColumns) return { ok: false, reason: "unrecognized-columns" };

  const colIndex = (name: string) => header.indexOf(name);
  const iDate = colIndex("date");
  const iTicker = colIndex("ticker");
  const iType = colIndex("type");
  const iQuantity = colIndex("quantity");
  const iPrice = colIndex("price per share");
  const iTotal = colIndex("total amount");
  const iCurrency = colIndex("currency");
  const iFxRate = colIndex("fx rate");

  const cell = (row: unknown[], index: number): string => String(row[index] ?? "").trim();

  const rows: NormalizedBrokerTransaction[] = [];
  let skippedCashRows = 0;

  for (let rowIndex = 1; rowIndex < grid.length; rowIndex++) {
    const row = grid[rowIndex] as unknown[];
    if (!row || row.length === 0) continue;

    const mapped = mapAccountStatementFields(
      {
        date: cell(row, iDate),
        ticker: cell(row, iTicker),
        type: cell(row, iType),
        quantity: cell(row, iQuantity),
        pricePerShare: cell(row, iPrice),
        totalAmount: cell(row, iTotal),
        currency: cell(row, iCurrency),
        fxRate: cell(row, iFxRate),
      },
      `sheet row ${rowIndex + 1}`,
      fileName,
      "exact"
    );

    if (mapped.kind === "skipped-cash") {
      skippedCashRows++;
    } else if (mapped.kind === "transaction") {
      rows.push(mapped.row);
    }
  }

  return { ok: true, rows, skippedCashRows };
}
