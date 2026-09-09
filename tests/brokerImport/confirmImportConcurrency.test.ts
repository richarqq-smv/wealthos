import AsyncStorage from "@react-native-async-storage/async-storage";

// See tests/brokerImport/confirmImportFifoFallback.test.ts for why this mock
// is needed even for DEGIRO-only rows: confirmImport.ts -> engine.ts ->
// revolut/adapter.ts -> lib/pdfExtract.ts, the one module importing the
// ESM-only pdfjs-dist.
jest.mock("@/lib/pdfExtract", () => ({ extractPdfPages: jest.fn() }));

import { confirmImport } from "@/features/brokerImport/confirmImport";
import { InvestmentTransactionRepository } from "@/lib/repositories/InvestmentTransactionRepository";
import type { ImportPreviewResult } from "@/features/brokerImport/engine";
import type { NormalizedBrokerTransaction } from "@/features/brokerImport/types";

function row(overrides: Partial<NormalizedBrokerTransaction>): NormalizedBrokerTransaction {
  return {
    timestamp: "2024-01-01T00:00:00.000Z",
    timestampPrecision: "exact",
    type: "buy",
    ticker: "ASML",
    isin: "NL0010273215",
    securityName: "ASML Holding",
    quantity: 1,
    priceMinor: 10_000,
    currency: "EUR",
    grossAmountMinor: 10_000,
    netAmountMinor: 10_000,
    feesMinor: null,
    commissionMinor: null,
    withholdingTaxMinor: null,
    realizedPnlMinor: null,
    costBasisMinor: null,
    pnlSource: null,
    fxRateAtTransaction: null,
    broker: "degiro",
    sourceFile: "synthetic.csv",
    sourceRowRef: "row-1",
    ...overrides,
  };
}

function buildPreview(rows: NormalizedBrokerTransaction[]): ImportPreviewResult {
  return {
    broker: "degiro",
    rows: rows.map((r) => ({ row: r, isDuplicate: false, matchedInvestmentId: null, isNewInstrument: true, matchedByTickerOnly: false })),
    currentHoldings: [],
    warnings: [],
    counts: {
      totalScanned: rows.length,
      new: rows.length,
      duplicate: 0,
      buy: rows.filter((r) => r.type === "buy").length,
      sell: rows.filter((r) => r.type === "sell").length,
      dividend: 0,
      correctiveAction: 0,
    },
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

/**
 * confirmImport does a "load collection once, mutate in memory, replaceAll
 * once" write (see its own doc comment) — a second confirmImport starting
 * before the first finishes could read a stale snapshot and, via its own
 * replaceAll, silently discard the first import's writes. This proves the
 * module-level reentrancy guard actually rejects an overlapping call rather
 * than letting two writes interleave.
 */
describe("confirmImport — concurrent-call guard (defends replaceAll from a stale-snapshot race)", () => {
  it("rejects a second confirmImport that starts while the first is still in flight", async () => {
    const first = confirmImport(buildPreview([row({ sourceRowRef: "a" })]), []);
    const second = confirmImport(buildPreview([row({ sourceRowRef: "b", ticker: "MSFT", isin: "US5949181045" })]), []);

    await expect(second).rejects.toThrow(/loopt al een import/i);
    const firstResult = await first;
    expect(firstResult.transactionsCreated).toBe(1);

    // The rejected second call must not have written anything — only the first import's transaction exists.
    const allTransactions = await InvestmentTransactionRepository.getAll();
    expect(allTransactions).toHaveLength(1);
  });

  it("allows a new confirmImport once the previous one has resolved", async () => {
    await confirmImport(buildPreview([row({ sourceRowRef: "a" })]), []);
    const result = await confirmImport(buildPreview([row({ sourceRowRef: "b", ticker: "MSFT", isin: "US5949181045" })]), []);
    expect(result.transactionsCreated).toBe(1);

    const allTransactions = await InvestmentTransactionRepository.getAll();
    expect(allTransactions).toHaveLength(2);
  });
});
