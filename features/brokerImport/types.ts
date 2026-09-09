import type { BrokerId, InvestmentTransactionType, PnlSource } from "@/types/models";

/**
 * The one shape every broker adapter must normalize its own rows into,
 * before any shared logic (reconciliation, dedup, matching, preview) runs.
 * Nothing downstream of `normalize()` may look at broker-specific fields —
 * that boundary is what lets Revolut and DEGIRO (and future brokers) share
 * one engine instead of each needing their own preview/dedup/persistence
 * code.
 */
export interface NormalizedBrokerTransaction {
  /** Full-precision ISO timestamp when available (Revolut's ledger CSV); a date-only string is acceptable but must be flagged via `timestampPrecision`. */
  timestamp: string;
  timestampPrecision: "exact" | "dateOnly";
  type: InvestmentTransactionType;
  ticker: string | null;
  isin: string | null;
  securityName: string | null;
  quantity: number | null;
  priceMinor: number | null;
  currency: string;
  /** Pure execution value (price × quantity for a trade; broker-reported gross for a dividend) — NEVER the same as the cash that actually moved when fees/withholding apply. Proven distinct in the forensic review: a buy's ledger cash-out = gross + commission; a sell's ledger cash-in = gross − fees − commission. */
  grossAmountMinor: number | null;
  /** The actual cash effect of this row, straight from the broker's own ledger — always known when a row comes from the raw transaction ledger, even when gross/fees can't be separated (e.g. a CSV-only dividend row, which shows only the post-withholding net). */
  netAmountMinor: number | null;
  feesMinor: number | null;
  commissionMinor: number | null;
  withholdingTaxMinor: number | null;
  realizedPnlMinor: number | null;
  costBasisMinor: number | null;
  /** Explicit tri-state: true = a real cost basis is known, false = known to be unknowable (e.g. a spin-off), undefined = not applicable to this row type. Never inferred as false-means-zero. */
  costBasisKnown?: boolean;
  pnlSource: PnlSource | null;
  fxRateAtTransaction: number | null;
  broker: BrokerId;
  sourceFile: string;
  sourceRowRef: string;
}

export interface BrokerCapabilities {
  /** True when the broker's own export already contains a computed realized-P&L figure per closed lot (Revolut: yes). False means the shared FIFO fallback calculator must be used instead (DEGIRO: yes, per independent community sources — see features/brokerImport/degiro/adapter.ts). */
  providesRealizedPnl: boolean;
  providesCostBasis: boolean;
  providesFifoLotAllocation: boolean;
  providesHistoricalFx: boolean;
  providesDividends: boolean;
  providesFees: boolean;
  providesIsin: boolean;
}

export type BrokerFileKind = "unknown" | string;

export interface PickedFile {
  name: string;
  /** Populated by the platform-specific picker (see pickBrokerFiles.ts) — base64 for binary formats (PDF/XLSX), plain text for CSV. */
  content: string;
  encoding: "utf8" | "base64";
}

export interface FileTypeMatch {
  file: PickedFile;
  kind: BrokerFileKind;
  /** Whether detection was based on real content inspection (header row, PDF title text) rather than just the filename — filenames are never trusted alone. */
  detectedBy: "content" | "filename-fallback";
}

export interface BrokerAdapter {
  brokerId: BrokerId;
  displayName: string;
  capabilities: BrokerCapabilities;
  /** Content-sniffed, not filename-based — a user renaming a file must not silently misroute it. Synchronous: cheap magic-byte/header checks only, never parses full file content. */
  detectFiles(files: PickedFile[]): FileTypeMatch[];
  /** Async because PDF parsing (pdfjs) and some format resolution (e.g. distinguishing Revolut's three PDF report types by reading page text) are inherently async — every adapter must support this, not just the ones that happen to need it today. */
  parse(matches: FileTypeMatch[]): Promise<NormalizedBrokerTransaction[][]>;
  /** Merges rows describing the same real-world transaction across multiple files of this broker (e.g. a CSV row + its matching PDF fee row) into one enriched row. Never drops a row silently on conflict — see reconcile.ts for the shared conflict-flagging helper this should call. */
  reconcile(byFile: NormalizedBrokerTransaction[][]): { rows: NormalizedBrokerTransaction[]; warnings: string[] };
}
