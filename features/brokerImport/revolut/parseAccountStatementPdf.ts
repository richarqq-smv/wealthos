import { bucketRow, findTableHeader, groupIntoRows, parseCurrencyCell, type PdfTextItem } from "@/lib/pdfTable";
import type { NormalizedBrokerTransaction } from "../types";

/**
 * Parses Revolut's "Trading Account Statement" PDF — the same underlying
 * events as the ledger CSV, but with two things the CSV structurally never
 * carries: per-transaction Fees/Commission, and the ONE corporate action in
 * the whole reference dataset (a TKMS spin-off from thyssenkrupp, `Type:
 * Spinoff`, present ONLY here — proven absent from the CSV during the
 * forensic review). This is why the CSV alone is never sufficient.
 *
 * Layout, verified against the real 7-page PDF (both the USD account's
 * pages and the EUR account's pages use the identical table shape, just at
 * slightly different column x-positions, which is why every table's
 * columns are re-derived from its own header row rather than hardcoded):
 *
 *   Transactions table header: Date | Symbol | Type | Quantity | Price | Side | Value | Fees | Commission
 *   Portfolio breakdown header: Symbol | Company | ISIN | Quantity | Price | Value | % of Portfolio
 *
 * Amount cells carry their own currency symbol (US$ or €), so currency is
 * read per-cell (via parseCurrencyCell), never assumed from which page
 * section we happen to be in.
 */

export interface CurrentHolding {
  ticker: string;
  isin: string;
  securityName: string;
  quantity: number;
  currency: string;
}

export interface AccountStatementPdfResult {
  transactions: NormalizedBrokerTransaction[];
  /** Used for ISIN-learning and as a cross-check against the reconstructed net BUY-minus-SELL quantity per ticker — never itself treated as a transaction. */
  currentHoldings: CurrentHolding[];
}

const DATE_ROW_PATTERN = /^\d{1,2}\s+\w+\s+\d{4}/;
const ISIN_PATTERN = /^[A-Z]{2}[A-Z0-9]{9}\d$/;

function parseTransactionsTables(rows: ReturnType<typeof groupIntoRows>, fileName: string): NormalizedBrokerTransaction[] {
  const results: NormalizedBrokerTransaction[] = [];
  let searchFrom = 0;

  for (;;) {
    const header = findTableHeader(rows, ["Date", "Symbol", "Type", "Quantity", "Price", "Side", "Value", "Fees", "Commission"], searchFrom);
    if (!header) break;

    let i = header.headerIndex + 1;
    for (; i < rows.length; i++) {
      const bucketed = bucketRow(rows[i]!, header.columns);
      if (!DATE_ROW_PATTERN.test(bucketed.Date ?? "")) break;

      const rawType = (bucketed.Type ?? "").trim();
      const ticker = (bucketed.Symbol ?? "").trim() || null;

      if (rawType.toLowerCase().startsWith("cash")) continue; // Cash top-up / withdrawal — not an instrument transaction.
      if (!ticker) continue;

      const value = parseCurrencyCell(bucketed.Value ?? "");
      const fees = parseCurrencyCell(bucketed.Fees ?? "");
      const commission = parseCurrencyCell(bucketed.Commission ?? "");
      const priceCell = parseCurrencyCell(bucketed.Price ?? "");
      const quantityRaw = (bucketed.Quantity ?? "").trim();
      const quantity = quantityRaw ? Number(quantityRaw) : null;
      const side = (bucketed.Side ?? "").trim().toLowerCase();

      let type: NormalizedBrokerTransaction["type"] | null = null;
      let costBasisKnown: boolean | undefined;
      if (rawType === "Trade - Market") {
        type = side === "buy" ? "buy" : side === "sell" ? "sell" : null;
      } else if (rawType === "Dividend") {
        type = "dividend";
      } else if (rawType === "Spinoff") {
        // Revolut's own glossary calls a spin-off an "Unprocessed Position"
        // with no automatically-determined cost basis. €0 is what's printed
        // here, but that's a placeholder, not a real acquisition cost — the
        // explicit false is what stops it from ever being silently treated
        // as a real €0 cost basis downstream.
        type = "corporate_action";
        costBasisKnown = false;
      }
      if (!type) continue;

      results.push({
        timestamp: (bucketed.Date ?? "").trim(),
        timestampPrecision: "dateOnly", // The PDF only prints "21 Mar 2025 16:41:53 GMT" — second precision, not the CSV's fractional precision.
        type,
        ticker,
        isin: null,
        securityName: null,
        quantity: quantity !== null && Number.isFinite(quantity) ? quantity : null,
        priceMinor: priceCell?.minor ?? null,
        currency: value?.currency ?? priceCell?.currency ?? "EUR",
        // Dividends: this table only ever shows the net (post-withholding)
        // amount, same as the CSV — grossAmountMinor stays null here, never
        // the Value column's net figure, so ledger-vs-pnl-statement dividend
        // rows stay distinguishable by "does grossAmountMinor exist" (see
        // features/brokerImport/revolut/adapter.ts's isPnlDividend/isLedgerDividend).
        grossAmountMinor: type === "dividend" ? null : priceCell && quantity !== null ? Math.round(priceCell.minor * quantity) : value?.minor ?? null,
        netAmountMinor: value?.minor ?? null,
        feesMinor: fees?.minor ?? null,
        commissionMinor: commission?.minor ?? null,
        withholdingTaxMinor: null,
        realizedPnlMinor: null,
        costBasisMinor: null,
        costBasisKnown,
        pnlSource: null,
        fxRateAtTransaction: null,
        broker: "revolut",
        sourceFile: fileName,
        sourceRowRef: `pdf row starting "${bucketed.Date}"`,
      });
    }
    searchFrom = i;
  }

  return results;
}

function parsePortfolioBreakdownTables(rows: ReturnType<typeof groupIntoRows>): CurrentHolding[] {
  const holdings: CurrentHolding[] = [];
  let searchFrom = 0;

  for (;;) {
    const header = findTableHeader(rows, ["Symbol", "Company", "ISIN", "Quantity", "Price", "Value", "% of Portfolio"], searchFrom);
    if (!header) break;

    let i = header.headerIndex + 1;
    for (; i < rows.length; i++) {
      const bucketed = bucketRow(rows[i]!, header.columns);
      const isin = (bucketed.ISIN ?? "").trim();
      if (!ISIN_PATTERN.test(isin)) break; // Summary rows ("Positions Value", "Cash value", "Total") have no ISIN — natural stop.

      const value = parseCurrencyCell(bucketed.Value ?? "");
      const quantityRaw = (bucketed.Quantity ?? "").trim();
      const quantity = Number(quantityRaw);
      holdings.push({
        ticker: (bucketed.Symbol ?? "").trim(),
        isin,
        securityName: (bucketed.Company ?? "").trim(),
        quantity: Number.isFinite(quantity) ? quantity : 0,
        currency: value?.currency ?? "EUR",
      });
    }
    searchFrom = i;
  }

  return holdings;
}

export function parseRevolutAccountStatementPdf(pages: PdfTextItem[][], fileName: string): AccountStatementPdfResult {
  const allRows = pages.flatMap((page) => groupIntoRows(page));
  return {
    transactions: parseTransactionsTables(allRows, fileName),
    currentHoldings: parsePortfolioBreakdownTables(allRows),
  };
}
