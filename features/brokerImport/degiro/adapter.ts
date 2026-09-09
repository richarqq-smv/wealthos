import type { BrokerAdapter, BrokerCapabilities, FileTypeMatch, NormalizedBrokerTransaction, PickedFile } from "../types";
import { parseDegiroTransactionsCsv } from "./parseTransactionsCsv";

/**
 * FOUNDATION ONLY — no real DEGIRO export file has been available to test
 * against (see the forensic review §18/§24). Every claim below is
 * classified explicitly:
 *
 *   CONFIRMED — verified against DEGIRO's own help pages
 *   (degiro.com/uk/helpdesk): DEGIRO offers five report types (Account
 *   Statement, Transaction Statement, Portfolio Overview, Annual
 *   Statements, Cash Account Statements), each downloadable as CSV/Excel/
 *   PDF from the web app's Inbox.
 *
 *   CONFIRMED, independently, by multiple sources (including the
 *   open-source degiro-bookkeeper project): DEGIRO does NOT ship a
 *   pre-computed realized-P&L/cost-basis figure the way Revolut does —
 *   callers must compute FIFO themselves from the raw transaction +
 *   account-statement data. This is the one finding this adapter's
 *   `capabilities` actually encodes and relies on.
 *
 *   UNKNOWN / NEEDS VERIFICATION — everything else, including: exact CSV
 *   column names/order, whether ISIN is on every row or only some, corporate
 *   action representation, exact currency/date formatting. `parseTransactionsCsv.ts`
 *   documents its specific assumptions and is explicitly marked as needing a
 *   real fixture before being trusted.
 */
export const DEGIRO_CAPABILITIES: BrokerCapabilities = {
  providesRealizedPnl: false, // CONFIRMED — see module doc above. confirmImport.ts routes every DEGIRO sell through the shared FIFO fallback (features/brokerImport/fifoFallback.ts) whenever this flag is false, and marks the result pnlSource: "wealthos-calculated" — never a broker-reported figure.
  providesCostBasis: false,
  providesFifoLotAllocation: false,
  providesHistoricalFx: false, // UNKNOWN — not confirmed either way.
  providesDividends: true, // CONFIRMED — the Account Statement is documented to include dividends.
  providesFees: false, // UNKNOWN — community sources suggest fees are embedded in a free-text description column, not a dedicated numeric column; not confirmed.
  providesIsin: true, // CONFIRMED by community sources (not DEGIRO's own docs) — Account Statement carries ISIN, not ticker.
};

function detectFiles(files: PickedFile[]): FileTypeMatch[] {
  return files.map((file) => {
    // UNKNOWN / NEEDS VERIFICATION: real DEGIRO column headers. This
    // heuristic (Dutch "Datum"/"ISIN" columns) is a best-effort guess based
    // on community-reported column names, not a confirmed signature.
    if (file.encoding === "utf8" && /datum.*product.*isin/i.test(file.content.slice(0, 300).replace(/\s+/g, " "))) {
      return { file, kind: "transactionsCsv", detectedBy: "content" as const };
    }
    return { file, kind: "unknown", detectedBy: "filename-fallback" as const };
  });
}

async function parse(matches: FileTypeMatch[]): Promise<NormalizedBrokerTransaction[][]> {
  return matches.map((match) => (match.kind === "transactionsCsv" ? parseDegiroTransactionsCsv(match.file.content, match.file.name) : []));
}

function reconcile(byFile: NormalizedBrokerTransaction[][]): { rows: NormalizedBrokerTransaction[]; warnings: string[] } {
  // No cross-file reconciliation logic exists yet — DEGIRO's actual set of
  // exportable files and how they'd need to be merged is unconfirmed (see
  // module doc). Until real fixtures are available, each file's rows pass
  // through unmerged rather than guessing at a merge strategy.
  return {
    rows: byFile.flat(),
    warnings: byFile.length > 1 ? ["DEGIRO: cross-file reconciliation is not yet implemented — rows from multiple files are not merged, only concatenated. NEEDS REAL DEGIRO FIXTURE."] : [],
  };
}

export const DegiroAdapter: BrokerAdapter = {
  brokerId: "degiro",
  displayName: "DEGIRO",
  capabilities: DEGIRO_CAPABILITIES,
  detectFiles,
  parse,
  reconcile,
};
