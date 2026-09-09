import { readFileSync } from "fs";
import { join } from "path";
import { parseRevolutPnlStatementPdf } from "@/features/brokerImport/revolut/parsePnlStatementPdf";
import type { PdfTextItem } from "@/lib/pdfTable";

function loadPages(fixtureName: string): PdfTextItem[][] {
  // Sanitized copy (see fixtures/revolut/README.md) — table geometry byte-identical to the real export, only name/address/account-number replaced.
  const raw = readFileSync(join(__dirname, "..", "fixtures", "revolut", "sanitized", `${fixtureName}.pdf.items.json`), "utf8");
  return JSON.parse(raw) as PdfTextItem[][];
}

describe("parseRevolutPnlStatementPdf — real 8-page fixture", () => {
  const pages = loadPages("pnl-statement");
  const rows = parseRevolutPnlStatementPdf(pages, "pnl-statement.pdf");

  it("finds exactly 18 sells (15 USD + 3 EUR) and 36 dividends", () => {
    const sells = rows.filter((r) => r.type === "sell");
    const dividends = rows.filter((r) => r.type === "dividend");
    expect(sells).toHaveLength(18);
    expect(dividends).toHaveLength(36);
  });

  it("marks every sell as broker-reported P&L with a known cost basis — Revolut's own FIFO, never recalculated", () => {
    const sells = rows.filter((r) => r.type === "sell");
    expect(sells.every((s) => s.pnlSource === "broker-reported")).toBe(true);
    expect(sells.every((s) => s.costBasisKnown === true)).toBe(true);
  });

  it("proves the CVX multi-lot FIFO split with correctly prorated fees (the forensic review's core finding)", () => {
    const cvxSells = rows.filter((r) => r.type === "sell" && r.ticker === "CVX");
    expect(cvxSells).toHaveLength(2); // one sell order, split into two FIFO lots

    const lot1 = cvxSells.find((r) => Math.abs((r.quantity ?? 0) - 0.0774921) < 1e-6);
    const lot2 = cvxSells.find((r) => Math.abs((r.quantity ?? 0) - 0.10579265) < 1e-6);
    expect(lot1?.feesMinor).toBe(3); // $0.03
    expect(lot2?.feesMinor).toBe(4); // $0.04
    expect(lot1?.costBasisMinor).toBe(1299); // $12.99
    expect(lot2?.costBasisMinor).toBe(1998); // $19.98
  });

  it("captures ISIN on every sell — the pnl-statement is one of the two sources that carries it (the other being the account-statement's current-holdings table)", () => {
    const sells = rows.filter((r) => r.type === "sell");
    expect(sells.every((s) => s.isin !== null)).toBe(true);
    const tme = sells.find((s) => s.ticker === "TME");
    expect(tme?.isin).toBe("US88034P1093");
  });

  it("captures dividend gross/withholding/net in the ORIGINAL currency, not EUR-converted (TXN dividend: $0.09 gross, $0.01 withheld, $0.08 net)", () => {
    const txnDividend = rows.find((r) => r.type === "dividend" && r.ticker === "TXN" && r.timestamp === "2025-05-14");
    expect(txnDividend?.currency).toBe("USD");
    expect(txnDividend?.grossAmountMinor).toBe(9);
    expect(txnDividend?.withholdingTaxMinor).toBe(1);
    expect(txnDividend?.netAmountMinor).toBe(8);
  });

  it("never double-counts the EUR-converted secondary line or the 'Rate:' line as extra rows", () => {
    // Every real logical row spans 2-3 physical PDF lines; if those were
    // mistakenly counted as separate rows, totals would be roughly 2-3x too high.
    expect(rows.filter((r) => r.type === "sell").length).toBeLessThan(30);
    expect(rows.filter((r) => r.type === "dividend").length).toBeLessThan(60);
  });
});
