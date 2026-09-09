import { bucketRow, findTableHeader, groupIntoRows, parseCurrencyCell, type PdfTextItem } from "@/lib/pdfTable";
import type { NormalizedBrokerTransaction } from "../types";

/**
 * Parses Revolut's "Profit and Loss Statement" PDF — the only source of
 * realized P&L (already FIFO-matched by Revolut itself, including a single
 * sell order split across multiple buy lots with fees prorated by
 * quantity, verified in the forensic review's CVX example) and the only
 * source of dividend gross/withholding/net split in each dividend's
 * original currency (the CSV equivalent converts everything to EUR,
 * discarding the original USD gross amounts).
 *
 * Two tables, each repeated once per currency book (USD, EUR), verified
 * against the real 8-page PDF:
 *
 *   Sells header: Date acquired | Date sold | Symbol | Security name | ISIN | Country | Quantity | Cost basis | Gross proceeds | Gross PnL | Fees
 *   Other income & fees header: Date | Description | Security name | ISIN | Country | Gross Amount | Withholding Tax | Net Amount
 *
 * Each logical row spans THREE physical lines in the Sells table (the
 * primary own-currency row, an EUR-converted row, and a "Rate:" line) and
 * TWO in Other income & fees (primary + EUR-converted) — only the primary
 * row (identified by a real "Date acquired"/"Date" cell) is parsed; the
 * secondary conversion lines are redundant with WealthOS's own FX system
 * and are skipped, never double-counted.
 */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISIN_PATTERN = /^[A-Z]{2}[A-Z0-9]{9}\d$/;

function parseSellsTables(rows: ReturnType<typeof groupIntoRows>, fileName: string): NormalizedBrokerTransaction[] {
  const results: NormalizedBrokerTransaction[] = [];
  let searchFrom = 0;

  for (;;) {
    const header = findTableHeader(
      rows,
      ["Date acquired", "Date sold", "Symbol", "Security name", "ISIN", "Country", "Quantity", "Cost basis", "Gross proceeds", "Gross PnL", "Fees"],
      searchFrom
    );
    if (!header) break;

    let i = header.headerIndex + 1;
    for (; i < rows.length; i++) {
      const bucketed = bucketRow(rows[i]!, header.columns);
      const dateAcquired = (bucketed["Date acquired"] ?? "").trim();
      const dateSold = (bucketed["Date sold"] ?? "").trim();
      if (!dateAcquired) continue; // No cell landed in this column at all — the EUR-converted secondary line or the "Rate:" line, both skipped (redundant with WealthOS's own FX system).
      if (!ISO_DATE_PATTERN.test(dateAcquired)) break; // Non-empty but not a date — the table's "Total" row, a genuine end.
      if (!ISO_DATE_PATTERN.test(dateSold)) continue; // Defensive — should never happen when Date acquired matched.

      const costBasis = parseCurrencyCell(bucketed["Cost basis"] ?? "");
      const grossProceeds = parseCurrencyCell(bucketed["Gross proceeds"] ?? "");
      const grossPnl = parseCurrencyCell(bucketed["Gross PnL"] ?? "");
      const fees = parseCurrencyCell(bucketed.Fees ?? "");
      const isin = (bucketed.ISIN ?? "").trim();
      const quantityRaw = (bucketed.Quantity ?? "").trim();
      const quantity = Number(quantityRaw);

      results.push({
        timestamp: dateSold,
        timestampPrecision: "dateOnly",
        type: "sell",
        ticker: (bucketed.Symbol ?? "").trim() || null,
        isin: ISIN_PATTERN.test(isin) ? isin : null,
        securityName: (bucketed["Security name"] ?? "").trim() || null,
        quantity: Number.isFinite(quantity) ? quantity : null,
        priceMinor: null,
        currency: grossProceeds?.currency ?? costBasis?.currency ?? "USD",
        grossAmountMinor: grossProceeds?.minor ?? null,
        netAmountMinor: null,
        feesMinor: fees?.minor ?? null,
        commissionMinor: null,
        withholdingTaxMinor: null,
        // Revolut's own FIFO engine already computed this, including
        // prorating fees across multiple closed lots when one sell order
        // closes more than one buy lot — never recomputed by WealthOS.
        realizedPnlMinor: grossPnl?.minor ?? null,
        costBasisMinor: costBasis?.minor ?? null,
        costBasisKnown: true,
        pnlSource: "broker-reported",
        fxRateAtTransaction: null,
        broker: "revolut",
        sourceFile: fileName,
        sourceRowRef: `sells row: acquired ${bucketed["Date acquired"]}, sold ${dateSold}, ${bucketed.Symbol}`,
      });
    }
    searchFrom = i;
  }

  return results;
}

function parseDividendTables(rows: ReturnType<typeof groupIntoRows>, fileName: string): NormalizedBrokerTransaction[] {
  const results: NormalizedBrokerTransaction[] = [];
  let searchFrom = 0;

  for (;;) {
    const header = findTableHeader(
      rows,
      ["Date", "Description", "Security name", "ISIN", "Country", "Gross Amount", "Withholding Tax", "Net Amount"],
      searchFrom
    );
    if (!header) break;

    let i = header.headerIndex + 1;
    for (; i < rows.length; i++) {
      const bucketed = bucketRow(rows[i]!, header.columns);
      const date = (bucketed.Date ?? "").trim();
      if (!date) continue; // The EUR-converted secondary line or "Rate:" line — no cell landed in this column, skip and keep looking.
      if (!ISO_DATE_PATTERN.test(date)) break; // Non-empty but not a date — the table's "Total" row, a genuine end.

      const gross = parseCurrencyCell(bucketed["Gross Amount"] ?? "");
      const withholding = parseCurrencyCell(bucketed["Withholding Tax"] ?? "");
      const net = parseCurrencyCell(bucketed["Net Amount"] ?? "");
      const isin = (bucketed.ISIN ?? "").trim();

      results.push({
        timestamp: date,
        timestampPrecision: "dateOnly",
        type: "dividend",
        ticker: (bucketed.Description ?? "").trim() || null, // This column literally holds the ticker (e.g. "TXN"), not free text — verified against the real PDF.
        isin: ISIN_PATTERN.test(isin) ? isin : null,
        securityName: (bucketed["Security name"] ?? "").trim() || null,
        quantity: null,
        priceMinor: null,
        currency: gross?.currency ?? net?.currency ?? "USD",
        grossAmountMinor: gross?.minor ?? null,
        netAmountMinor: net?.minor ?? null,
        feesMinor: null,
        commissionMinor: null,
        withholdingTaxMinor: withholding?.minor ?? null,
        realizedPnlMinor: null,
        costBasisMinor: null,
        pnlSource: null,
        fxRateAtTransaction: null,
        broker: "revolut",
        sourceFile: fileName,
        sourceRowRef: `dividend row: ${date}, ${bucketed.Description}`,
      });
    }
    searchFrom = i;
  }

  return results;
}

export function parseRevolutPnlStatementPdf(pages: PdfTextItem[][], fileName: string): NormalizedBrokerTransaction[] {
  const allRows = pages.flatMap((page) => groupIntoRows(page));
  return [...parseSellsTables(allRows, fileName), ...parseDividendTables(allRows, fileName)];
}
