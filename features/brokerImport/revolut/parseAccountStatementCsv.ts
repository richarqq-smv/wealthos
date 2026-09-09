import type { NormalizedBrokerTransaction } from "../types";
import { mapAccountStatementFields } from "./mapAccountStatementRow";

/**
 * Parses Revolut's "Trading Account Statement" CSV export — the raw
 * transaction ledger. Column structure and every quirk below were verified
 * against a real 113-row export during the forensic review; nothing here is
 * guessed:
 *
 *   Date,Ticker,Type,Quantity,Price per share,Total Amount,Currency,FX Rate
 *
 * - `Date` is ISO-8601 UTC with WILDLY varying fractional-second precision
 *   (microseconds down to none at all) — this is deliberately kept as the
 *   authoritative timestamp source for dedup (see fingerprint.ts), because
 *   two real transactions in the reference dataset share the same *second*
 *   and are only distinguishable at millisecond precision here.
 * - `Ticker` is empty for CASH TOP-UP / CASH WITHDRAWAL rows (no
 *   instrument) — this parser skips those rows entirely; Revolut's
 *   cash-only movements are a different domain already covered by the
 *   existing `features/revolutImport` bank-CSV importer, not this one.
 * - `Type` values seen: "CASH TOP-UP", "CASH WITHDRAWAL", "BUY - MARKET",
 *   "SELL - MARKET", "DIVIDEND". No corporate-action type has EVER been
 *   observed in this CSV — the one real corporate action in the reference
 *   dataset (a TKMS spin-off from thyssenkrupp) appeared ONLY in the
 *   account-statement PDF, never here. That is why this parser alone is
 *   never sufficient for a complete import (see the Revolut adapter's
 *   `capabilities` and the forensic review §3/§12).
 * - Row-level value semantics (Total Amount vs. pure execution value, etc.)
 *   are documented once in mapAccountStatementRow.ts, shared with the XLSX
 *   parser for the same report.
 */

const KNOWN_HEADER = ["date", "ticker", "type", "quantity", "price per share", "total amount", "currency", "fx rate"];

export interface ParsedCsvResult {
  ok: true;
  rows: NormalizedBrokerTransaction[];
  skippedCashRows: number;
}
export interface ParsedCsvError {
  ok: false;
  reason: "empty" | "unrecognized-columns";
}

/** Minimal CSV line splitter — Revolut's export never quotes fields (no commas ever appear inside a value in this format), but a defensive quote-aware split costs nothing and protects against a future export format change. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

export function parseRevolutAccountStatementCsv(text: string, fileName: string): ParsedCsvResult | ParsedCsvError {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return { ok: false, reason: "empty" };

  const header = splitCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
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

  const rows: NormalizedBrokerTransaction[] = [];
  let skippedCashRows = 0;

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
    const fields = splitCsvLine(lines[lineIndex]!);
    const mapped = mapAccountStatementFields(
      {
        date: fields[iDate] ?? "",
        ticker: fields[iTicker] ?? "",
        type: fields[iType] ?? "",
        quantity: fields[iQuantity] ?? "",
        pricePerShare: fields[iPrice] ?? "",
        totalAmount: fields[iTotal] ?? "",
        currency: fields[iCurrency] ?? "",
        fxRate: fields[iFxRate] ?? "",
      },
      `line ${lineIndex + 1}`,
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
