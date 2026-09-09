import type { NormalizedBrokerTransaction } from "../types";

/** "USD 210.82" -> { currency: "USD", minor: 21082 }. Returns null for an empty/missing field (dividend/cash rows have no per-share price). */
export function parseCompoundAmount(field: string): { currency: string; minor: number } | null {
  const trimmed = field.trim();
  if (!trimmed) return null;
  const match = /^([A-Z]{3})\s*(-?[\d,]+(?:\.\d+)?)$/.exec(trimmed);
  if (!match) return null;
  const [, currency, numberPart] = match;
  const amount = Number(numberPart!.replace(/,/g, ""));
  if (!Number.isFinite(amount)) return null;
  return { currency: currency!, minor: Math.round(amount * 100) };
}

export interface AccountStatementFields {
  date: string;
  ticker: string;
  type: string;
  quantity: string;
  pricePerShare: string;
  totalAmount: string;
  currency: string;
  fxRate: string;
}

/**
 * Shared row→NormalizedBrokerTransaction mapping for Revolut's account
 * statement, used by both the CSV parser (features/brokerImport/revolut/
 * parseAccountStatementCsv.ts) and the XLSX parser
 * (parseAccountStatementXlsx.ts) — both formats carry the identical eight
 * columns (Date, Ticker, Type, Quantity, Price per share, Total Amount,
 * Currency, FX Rate), just in a different file container, so the row logic
 * itself — including every quirk proven against the real CSV export during
 * the forensic review (Total Amount ≠ pure execution value, no ISIN ever
 * present, cash rows skipped) — needs writing and testing only once.
 */
export type MappedAccountStatementRow =
  | { kind: "transaction"; row: NormalizedBrokerTransaction }
  | { kind: "skipped-cash" }
  | { kind: "skipped-unrecognized-type" };

export function mapAccountStatementFields(
  fields: AccountStatementFields,
  sourceRowRef: string,
  fileName: string,
  timestampPrecision: "exact" | "dateOnly"
): MappedAccountStatementRow {
  const rawType = fields.type.trim().toUpperCase();
  const ticker = fields.ticker.trim() || null;

  if (rawType === "CASH TOP-UP" || rawType === "CASH WITHDRAWAL" || !ticker) {
    return { kind: "skipped-cash" };
  }

  const type = rawType === "BUY - MARKET" ? "buy" : rawType === "SELL - MARKET" ? "sell" : rawType === "DIVIDEND" ? "dividend" : null;
  if (!type) return { kind: "skipped-unrecognized-type" }; // Unrecognized type — never silently misclassified as buy/sell.

  const quantityRaw = fields.quantity.trim();
  const quantity = quantityRaw ? Number(quantityRaw) : null;
  const price = parseCompoundAmount(fields.pricePerShare);
  const total = parseCompoundAmount(fields.totalAmount);
  const fxRateRaw = fields.fxRate.trim();
  const fxRate = fxRateRaw ? Number(fxRateRaw) : null;
  const currency = fields.currency.trim();

  // Dividends: this ledger only ever reports the net (post-withholding)
  // amount — grossAmountMinor stays null, never Total Amount's net figure,
  // so ledger-vs-pnl-statement dividend rows stay distinguishable by "does
  // grossAmountMinor exist" (see revolut/adapter.ts's isPnlDividend).
  const grossAmountMinor = type === "dividend" ? null : quantity !== null && price !== null ? Math.round(price.minor * quantity) : total?.minor ?? null;

  const row: NormalizedBrokerTransaction = {
    timestamp: fields.date.trim(),
    timestampPrecision,
    type,
    ticker,
    isin: null,
    securityName: null,
    quantity: quantity !== null && Number.isFinite(quantity) ? quantity : null,
    priceMinor: price?.minor ?? null,
    currency: currency || price?.currency || total?.currency || "EUR",
    grossAmountMinor,
    netAmountMinor: total?.minor ?? null,
    feesMinor: null,
    commissionMinor: null,
    withholdingTaxMinor: null,
    realizedPnlMinor: null,
    costBasisMinor: null,
    costBasisKnown: undefined,
    pnlSource: null,
    fxRateAtTransaction: fxRate !== null && Number.isFinite(fxRate) ? fxRate : null,
    broker: "revolut",
    sourceFile: fileName,
    sourceRowRef,
  };
  return { kind: "transaction", row };
}
