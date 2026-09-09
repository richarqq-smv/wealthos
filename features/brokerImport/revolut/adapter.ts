import { reconcileRows } from "../reconcile";
import type { BrokerAdapter, BrokerCapabilities, FileTypeMatch, NormalizedBrokerTransaction, PickedFile } from "../types";
import { parseRevolutAccountStatementCsv } from "./parseAccountStatementCsv";
import { parseRevolutAccountStatementXlsx } from "./parseAccountStatementXlsx";
import { parseRevolutAccountStatementPdf, type CurrentHolding } from "./parseAccountStatementPdf";
import { parseRevolutPnlStatementPdf } from "./parsePnlStatementPdf";
import { extractPdfPages } from "@/lib/pdfExtract";

/** Proven end-to-end against a real 5-file export during the forensic review: Revolut ships its own FIFO-matched realized P&L (including correct fee proration across multiple closed lots), fees/commission, ISIN (on current holdings and closed lots), dividends split by original currency, and — via the account-statement PDF only — the one corporate-action type observed (a spin-off). */
export const REVOLUT_CAPABILITIES: BrokerCapabilities = {
  providesRealizedPnl: true,
  providesCostBasis: true,
  providesFifoLotAllocation: true,
  providesHistoricalFx: true, // Per-transaction FX Rate column in the ledger CSV.
  providesDividends: true,
  providesFees: true,
  providesIsin: true,
};

export type RevolutFileKind = "accountStatementCsv" | "accountStatementXlsx" | "accountStatementPdf" | "pnlStatementPdf" | "costsAndChargesPdf";

function looksLikePdf(file: PickedFile): boolean {
  if (file.encoding !== "base64") return false;
  // "%PDF" magic bytes, base64-encoded, always starts "JVBERi0" regardless of what follows.
  return file.content.startsWith("JVBERi0");
}

function looksLikeXlsx(file: PickedFile): boolean {
  // XLSX/ZIP magic bytes "PK\x03\x04" base64-encode to "UEsDB...".
  return file.encoding === "base64" && file.content.startsWith("UEsDB");
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function detectFiles(files: PickedFile[]): FileTypeMatch[] {
  return files.map((file) => {
    if (looksLikePdf(file)) {
      // Distinguishing which of the three PDF report types this is requires
      // reading its title text, which content-sniffing at this stage
      // (before any parsing) doesn't have — the engine resolves the exact
      // PDF kind during parse() itself (see parseByKind below), so "pdf" is
      // a provisional kind here, refined once the text is actually read.
      return { file, kind: "pdf" as RevolutFileKind, detectedBy: "content" as const };
    }
    if (looksLikeXlsx(file)) {
      return { file, kind: "accountStatementXlsx" as RevolutFileKind, detectedBy: "content" as const };
    }
    if (file.encoding === "utf8" && /date,ticker,type,quantity/i.test(file.content.slice(0, 200))) {
      return { file, kind: "accountStatementCsv" as RevolutFileKind, detectedBy: "content" as const };
    }
    return { file, kind: "unknown", detectedBy: "filename-fallback" as const };
  });
}

/** Resolves a provisional "pdf" match to its real report kind by reading the actual title text on page 1 — never trusting the filename. */
async function resolvePdfKind(match: FileTypeMatch): Promise<RevolutFileKind | "unknown"> {
  const pages = await extractPdfPages(decodeBase64ToBytes(match.file.content));
  const firstPageText = (pages[0] ?? []).map((i) => i.str).join(" ");
  if (/profit and loss statement/i.test(firstPageText)) return "pnlStatementPdf";
  if (/account statement/i.test(firstPageText)) return "accountStatementPdf";
  if (/costs and charges report/i.test(firstPageText)) return "costsAndChargesPdf";
  return "unknown";
}

async function parseFile(
  match: FileTypeMatch
): Promise<{ transactions: NormalizedBrokerTransaction[]; currentHoldings: CurrentHolding[]; ignoredReason?: string }> {
  const kind = match.kind === "pdf" ? await resolvePdfKind(match) : (match.kind as RevolutFileKind);

  switch (kind) {
    case "accountStatementCsv": {
      const result = parseRevolutAccountStatementCsv(match.file.content, match.file.name);
      return { transactions: result.ok ? result.rows : [], currentHoldings: [] };
    }
    case "accountStatementXlsx": {
      const result = parseRevolutAccountStatementXlsx(decodeBase64ToBytes(match.file.content), match.file.name);
      return { transactions: result.ok ? result.rows : [], currentHoldings: [] };
    }
    case "accountStatementPdf": {
      const pages = await extractPdfPages(decodeBase64ToBytes(match.file.content));
      const result = parseRevolutAccountStatementPdf(pages, match.file.name);
      return { transactions: result.transactions, currentHoldings: result.currentHoldings };
    }
    case "pnlStatementPdf": {
      const pages = await extractPdfPages(decodeBase64ToBytes(match.file.content));
      return { transactions: parseRevolutPnlStatementPdf(pages, match.file.name), currentHoldings: [] };
    }
    case "costsAndChargesPdf":
      // The annual costs report is a sanity-check-only source (see the
      // forensic review §8) — never a transaction source. Recognized
      // by content, so it's never flagged as an "unsupported file", but it
      // genuinely contributes nothing — surfaced as a preview warning
      // (via lastParsedIgnoredFiles below) so the user isn't left wondering
      // why a file they selected produced zero rows. Never silent.
      return {
        transactions: [],
        currentHoldings: [],
        ignoredReason: `${match.file.name}: het kosten- en lastenrapport wordt herkend maar niet gebruikt — kosten/commissie komen al uit het Rekeningoverzicht (PDF).`,
      };
    case "unknown":
    default:
      // An unrecognized file silently contributes nothing rather than being guessed at; engine.ts's own unsupportedFile warning covers this case.
      return { transactions: [], currentHoldings: [] };
  }
}

/**
 * Source-of-truth priority per field, exactly as established in the
 * forensic review's source-of-truth matrix (§3): the CSV/XLSX ledger wins
 * for timestamp precision (needed for dedup — see fingerprint.ts); the
 * account-statement PDF wins for fees/commission/ISIN and is the only
 * source of corporate actions; the pnl-statement PDF wins for realized
 * P&L/cost basis/dividend gross-withholding-net. Never CSV-always-wins.
 */
function pickField<K extends keyof NormalizedBrokerTransaction>(field: K, candidates: NormalizedBrokerTransaction[]): NormalizedBrokerTransaction[K] {
  const pnlRow = candidates.find((c) => c.pnlSource === "broker-reported");
  const pdfLedgerRow = candidates.find((c) => c.timestampPrecision === "dateOnly" && c.pnlSource === null && c.type !== "dividend");
  const preciseLedgerRow = candidates.find((c) => c.timestampPrecision === "exact");

  if (field === "timestamp" || field === "timestampPrecision") {
    return (preciseLedgerRow ?? candidates[0]!)[field];
  }
  if (field === "feesMinor" || field === "commissionMinor" || field === "isin") {
    const withValue = candidates.find((c) => c[field] !== null && c[field] !== undefined);
    return (withValue ?? candidates[0]!)[field];
  }
  if (field === "realizedPnlMinor" || field === "costBasisMinor" || field === "pnlSource" || field === "withholdingTaxMinor") {
    return (pnlRow ?? candidates[0]!)[field];
  }
  // Everything else: prefer whichever row actually carries a non-null value, precise-timestamp ledger first.
  const preferred = preciseLedgerRow ?? pdfLedgerRow ?? pnlRow ?? candidates[0]!;
  return preferred[field];
}

const isPnlSell = (r: NormalizedBrokerTransaction) => r.type === "sell" && r.pnlSource === "broker-reported";
const isLedgerSell = (r: NormalizedBrokerTransaction) => r.type === "sell" && r.pnlSource === null;
// pnl-statement dividend rows are the only source carrying a bruto (gross) figure; ledger dividend rows only ever carry the post-withholding net amount — see mapAccountStatementRow.ts / parsePnlStatementPdf.ts.
const isPnlDividend = (r: NormalizedBrokerTransaction) => r.type === "dividend" && r.grossAmountMinor !== null;
const isLedgerDividend = (r: NormalizedBrokerTransaction) => r.type === "dividend" && r.grossAmountMinor === null;

function sameDay(a: string, b: string): boolean {
  return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
}

/**
 * Sells and dividends get bespoke handling instead of the generic
 * quantity-matching joinKey (reconcile.ts's `reconcileRows`), because
 * Revolut's pnl-statement reports at a DIFFERENT granularity than the
 * ledger for sells: one ledger sell trade can close multiple FIFO lots
 * (proven with the real CVX case — one 0.18328475-share sell trade becomes
 * two pnl-statement lots of 0.0774921 and 0.10579265), so a naive
 * quantity-matching join either fails to merge them (leaving a redundant,
 * less-informative extra "sell" row from the ledger alone) or, worse,
 * merges the wrong pair. The pnl-statement is always treated as the
 * authoritative, complete set of sell/dividend records (it already has
 * fees/ISIN/realized-P&L/gross-withholding-net); the ledger is used only to
 * enrich each pnl row with a precise timestamp when a same-day+ticker match
 * exists, and any ledger sell/dividend row that never finds its pnl
 * counterpart is dropped as redundant rather than double-counted — UNLESS
 * the pnl-statement file wasn't part of this import at all, in which case
 * there's nothing to be redundant with and the ledger rows are kept as-is
 * (a CSV-only import still needs to show something, at reduced fidelity).
 */
function mergeSellsAndDividends(allRows: NormalizedBrokerTransaction[]): { rows: NormalizedBrokerTransaction[]; warnings: string[] } {
  const pnlSells = allRows.filter(isPnlSell);
  const ledgerSells = allRows.filter(isLedgerSell);
  const pnlDividends = allRows.filter(isPnlDividend);
  const ledgerDividends = allRows.filter(isLedgerDividend);
  const warnings: string[] = [];

  const enrich = (pnlRow: NormalizedBrokerTransaction, ledgerCandidates: NormalizedBrokerTransaction[]): NormalizedBrokerTransaction => {
    const matches = ledgerCandidates.filter(
      (l) => l.ticker === pnlRow.ticker && sameDay(l.timestamp, pnlRow.timestamp) && (l.quantity === null || pnlRow.quantity === null || Math.abs(l.quantity - pnlRow.quantity) < 1e-6)
    );
    if (matches.length === 0) return pnlRow;
    // Multiple ledger sources can match (the CSV row AND the account-statement
    // PDF row describe the same trade) — the CSV always wins for timestamp
    // precision (it's the only source with fractional-second precision), but
    // only the account-statement PDF carries commission, so pick each field
    // from whichever matching candidate actually has it rather than
    // defaulting to whichever happens to come first in the array.
    const timestampSource = matches.find((m) => m.timestampPrecision === "exact") ?? matches[0]!;
    const feesSource = matches.find((m) => m.feesMinor !== null) ?? matches[0]!;
    const commissionSource = matches.find((m) => m.commissionMinor !== null) ?? matches[0]!;
    return {
      ...pnlRow,
      timestamp: timestampSource.timestamp,
      timestampPrecision: timestampSource.timestampPrecision,
      feesMinor: pnlRow.feesMinor ?? feesSource.feesMinor,
      commissionMinor: pnlRow.commissionMinor ?? commissionSource.commissionMinor,
    };
  };

  const mergedSells = pnlSells.length > 0 ? pnlSells.map((row) => enrich(row, ledgerSells)) : ledgerSells;
  const mergedDividends = pnlDividends.length > 0 ? pnlDividends.map((row) => enrich(row, ledgerDividends)) : ledgerDividends;

  return { rows: [...mergedSells, ...mergedDividends], warnings };
}

function reconcile(byFile: NormalizedBrokerTransaction[][]): { rows: NormalizedBrokerTransaction[]; warnings: string[] } {
  const allRows = byFile.flat();
  const buysAndActions = allRows.filter((r) => r.type === "buy" || r.type === "corporate_action");

  // Buys/corporate actions are ledger-only (never appear in the pnl-statement) and always 1:1 across the CSV and account-statement PDF — the generic day+ticker+quantity join is safe here.
  const { rows: mergedBuys, conflicts } = reconcileRows([buysAndActions], pickField);
  const { rows: mergedSellsAndDividends, warnings: mergeWarnings } = mergeSellsAndDividends(allRows);

  const warnings = [
    ...conflicts
      .filter((c) => c.field === "quantity" || c.field === "type")
      .map((c) => `Bronnen spreken elkaar tegen voor ${c.field} rond ${c.joinKey}: ${c.values.join(", ")}`),
    ...mergeWarnings,
  ];

  return { rows: [...mergedBuys, ...mergedSellsAndDividends], warnings };
}

/** Module-level scratch space for the current-holdings rows the last `parse()` call discovered (from account-statement PDFs) — the shared `BrokerAdapter.parse` signature returns only `NormalizedBrokerTransaction[][]`, so this side-channel is how the import preview (§15 of the plan) additionally shows current holdings/ISIN-learning input without widening the shared interface for one broker's extra data. Cleared and repopulated on every `parse()` call; read via `takeLastParsedCurrentHoldings()` immediately after. */
let lastParsedCurrentHoldings: CurrentHolding[] = [];

/** Same pattern as lastParsedCurrentHoldings, for files that were recognized by content but intentionally contribute zero rows (currently: the costs-and-charges report) — surfaced as preview warnings so "0 rows from this file" is never silent. */
let lastParsedIgnoredFileWarnings: string[] = [];

export function takeLastParsedCurrentHoldings(): CurrentHolding[] {
  const holdings = lastParsedCurrentHoldings;
  lastParsedCurrentHoldings = [];
  return holdings;
}

export function takeLastParsedIgnoredFileWarnings(): string[] {
  const warnings = lastParsedIgnoredFileWarnings;
  lastParsedIgnoredFileWarnings = [];
  return warnings;
}

async function parse(matches: FileTypeMatch[]): Promise<NormalizedBrokerTransaction[][]> {
  const byFile: NormalizedBrokerTransaction[][] = [];
  const currentHoldings: CurrentHolding[] = [];
  const ignoredFileWarnings: string[] = [];
  for (const match of matches) {
    const parsed = await parseFile(match);
    byFile.push(parsed.transactions);
    currentHoldings.push(...parsed.currentHoldings);
    if (parsed.ignoredReason) ignoredFileWarnings.push(parsed.ignoredReason);
  }
  lastParsedCurrentHoldings = currentHoldings;
  lastParsedIgnoredFileWarnings = ignoredFileWarnings;
  return byFile;
}

export const RevolutAdapter: BrokerAdapter = {
  brokerId: "revolut",
  displayName: "Revolut",
  capabilities: REVOLUT_CAPABILITIES,
  detectFiles,
  parse,
  reconcile,
};
