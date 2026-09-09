import { readFileSync } from "fs";
import { join } from "path";
import { bucketRow, findTableHeader, groupIntoRows, parseCurrencyCell, type PdfTextItem } from "@/lib/pdfTable";

/**
 * Fixture: statically extracted PDF.js text-item dump of the real
 * account-statement PDF (pdfjs-dist is ESM-only and doesn't run under
 * Jest's CJS transform — see lib/pdfExtract.ts's doc comment — so the
 * extraction itself was run once via a plain `node` script, proven working
 * against real files, and its output frozen here). This still exercises
 * the real row/column-reconstruction logic (groupIntoRows/findTableHeader/
 * bucketRow) against real PDF geometry, not synthetic data.
 */
function loadPages(fixtureName: string): PdfTextItem[][] {
  // Sanitized copy (see fixtures/revolut/README.md) — real name/address/
  // account-number replaced with placeholders, every other item (including
  // the exact table geometry this test asserts against) byte-for-byte
  // identical to the real export.
  const raw = readFileSync(join(__dirname, "fixtures", "revolut", "sanitized", `${fixtureName}.pdf.items.json`), "utf8");
  return JSON.parse(raw) as PdfTextItem[][];
}

describe("pdfTable — reconstructed from the real account-statement PDF's geometry", () => {
  const pages = loadPages("account-statement");

  it("reconstructs the EUR portfolio breakdown table including the TKMS spin-off's ISIN", () => {
    const rows = groupIntoRows(pages[4]!); // page index 4 = page 5, the EUR portfolio breakdown
    const header = findTableHeader(rows, ["Symbol", "Company", "ISIN", "Quantity", "Price", "Value", "% of Portfolio"]);
    expect(header).not.toBeNull();

    const dataRows = rows.slice(header!.headerIndex + 1, header!.headerIndex + 7).map((r) => bucketRow(r, header!.columns));
    const tkms = dataRows.find((r) => r.Symbol === "TKMS");
    expect(tkms?.ISIN).toBe("DE000TKMS001");
    expect(tkms?.Company).toBe("TKMS AG & Co. KGaA");
  });

  it("finds the real TKMS Spinoff transaction row (Type = 'Spinoff', not Buy/Sell)", () => {
    const rows = groupIntoRows(pages[4]!);
    const header = findTableHeader(rows, ["Date", "Symbol", "Type", "Quantity", "Value"]);
    expect(header).not.toBeNull();

    const spinoffRowIndex = rows.findIndex((r) => r.cells.some((c) => c.str === "Spinoff"));
    expect(spinoffRowIndex).toBeGreaterThan(-1);
    const bucketed = bucketRow(rows[spinoffRowIndex]!, header!.columns);
    expect(bucketed.Symbol).toBe("TKMS");
    expect(bucketed.Type).toBe("Spinoff");
    expect(bucketed.Quantity).toBe("0.3927146");
  });

  it("reconstructs a USD transaction row with fees/commission (TME sell)", () => {
    const rows = groupIntoRows(pages[1]!); // page 2 — the TME sell (08 Sep 2025) is on the second page of USD transactions
    const header = findTableHeader(rows, ["Date", "Symbol", "Type", "Quantity", "Price", "Side", "Value", "Fees", "Commission"]);
    expect(header).not.toBeNull();
    const tmeSellIndex = rows.findIndex((r) => r.cells.some((c) => c.str === "TME") && r.cells.some((c) => c.str === "Sell"));
    const bucketed = bucketRow(rows[tmeSellIndex]!, header!.columns);
    expect(bucketed.Type).toBe("Trade - Market");
    expect(bucketed.Quantity).toBe("3.29446064");
    expect(parseCurrencyCell(bucketed.Fees!)).toEqual({ currency: "USD", minor: 1 });
    expect(parseCurrencyCell(bucketed.Commission!)).toEqual({ currency: "USD", minor: 8 });
  });

  it("parseCurrencyCell handles comma-thousands, negative, and both currency symbols", () => {
    expect(parseCurrencyCell("US$1,913.50")).toEqual({ currency: "USD", minor: 191350 });
    expect(parseCurrencyCell("-US$0.95")).toEqual({ currency: "USD", minor: -95 });
    expect(parseCurrencyCell("€82.93")).toEqual({ currency: "EUR", minor: 8293 });
    expect(parseCurrencyCell("")).toBeNull();
  });
});
