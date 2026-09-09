import { calculateFifoRealizedPnl, type FifoTransactionInput } from "@/features/brokerImport/fifoFallback";

function singleResult(transactions: FifoTransactionInput[]) {
  const results = calculateFifoRealizedPnl(transactions);
  expect(results).toHaveLength(1);
  return results[0]!;
}

describe("calculateFifoRealizedPnl", () => {
  it("matches a single sell fully against a single earlier buy", () => {
    const result = singleResult([
      { id: "buy1", type: "buy", quantity: 10, priceMinor: 1000, timestamp: "2024-01-01T00:00:00.000Z" },
      { id: "sell1", type: "sell", quantity: 10, priceMinor: 1500, timestamp: "2024-02-01T00:00:00.000Z" },
    ]);
    expect(result.transactionId).toBe("sell1");
    expect(result.costBasisMinor).toBe(10_000);
    expect(result.proceedsMinor).toBe(15_000);
    expect(result.realizedPnlMinor).toBe(5_000);
    expect(result.quantityUnmatched).toBe(0);
  });

  it("consumes the earliest lot first regardless of input order (true FIFO)", () => {
    const result = singleResult([
      { id: "sell1", type: "sell", quantity: 5, priceMinor: 2000, timestamp: "2024-03-01T00:00:00.000Z" },
      { id: "buy2", type: "buy", quantity: 5, priceMinor: 1200, timestamp: "2024-02-01T00:00:00.000Z" },
      { id: "buy1", type: "buy", quantity: 5, priceMinor: 1000, timestamp: "2024-01-01T00:00:00.000Z" },
    ]);
    // Sorted chronologically, buy1 (1000/unit) is consumed before buy2 — not input order.
    expect(result.costBasisMinor).toBe(5_000);
    expect(result.realizedPnlMinor).toBe(10_000 - 5_000);
  });

  it("splits one sell across two lots when it exceeds the first lot's quantity (the CVX-style multi-lot case)", () => {
    const result = singleResult([
      { id: "buy1", type: "buy", quantity: 3, priceMinor: 1000, timestamp: "2024-01-01T00:00:00.000Z" },
      { id: "buy2", type: "buy", quantity: 5, priceMinor: 1400, timestamp: "2024-01-15T00:00:00.000Z" },
      { id: "sell1", type: "sell", quantity: 6, priceMinor: 2000, timestamp: "2024-02-01T00:00:00.000Z" },
    ]);
    // 3 units @1000 + 3 units @1400 = 3000 + 4200 = 7200
    expect(result.costBasisMinor).toBe(7_200);
    expect(result.proceedsMinor).toBe(12_000);
    expect(result.realizedPnlMinor).toBe(4_800);
    expect(result.quantityUnmatched).toBe(0);
  });

  it("prorates fees into cost basis (buy) and proceeds (sell)", () => {
    const result = singleResult([
      { id: "buy1", type: "buy", quantity: 10, priceMinor: 1000, feesMinor: 100, timestamp: "2024-01-01T00:00:00.000Z" },
      { id: "sell1", type: "sell", quantity: 10, priceMinor: 1500, feesMinor: 50, timestamp: "2024-02-01T00:00:00.000Z" },
    ]);
    expect(result.costBasisMinor).toBe(10_100); // (1000*10 + 100)
    expect(result.proceedsMinor).toBe(14_950); // (1500*10 - 50)
    expect(result.realizedPnlMinor).toBe(4_850);
  });

  it("flags the unmatched portion of a sell that exceeds known buy history — never treats it as zero cost basis", () => {
    const result = singleResult([
      { id: "buy1", type: "buy", quantity: 4, priceMinor: 1000, timestamp: "2024-01-01T00:00:00.000Z" },
      { id: "sell1", type: "sell", quantity: 10, priceMinor: 1500, timestamp: "2024-02-01T00:00:00.000Z" },
    ]);
    expect(result.quantityUnmatched).toBeCloseTo(6, 9);
    // Only the matched 4 units contribute to cost basis/proceeds/pnl — the unmatched 6 are excluded, not zero-costed.
    expect(result.costBasisMinor).toBe(4_000);
    expect(result.proceedsMinor).toBe(6_000); // 1500 * 4 (matched quantity), not 1500 * 10
  });

  it("returns no results for buy-only history", () => {
    const transactions: FifoTransactionInput[] = [{ id: "buy1", type: "buy", quantity: 10, priceMinor: 1000, timestamp: "2024-01-01T00:00:00.000Z" }];
    expect(calculateFifoRealizedPnl(transactions)).toEqual([]);
  });

  it("produces one result per sell for multiple partial sells against the same lot", () => {
    const transactions: FifoTransactionInput[] = [
      { id: "buy1", type: "buy", quantity: 10, priceMinor: 1000, timestamp: "2024-01-01T00:00:00.000Z" },
      { id: "sell1", type: "sell", quantity: 4, priceMinor: 1500, timestamp: "2024-02-01T00:00:00.000Z" },
      { id: "sell2", type: "sell", quantity: 6, priceMinor: 1600, timestamp: "2024-03-01T00:00:00.000Z" },
    ];
    const results = calculateFifoRealizedPnl(transactions);
    expect(results).toHaveLength(2);
    expect(results[0]!.costBasisMinor).toBe(4_000);
    expect(results[1]!.costBasisMinor).toBe(6_000);
  });
});
