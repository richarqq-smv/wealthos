import * as XLSX from "xlsx";
import { parseRevolutAccountStatementXlsx } from "@/features/brokerImport/revolut/parseAccountStatementXlsx";

/**
 * NOTE ON CONFIDENCE: unlike the CSV/PDF parser tests, there is no real
 * Revolut .xlsx export available to test against (see the module's own doc
 * comment — the column structure is an unverified-but-reasonable
 * assumption). This test proves the parsing MECHANICS are correct (reading
 * a real workbook built with the same `xlsx` library, same header/row
 * shape as the proven CSV) — it does not, and cannot yet, prove Revolut's
 * actual Excel export matches this exact layout.
 */
function buildWorkbook(rows: (string | number)[][]): Uint8Array {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Date", "Ticker", "Type", "Quantity", "Price per share", "Total Amount", "Currency", "FX Rate"],
    ...rows,
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const out = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new Uint8Array(out);
}

describe("parseRevolutAccountStatementXlsx", () => {
  it("parses buy/sell/dividend rows and skips cash rows, matching the CSV parser's row semantics", () => {
    const bytes = buildWorkbook([
      ["2025-03-21T16:41:53.965312Z", "", "CASH TOP-UP", "", "", "USD 110.64", "USD", "1.0843"],
      ["2025-03-21T16:41:54.428Z", "TTWO", "BUY - MARKET", "0.5", "USD 210.82", "USD 105.41", "USD", "1.0843"],
      ["2025-09-08T14:08:20.206Z", "TME", "SELL - MARKET", "3.29446064", "USD 24.52", "USD 80.69", "USD", "1.1776"],
      ["2025-05-14T09:25:04.989935Z", "TXN", "DIVIDEND", "", "", "USD 0.08", "USD", "1.1284"],
    ]);

    const result = parseRevolutAccountStatementXlsx(bytes, "account-statement.xlsx");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.skippedCashRows).toBe(1);
    expect(result.rows).toHaveLength(3);
    const buy = result.rows.find((r) => r.type === "buy");
    expect(buy?.ticker).toBe("TTWO");
    expect(buy?.grossAmountMinor).toBe(10541);
    const sell = result.rows.find((r) => r.type === "sell");
    expect(sell?.netAmountMinor).toBe(8069);
  });

  it("rejects a workbook with the wrong columns instead of guessing", () => {
    const sheet = XLSX.utils.aoa_to_sheet([["Ticker", "Shares", "Price"], ["AAPL", 10, 150]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
    const bytes = new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" }));

    const result = parseRevolutAccountStatementXlsx(bytes, "wrong.xlsx");
    expect(result.ok).toBe(false);
  });
});
