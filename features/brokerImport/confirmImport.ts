import { InvestmentRepository } from "@/lib/repositories/InvestmentRepository";
import { InvestmentTransactionRepository } from "@/lib/repositories/InvestmentTransactionRepository";
import { BrokerImportRepository, ImportedFingerprintStore } from "@/lib/repositories/BrokerImportRepository";
import { calculateWeightedAveragePosition } from "@/lib/calculations";
import { generateId } from "@/utils/id";
import { nowISO } from "@/utils/date";
import type { Investment, InvestmentTransaction, InvestmentType } from "@/types/models";
import { computeImportFingerprint } from "./fingerprint";
import { getAdapterCapabilities, getAdapterDisplayName, type ImportPreviewResult } from "./engine";
import { calculateFifoRealizedPnl } from "./fifoFallback";
import type { NormalizedBrokerTransaction } from "./types";

export interface ConfirmImportResult {
  investmentsCreated: number;
  investmentsUpdated: number;
  transactionsCreated: number;
  importRecordId: string;
}

function mapRowType(row: NormalizedBrokerTransaction) {
  return row.type;
}

/**
 * Module-level reentrancy guard: `InvestmentRepository.replaceAll` /
 * `InvestmentTransactionRepository.replaceAll` below replace the ENTIRE
 * collection with an in-memory snapshot taken at the start of this
 * function. The UI already disables its confirm button while busy (see
 * app/import/*.tsx), but that's a single screen's own state — this guard is
 * the actual write function's own defense, so two confirmImport calls
 * in-flight at once (any future call site, not just today's one screen)
 * can never interleave and silently drop one import's writes under the
 * other's stale snapshot.
 */
let importInFlight = false;

/**
 * Writes a confirmed import to disk. Only ever called after the user has
 * reviewed the preview and explicitly confirmed — never automatically.
 * Follows the "load every affected collection once, mutate in memory, write
 * once" pattern already established by
 * `InvestmentTransactionRepository.removeByInvestmentId` (see
 * `lib/repositories/BaseRepository.ts`'s doc comments) rather than one
 * `save()` round trip per row, since a real import can be 100+ rows.
 */
export async function confirmImport(preview: ImportPreviewResult, existingInvestments: Investment[]): Promise<ConfirmImportResult> {
  if (importInFlight) {
    throw new Error("Er loopt al een import. Wacht tot deze klaar is voordat je een nieuwe import bevestigt.");
  }
  importInFlight = true;
  try {
    return await runConfirmImport(preview, existingInvestments);
  } finally {
    importInFlight = false;
  }
}

async function runConfirmImport(preview: ImportPreviewResult, existingInvestments: Investment[]): Promise<ConfirmImportResult> {
  const rowsToImport = preview.rows.filter((r) => !r.isDuplicate);
  const capabilities = getAdapterCapabilities(preview.broker);
  const brokerDisplayName = getAdapterDisplayName(preview.broker);

  const investments = [...existingInvestments];
  const transactions = await InvestmentTransactionRepository.getAll();
  const now = nowISO();

  let investmentsCreated = 0;
  let investmentsUpdated = 0;
  const newTransactions: InvestmentTransaction[] = [];
  const newFingerprints: string[] = [];

  // Group by resolved instrument (existing match, or a new one keyed by
  // ticker+currency within this batch — so e.g. two GOOGL buys in the same
  // import create exactly one new Investment, not two).
  const newInstrumentKeyToId = new Map<string, string>();

  const resolveInvestmentId = (row: NormalizedBrokerTransaction, matchedId: string | null): string => {
    if (matchedId) return matchedId;
    const key = `${(row.ticker ?? "").toUpperCase()}|${row.currency}`;
    const existingNewId = newInstrumentKeyToId.get(key);
    if (existingNewId) return existingNewId;

    const id = generateId();
    newInstrumentKeyToId.set(key, id);
    const type: InvestmentType = "stock"; // Best-effort default — Revolut's exports don't classify stock vs ETF vs fund; the user can correct this in the investment-detail screen like any manually-entered position.
    const investment: Investment = {
      id,
      name: row.securityName ?? row.ticker ?? "Onbekend instrument",
      ticker: row.ticker ?? "",
      isin: row.isin ?? undefined,
      type,
      quantity: 0,
      averagePriceMinor: 0,
      currentPriceMinor: 0,
      currency: row.currency as Investment["currency"],
      broker: brokerDisplayName,
      purchaseDate: row.timestamp || now,
      origin: "synced",
      createdAt: now,
      updatedAt: now,
    };
    investments.push(investment);
    investmentsCreated++;
    return id;
  };

  for (const previewRow of rowsToImport) {
    const row = previewRow.row;
    const investmentId = resolveInvestmentId(row, previewRow.matchedInvestmentId);
    const fingerprint = computeImportFingerprint(row);

    newTransactions.push({
      id: generateId(),
      investmentId,
      type: mapRowType(row),
      quantity: row.quantity ?? 0,
      priceMinor: row.priceMinor ?? 0,
      date: row.timestamp || now,
      createdAt: now,
      currency: row.currency as Investment["currency"],
      grossAmountMinor: row.grossAmountMinor ?? undefined,
      netAmountMinor: row.netAmountMinor ?? undefined,
      feesMinor: row.feesMinor ?? undefined,
      commissionMinor: row.commissionMinor ?? undefined,
      withholdingTaxMinor: row.withholdingTaxMinor ?? undefined,
      realizedPnlMinor: row.realizedPnlMinor ?? undefined,
      costBasisMinor: row.costBasisMinor ?? undefined,
      costBasisKnown: row.costBasisKnown,
      pnlSource: row.pnlSource ?? undefined,
      fxRateAtTransaction: row.fxRateAtTransaction ?? undefined,
      broker: preview.broker,
      sourceFile: row.sourceFile,
      sourceRowRef: row.sourceRowRef,
      importFingerprint: fingerprint,
    });
    newFingerprints.push(fingerprint);
  }

  const allTransactions = [...transactions, ...newTransactions];

  // Brokers whose export doesn't ship a broker-reported realized-P&L figure
  // (BrokerCapabilities.providesRealizedPnl === false — currently DEGIRO,
  // see features/brokerImport/degiro/adapter.ts) never get a silently
  // recalculated Revolut-style figure attributed to the broker; instead
  // their sell transactions are routed through the shared FIFO fallback
  // here, computed from this investment's own buy/sell history. This never
  // runs for a broker whose export already provides realized P&L — that
  // would overwrite a broker-reported figure with a recalculated one,
  // which the forensic review explicitly forbids.
  if (!capabilities.providesRealizedPnl) {
    const investmentIdsNeedingFifo = new Set(newTransactions.filter((t) => t.type === "sell").map((t) => t.investmentId));
    for (const investmentId of investmentIdsNeedingFifo) {
      const buySellForInvestment = allTransactions.filter((t) => t.investmentId === investmentId && (t.type === "buy" || t.type === "sell"));
      const fifoResults = calculateFifoRealizedPnl(
        buySellForInvestment.map((t) => ({
          id: t.id,
          type: t.type as "buy" | "sell",
          quantity: t.quantity,
          priceMinor: t.priceMinor,
          feesMinor: (t.feesMinor ?? 0) + (t.commissionMinor ?? 0),
          timestamp: t.date,
        }))
      );
      const fifoById = new Map(fifoResults.map((r) => [r.transactionId, r]));
      for (const t of newTransactions) {
        if (t.investmentId !== investmentId || t.type !== "sell" || t.pnlSource === "broker-reported") continue;
        const result = fifoById.get(t.id);
        if (!result) continue;
        t.costBasisMinor = result.costBasisMinor;
        t.realizedPnlMinor = result.realizedPnlMinor;
        // A sell that consumed more quantity than any known buy lot covers
        // (e.g. incomplete import history) gets an explicit "unknown" cost
        // basis for the unmatched portion — never silently treated as €0.
        t.costBasisKnown = result.quantityUnmatched <= 0;
        t.pnlSource = "wealthos-calculated";
      }
    }
  }

  // Recompute quantity/averagePriceMinor per touched investment from its
  // FULL transaction history — never incrementally per-row — using the
  // existing, already-tested weighted-average calculator (unchanged, still
  // exactly what manual entries use). Corporate actions add quantity with
  // no known cost basis and are applied separately, since
  // calculateWeightedAveragePosition only understands buy/sell.
  const touchedInvestmentIds = new Set(newTransactions.map((t) => t.investmentId));
  for (const investmentId of touchedInvestmentIds) {
    const investment = investments.find((inv) => inv.id === investmentId);
    if (!investment) continue;

    const txForInvestment = allTransactions.filter((t) => t.investmentId === investmentId);
    const buySell = txForInvestment.filter((t) => t.type === "buy" || t.type === "sell");
    const position = calculateWeightedAveragePosition(buySell);

    const corporateActionQuantity = txForInvestment.filter((t) => t.type === "corporate_action").reduce((sum, t) => sum + t.quantity, 0);
    const finalQuantity = position.quantity + corporateActionQuantity;

    const wasAlreadyExisting = existingInvestments.some((e) => e.id === investmentId);
    if (wasAlreadyExisting) investmentsUpdated++;

    investment.quantity = finalQuantity;
    investment.averagePriceMinor = position.averagePriceMinor;
    investment.currentPriceMinor = investment.currentPriceMinor || position.averagePriceMinor;
    investment.closedAt = finalQuantity === 0 ? now : undefined;
    investment.updatedAt = now;
  }

  await InvestmentRepository.replaceAll(investments);
  await InvestmentTransactionRepository.replaceAll(allTransactions);
  await ImportedFingerprintStore.addMany(newFingerprints);

  const importRecord = await BrokerImportRepository.create({
    broker: preview.broker,
    sourceFileNames: Array.from(new Set(rowsToImport.map((r) => r.row.sourceFile))),
    rowsScanned: preview.counts.totalScanned,
    rowsImported: rowsToImport.length,
    rowsDuplicate: preview.counts.duplicate,
    warnings: preview.warnings.map((w) => w.message),
  });

  return {
    investmentsCreated,
    investmentsUpdated,
    transactionsCreated: newTransactions.length,
    importRecordId: importRecord.id,
  };
}
