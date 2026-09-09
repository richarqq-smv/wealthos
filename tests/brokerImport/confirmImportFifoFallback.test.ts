import AsyncStorage from "@react-native-async-storage/async-storage";

// confirmImport.ts -> engine.ts -> revolut/adapter.ts -> lib/pdfExtract.ts, the
// one module that imports the ESM-only pdfjs-dist (see lib/pdfExtract.ts's
// doc comment) — mocked here purely so this module chain loads under Jest;
// these DEGIRO-only tests never call PDF parsing.
jest.mock("@/lib/pdfExtract", () => ({ extractPdfPages: jest.fn() }));

import { confirmImport } from "@/features/brokerImport/confirmImport";
import { InvestmentRepository } from "@/lib/repositories/InvestmentRepository";
import { InvestmentTransactionRepository } from "@/lib/repositories/InvestmentTransactionRepository";
import type { ImportPreviewResult } from "@/features/brokerImport/engine";
import type { NormalizedBrokerTransaction } from "@/features/brokerImport/types";

/**
 * DEGIRO's real parser is a deliberate no-op stub (see
 * features/brokerImport/degiro/parseTransactionsCsv.ts — no genuine DEGIRO
 * export was available to verify column assumptions against). That doesn't
 * block testing the FIFO-fallback *wiring* in confirmImport, though: this
 * feeds a hand-built ImportPreviewResult (broker: "degiro") with synthetic,
 * clearly-labeled buy/sell rows straight into confirmImport, bypassing the
 * unverified parser entirely, to prove that a broker whose
 * capabilities.providesRealizedPnl is false gets its sells routed through
 * the shared FIFO calculator rather than left with no P&L at all.
 */
function degiroRow(overrides: Partial<NormalizedBrokerTransaction>): NormalizedBrokerTransaction {
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
    sourceFile: "synthetic-degiro-transactions.csv",
    sourceRowRef: "row-1",
    ...overrides,
  };
}

function buildPreview(rows: NormalizedBrokerTransaction[]): ImportPreviewResult {
  return {
    broker: "degiro",
    rows: rows.map((row) => ({ row, isDuplicate: false, matchedInvestmentId: null, isNewInstrument: true, matchedByTickerOnly: false })),
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

describe("confirmImport — DEGIRO FIFO fallback wiring (synthetic rows, real parser is a verified no-op)", () => {
  it("computes realized P&L via FIFO for a DEGIRO sell and marks it wealthos-calculated", async () => {
    const preview = buildPreview([
      degiroRow({ type: "buy", quantity: 4, priceMinor: 10_000, timestamp: "2024-01-01T00:00:00.000Z" }),
      degiroRow({ type: "sell", quantity: 4, priceMinor: 15_000, timestamp: "2024-02-01T00:00:00.000Z", sourceRowRef: "row-2" }),
    ]);

    const result = await confirmImport(preview, []);
    expect(result.transactionsCreated).toBe(2);

    const transactions = await InvestmentTransactionRepository.getAll();
    const sell = transactions.find((t) => t.type === "sell")!;
    expect(sell.pnlSource).toBe("wealthos-calculated");
    expect(sell.costBasisMinor).toBe(40_000);
    expect(sell.realizedPnlMinor).toBe(20_000);
    expect(sell.costBasisKnown).toBe(true);
    expect(sell.broker).toBe("degiro");

    const investments = await InvestmentRepository.getAll();
    expect(investments).toHaveLength(1);
    expect(investments[0]!.broker).toBe("DEGIRO");
  });

  it("marks costBasisKnown false (never €0) when a sell exceeds the known buy history", async () => {
    const preview = buildPreview([
      degiroRow({ type: "buy", quantity: 1, priceMinor: 10_000, timestamp: "2024-01-01T00:00:00.000Z" }),
      degiroRow({ type: "sell", quantity: 3, priceMinor: 15_000, timestamp: "2024-02-01T00:00:00.000Z", sourceRowRef: "row-2" }),
    ]);

    await confirmImport(preview, []);
    const transactions = await InvestmentTransactionRepository.getAll();
    const sell = transactions.find((t) => t.type === "sell")!;
    expect(sell.costBasisKnown).toBe(false);
    expect(sell.pnlSource).toBe("wealthos-calculated");
  });
});
