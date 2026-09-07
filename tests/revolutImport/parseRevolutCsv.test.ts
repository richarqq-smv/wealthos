import { parseRevolutCsv, revolutRowFingerprint } from "@/features/revolutImport/parseRevolutCsv";

// Mirrors tests/fixtures/revolut-sample.csv (kept as a standalone file too,
// for manual testing of the actual import screen) — inlined here since this
// project's tsconfig deliberately has no Node ("fs"/"path") types available.
// Synthetic data only, no real banking data.
const SAMPLE_CSV = [
  "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance",
  "CARD_PAYMENT,Current,2026-01-05 09:12:00,2026-01-05 09:12:03,Testwinkel Amsterdam,-24.50,0.00,EUR,COMPLETED,975.50",
  "CARD_PAYMENT,Current,2026-01-06 18:03:11,2026-01-06 18:03:14,Testcafe De Hoek,-8.20,0.00,EUR,COMPLETED,967.30",
  "TOPUP,Current,2026-01-07 08:00:00,2026-01-07 08:00:05,Bank Top-up,500.00,0.00,EUR,COMPLETED,1467.30",
  "CARD_PAYMENT,Current,2026-01-08 12:45:22,2026-01-08 12:45:25,Testsupermarkt,-63.15,0.00,EUR,COMPLETED,1404.15",
].join("\n");

describe("parseRevolutCsv — real-shaped Revolut export (synthetic fixture, no real banking data)", () => {
  it("parses every valid row from the sample export", () => {
    const result = parseRevolutCsv(SAMPLE_CSV);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(4);
    expect(result.skippedRowCount).toBe(0);
  });

  it("preserves sign — negative amounts (spend) and positive amounts (top-up)", () => {
    const result = parseRevolutCsv(SAMPLE_CSV);
    if (!result.ok) throw new Error("expected ok");
    const spend = result.rows.find((r) => r.description === "Testwinkel Amsterdam");
    const topup = result.rows.find((r) => r.description === "Bank Top-up");
    expect(spend?.amountMinor).toBe(-2450);
    expect(topup?.amountMinor).toBe(50000);
  });

  it("converts Revolut's 'YYYY-MM-DD HH:mm:ss' date format to a real ISO timestamp", () => {
    const result = parseRevolutCsv(SAMPLE_CSV);
    if (!result.ok) throw new Error("expected ok");
    const row = result.rows[0]!;
    expect(new Date(row.date).getTime()).not.toBeNaN();
    expect(row.date).toBe(new Date(row.date).toISOString());
  });

  it("reads the Currency column", () => {
    const result = parseRevolutCsv(SAMPLE_CSV);
    if (!result.ok) throw new Error("expected ok");
    expect(result.rows.every((r) => r.currency === "EUR")).toBe(true);
  });
});

describe("parseRevolutCsv — column-name tolerance across Revolut export variants", () => {
  it("accepts an older-style export using 'Started Date' with no Currency column", () => {
    const csv = ["Type,Started Date,Description,Amount", "CARD_PAYMENT,2026-02-01 10:00:00,Coffee Shop,-3.50"].join(
      "\n"
    );
    const result = parseRevolutCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.currency).toBe("");
  });

  it("is case-insensitive and tolerant of column order", () => {
    const csv = ["Amount,Description,DATE", "-10.00,Late Night Snack,2026-02-02"].join("\n");
    const result = parseRevolutCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0]?.description).toBe("Late Night Snack");
  });

  it("handles quoted description fields containing commas", () => {
    const csv = ['Date,Description,Amount', '2026-02-03,"Shop, Inc.",-5.00'].join("\n");
    const result = parseRevolutCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0]?.description).toBe("Shop, Inc.");
  });
});

describe("parseRevolutCsv — rejection of unrecognized files (never a partial/guessed import)", () => {
  it("rejects an empty file", () => {
    const result = parseRevolutCsv("");
    expect(result).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects a header-only file with no data rows", () => {
    const result = parseRevolutCsv("Type,Description,Amount");
    expect(result).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects a CSV with no recognizable date/description/amount columns", () => {
    const csv = ["Foo,Bar,Baz", "1,2,3"].join("\n");
    const result = parseRevolutCsv(csv);
    expect(result).toEqual({ ok: false, reason: "unrecognized-columns" });
  });

  it("rejects a completely unrelated CSV (e.g. an investment export) rather than guessing", () => {
    const csv = ["Ticker,Shares,Price", "AAPL,10,150.00"].join("\n");
    const result = parseRevolutCsv(csv);
    expect(result).toEqual({ ok: false, reason: "unrecognized-columns" });
  });
});

describe("parseRevolutCsv — tolerant of malformed individual rows, never crashes", () => {
  it("skips a row with an unparseable date and still returns the valid rows", () => {
    const csv = [
      "Date,Description,Amount",
      "not-a-date,Bad Row,-1.00",
      "2026-02-04,Good Row,-2.00",
    ].join("\n");
    const result = parseRevolutCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
    expect(result.skippedRowCount).toBe(1);
    expect(result.rows[0]?.description).toBe("Good Row");
  });

  it("skips a row with a non-numeric amount (NaN) instead of importing garbage", () => {
    const csv = ["Date,Description,Amount", "2026-02-05,Broken Amount,not-a-number"].join("\n");
    const result = parseRevolutCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(0);
    expect(result.skippedRowCount).toBe(1);
  });

  it("skips a row whose amount is Infinity", () => {
    const csv = ["Date,Description,Amount", "2026-02-06,Overflow,1e999"].join("\n");
    const result = parseRevolutCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(0);
    expect(result.skippedRowCount).toBe(1);
  });

  it("skips a row with an empty description", () => {
    const csv = ["Date,Description,Amount", "2026-02-07,,-5.00"].join("\n");
    const result = parseRevolutCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(0);
  });

  it("silently skips blank lines without counting them as errors", () => {
    const csv = ["Date,Description,Amount", "2026-02-08,Real Row,-5.00", "", "  "].join("\n");
    const result = parseRevolutCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
    expect(result.skippedRowCount).toBe(0);
  });
});

describe("revolutRowFingerprint — duplicate-import detection", () => {
  it("produces the same fingerprint for the same date/amount/description", () => {
    const a = revolutRowFingerprint({ date: "2026-01-05T09:12:00.000Z", amountMinor: -2450, description: "Testwinkel Amsterdam" });
    const b = revolutRowFingerprint({ date: "2026-01-05T09:12:00.000Z", amountMinor: -2450, description: "Testwinkel Amsterdam" });
    expect(a).toBe(b);
  });

  it("is case- and whitespace-insensitive on description, so re-exporting the same CSV never double-imports", () => {
    const a = revolutRowFingerprint({ date: "2026-01-05T09:12:00.000Z", amountMinor: -2450, description: "Testwinkel Amsterdam" });
    const b = revolutRowFingerprint({ date: "2026-01-05T09:12:00.000Z", amountMinor: -2450, description: "  testwinkel amsterdam  " });
    expect(a).toBe(b);
  });

  it("differs when the amount differs", () => {
    const a = revolutRowFingerprint({ date: "2026-01-05T09:12:00.000Z", amountMinor: -2450, description: "Testwinkel Amsterdam" });
    const b = revolutRowFingerprint({ date: "2026-01-05T09:12:00.000Z", amountMinor: -2451, description: "Testwinkel Amsterdam" });
    expect(a).not.toBe(b);
  });
});
