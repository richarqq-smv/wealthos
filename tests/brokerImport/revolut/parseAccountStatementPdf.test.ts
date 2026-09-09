import { readFileSync } from "fs";
import { join } from "path";
import { parseRevolutAccountStatementPdf } from "@/features/brokerImport/revolut/parseAccountStatementPdf";
import type { PdfTextItem } from "@/lib/pdfTable";

function loadPages(fixtureName: string): PdfTextItem[][] {
  // Sanitized copy (see fixtures/revolut/README.md) — table geometry byte-identical to the real export, only name/address/account-number replaced.
  const raw = readFileSync(join(__dirname, "..", "fixtures", "revolut", "sanitized", `${fixtureName}.pdf.items.json`), "utf8");
  return JSON.parse(raw) as PdfTextItem[][];
}

describe("parseRevolutAccountStatementPdf — real 7-page fixture", () => {
  const pages = loadPages("account-statement");
  const result = parseRevolutAccountStatementPdf(pages, "account-statement.pdf");

  it("finds the TKMS spin-off as a corporate_action with costBasisKnown explicitly false, not a silent 0", () => {
    const tkms = result.transactions.find((t) => t.ticker === "TKMS");
    expect(tkms).toBeDefined();
    expect(tkms?.type).toBe("corporate_action");
    expect(tkms?.costBasisKnown).toBe(false);
    expect(tkms?.quantity).toBeCloseTo(0.3927146, 6);
  });

  it("captures Fees and Commission for a real sell (TME) — proven distinct from the raw CSV, which has neither", () => {
    const tme = result.transactions.find((t) => t.ticker === "TME" && t.type === "sell");
    expect(tme?.feesMinor).toBe(1); // US$0.01
    expect(tme?.commissionMinor).toBe(8); // US$0.08
  });

  it("captures ISIN in the current-holdings portfolio breakdown for both currency books (13 total: 7 USD + 6 EUR)", () => {
    expect(result.currentHoldings).toHaveLength(13);
    const tkms = result.currentHoldings.find((h) => h.ticker === "TKMS");
    expect(tkms?.isin).toBe("DE000TKMS001");
    const sap = result.currentHoldings.find((h) => h.ticker === "TTWO");
    expect(sap?.isin).toBe("US8740541094");
  });

  it("finds every transaction type the reference dataset contains: buy, sell, dividend, corporate_action", () => {
    const types = new Set(result.transactions.map((t) => t.type));
    expect(types.has("buy")).toBe(true);
    expect(types.has("sell")).toBe(true);
    expect(types.has("dividend")).toBe(true);
    expect(types.has("corporate_action")).toBe(true);
  });

  it("never fabricates an ISIN on a transaction row (this PDF's Transactions table doesn't print one) — reconciliation is what fills it in later, not this parser", () => {
    expect(result.transactions.every((t) => t.isin === null)).toBe(true);
  });
});
