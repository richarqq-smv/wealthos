import type { BrokerId, Investment } from "@/types/models";
import { ImportedFingerprintStore } from "@/lib/repositories/BrokerImportRepository";
import { computeImportFingerprint, partitionByFingerprint } from "./fingerprint";
import { matchInstrument, TickerIsinMap } from "./instrumentMatch";
import { RevolutAdapter, takeLastParsedCurrentHoldings, takeLastParsedIgnoredFileWarnings } from "./revolut/adapter";
import { DegiroAdapter } from "./degiro/adapter";
import type { BrokerAdapter, BrokerCapabilities, FileTypeMatch, NormalizedBrokerTransaction, PickedFile } from "./types";
import type { CurrentHolding } from "./revolut/parseAccountStatementPdf";

const ADAPTERS: Record<BrokerId, BrokerAdapter> = {
  revolut: RevolutAdapter,
  degiro: DegiroAdapter,
};

/** Capabilities for a given broker — used outside the preview pipeline too (e.g. confirmImport routes sells through the FIFO fallback when providesRealizedPnl is false). */
export function getAdapterCapabilities(broker: BrokerId): BrokerCapabilities {
  return ADAPTERS[broker].capabilities;
}

/** Display name for a given broker (e.g. "Revolut", "DEGIRO") — the one place this mapping lives, so persisted records never hardcode a broker label. */
export function getAdapterDisplayName(broker: BrokerId): string {
  return ADAPTERS[broker].displayName;
}

export interface ImportPreviewRow {
  row: NormalizedBrokerTransaction;
  isDuplicate: boolean;
  matchedInvestmentId: string | null;
  isNewInstrument: boolean;
  matchedByTickerOnly: boolean;
}

export interface ImportWarning {
  kind: "unknownCostBasis" | "missingIsin" | "ambiguousInstrument" | "conflictingSourceData" | "unsupportedFile";
  message: string;
}

export interface ImportPreviewResult {
  broker: BrokerId;
  rows: ImportPreviewRow[];
  currentHoldings: CurrentHolding[];
  warnings: ImportWarning[];
  counts: {
    totalScanned: number;
    new: number;
    duplicate: number;
    buy: number;
    sell: number;
    dividend: number;
    correctiveAction: number;
  };
}

/**
 * Runs the full read-only pipeline (detect → parse → reconcile → learn ISIN
 * → dedup → instrument match) and returns a preview. Never writes anything
 * — persistence only happens in `confirmImport` below, after the user has
 * explicitly reviewed this preview, mirroring the existing cash-CSV
 * importer's confirm step.
 */
export async function buildImportPreview(broker: BrokerId, files: PickedFile[], existingInvestments: Investment[]): Promise<ImportPreviewResult> {
  const adapter: BrokerAdapter = ADAPTERS[broker];
  const matches: FileTypeMatch[] = adapter.detectFiles(files);

  const unsupported = matches.filter((m) => m.kind === "unknown");
  const byFile = await adapter.parse(matches);
  const { rows: reconciledRows, warnings: reconcileWarnings } = adapter.reconcile(byFile);
  const currentHoldings = broker === "revolut" ? takeLastParsedCurrentHoldings() : [];

  await TickerIsinMap.learnFrom(reconciledRows);
  // Current holdings (account-statement portfolio breakdown) are an even
  // more authoritative ISIN source than transaction rows — learn from them
  // too, using the same ticker+currency key shape.
  if (currentHoldings.length > 0) {
    await TickerIsinMap.learnFrom(
      currentHoldings.map((h) => ({
        timestamp: "",
        timestampPrecision: "dateOnly",
        type: "buy",
        ticker: h.ticker,
        isin: h.isin,
        securityName: h.securityName,
        quantity: null,
        priceMinor: null,
        currency: h.currency,
        grossAmountMinor: null,
        netAmountMinor: null,
        feesMinor: null,
        commissionMinor: null,
        withholdingTaxMinor: null,
        realizedPnlMinor: null,
        costBasisMinor: null,
        pnlSource: null,
        fxRateAtTransaction: null,
        broker,
        sourceFile: "",
        sourceRowRef: "",
      }))
    );
  }

  const alreadyImported = await ImportedFingerprintStore.getAll();
  const { newRows, duplicateRows } = partitionByFingerprint(reconciledRows, alreadyImported);
  const duplicateFingerprints = new Set(duplicateRows.map(computeImportFingerprint));

  const previewRows: ImportPreviewRow[] = [];
  const warnings: ImportWarning[] = [];

  for (const row of reconciledRows) {
    const fp = computeImportFingerprint(row);
    const isDuplicate = duplicateFingerprints.has(fp);
    const match = await matchInstrument(row, existingInvestments);
    previewRows.push({
      row,
      isDuplicate,
      matchedInvestmentId: match.investmentId,
      isNewInstrument: match.investmentId === null,
      matchedByTickerOnly: match.matchedByTickerOnly,
    });

    if (row.costBasisKnown === false) {
      warnings.push({
        kind: "unknownCostBasis",
        message: `${row.ticker ?? row.securityName ?? "Onbekend instrument"}: cost basis onbekend (corporate action) — nooit als €0 aangenomen.`,
      });
    }
    if (!row.isin && !row.ticker) {
      warnings.push({ kind: "missingIsin", message: "Transactie zonder ISIN en zonder ticker — kan niet gekoppeld worden." });
    }
    if (match.matchedByTickerOnly && match.investmentId !== null) {
      warnings.push({
        kind: "ambiguousInstrument",
        message: `${row.ticker}: gekoppeld op ticker alleen (geen ISIN bekend) — controleer of dit het juiste instrument is.`,
      });
    }
  }

  for (const warning of reconcileWarnings) {
    warnings.push({ kind: "conflictingSourceData", message: warning });
  }
  for (const file of unsupported) {
    warnings.push({ kind: "unsupportedFile", message: `${file.file.name}: bestandstype niet herkend, genegeerd.` });
  }
  if (broker === "revolut") {
    for (const message of takeLastParsedIgnoredFileWarnings()) {
      warnings.push({ kind: "unsupportedFile", message });
    }
  }

  const newOnly = newRows;
  return {
    broker,
    rows: previewRows,
    currentHoldings,
    warnings,
    counts: {
      totalScanned: reconciledRows.length,
      new: newOnly.length,
      duplicate: duplicateRows.length,
      buy: reconciledRows.filter((r) => r.type === "buy").length,
      sell: reconciledRows.filter((r) => r.type === "sell").length,
      dividend: reconciledRows.filter((r) => r.type === "dividend").length,
      correctiveAction: reconciledRows.filter((r) => r.type === "corporate_action").length,
    },
  };
}
