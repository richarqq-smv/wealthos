import { readFileSync } from "fs";
import { join } from "path";
import { parseRevolutAccountStatementCsv } from "@/features/brokerImport/revolut/parseAccountStatementCsv";

/**
 * Regression fixture: the exact 113-row Revolut account-statement CSV
 * forensically reconciled earlier (30 instruments, 0 discrepancies against
 * Revolut's own portfolio breakdown). Every assertion below is a number
 * proven by hand during that review, not an estimate. This is the sanitized
 * copy (see fixtures/revolut/README.md) — the CSV itself never carried a
 * name/address/account-number, so sanitization changed nothing here, but
 * every committed test reads from sanitized/ uniformly regardless.
 */
const fixturePath = join(__dirname, "..", "fixtures", "revolut", "sanitized", "account-statement.csv");

describe("parseRevolutAccountStatementCsv — real 113-row fixture", () => {
  const csv = readFileSync(fixturePath, "utf8");
  const result = parseRevolutAccountStatementCsv(csv, "account-statement.csv");

  it("parses successfully", () => {
    expect(result.ok).toBe(true);
  });

  it("produces exactly 33 buy + 17 sell + 36 dividend = 86 investment rows, skipping 27 cash rows", () => {
    if (!result.ok) throw new Error("parse failed");
    const buys = result.rows.filter((r) => r.type === "buy");
    const sells = result.rows.filter((r) => r.type === "sell");
    const dividends = result.rows.filter((r) => r.type === "dividend");
    expect(buys).toHaveLength(33);
    expect(sells).toHaveLength(17);
    expect(dividends).toHaveLength(36);
    expect(result.skippedCashRows).toBe(27); // 17 CASH TOP-UP + 10 CASH WITHDRAWAL
    expect(buys.length + sells.length + dividends.length).toBe(86);
  });

  it("captures 29 distinct tickers from CSV alone (TKMS is PDF-only, never appears here — see forensic review §3)", () => {
    if (!result.ok) throw new Error("parse failed");
    const tickers = new Set(result.rows.map((r) => r.ticker));
    expect(tickers.size).toBe(29);
    expect(tickers.has("TKMS")).toBe(false);
  });

  it("keeps full millisecond timestamp precision — the exact same-second NOC/TXN pair from the forensic review stays distinguishable", () => {
    if (!result.ok) throw new Error("parse failed");
    const noc = result.rows.find((r) => r.ticker === "NOC" && r.type === "buy");
    const txn = result.rows.find((r) => r.ticker === "TXN" && r.type === "buy" && r.timestamp.startsWith("2025-03-24"));
    expect(noc?.timestamp).toBe("2025-03-24T13:30:01.052Z");
    expect(txn?.timestamp).toBe("2025-03-24T13:30:01.451Z");
    expect(noc?.timestamp).not.toBe(txn?.timestamp);
  });

  it("computes gross execution value distinct from the raw ledger cash movement (TME buy: price 17.15 x qty 3.29446064 = 56.50 gross, but 56.56 actually left the account)", () => {
    if (!result.ok) throw new Error("parse failed");
    const tme = result.rows.find((r) => r.ticker === "TME" && r.type === "buy");
    expect(tme?.grossAmountMinor).toBe(5650); // 56.4999... rounds to 56.50
    expect(tme?.netAmountMinor).toBe(5656); // includes the 0.06 commission
  });

  it("never assigns an ISIN — this file structurally never carries one", () => {
    if (!result.ok) throw new Error("parse failed");
    expect(result.rows.every((r) => r.isin === null)).toBe(true);
  });

  it("reconciles net BUY-minus-SELL quantity per ticker against known current-holding quantities from the account-statement PDF", () => {
    if (!result.ok) throw new Error("parse failed");
    const netQuantity = (ticker: string) =>
      result.rows
        .filter((r) => r.ticker === ticker)
        .reduce((sum, r) => sum + (r.type === "buy" ? (r.quantity ?? 0) : r.type === "sell" ? -(r.quantity ?? 0) : 0), 0);

    // Multi-lot accumulation, still fully held — both proven exact matches in the forensic review.
    expect(netQuantity("GOOGL")).toBeCloseTo(0.3087324, 6);
    expect(netQuantity("TKA")).toBeCloseTo(8.66373942, 6);
    // Two buy lots closed by one sell order — fully closed, net zero.
    expect(netQuantity("CVX")).toBeCloseTo(0, 6);
  });

  it("rejects a CSV with the wrong columns instead of guessing", () => {
    const bad = parseRevolutAccountStatementCsv("Ticker,Shares,Price\nAAPL,10,150\n", "wrong.csv");
    expect(bad.ok).toBe(false);
  });
});
