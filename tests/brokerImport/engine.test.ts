import { readFileSync } from "fs";
import { join } from "path";
import { buildImportPreview } from "@/features/brokerImport/engine";
import type { PickedFile } from "@/features/brokerImport/types";
import type { Investment } from "@/types/models";
import type { PdfTextItem } from "@/lib/pdfTable";

// Sanitized copies (see fixtures/revolut/README.md): real name/address/
// account-number replaced with placeholders; the raw .pdf bytes here are
// minimal placeholder PDFs (never actually parsed — @/lib/pdfExtract is
// mocked below, they're only used as an opaque base64 lookup key), while
// the .items.json files carry the real, byte-identical table geometry.
const fixturesDir = join(__dirname, "fixtures", "revolut", "sanitized");

function loadPageItems(fixtureName: string): PdfTextItem[][] {
  return JSON.parse(readFileSync(join(fixturesDir, `${fixtureName}.pdf.items.json`), "utf8")) as PdfTextItem[][];
}

/**
 * pdfjs-dist is ESM-only and cannot load under Jest's CJS transform (see
 * lib/pdfExtract.ts's doc comment and lib/pdfTable.ts). This engine test
 * therefore mocks the one module that imports it, returning the same
 * statically-extracted real-PDF geometry the dedicated parser tests already
 * verified in isolation — so this test still exercises the FULL real
 * pipeline (detection, both real parsers, reconciliation, dedup, instrument
 * matching, warnings) on real Revolut-derived data, just without re-running
 * pdfjs itself a second time.
 */
jest.mock("@/lib/pdfExtract", () => ({
  extractPdfPages: jest.fn(),
}));

// Also used by the adapter's own PDF-kind resolution (reads page-1 title text).
const ACCOUNT_STATEMENT_PAGES = loadPageItems("account-statement");
const PNL_STATEMENT_PAGES = loadPageItems("pnl-statement");
const COSTS_AND_CHARGES_PAGES = loadPageItems("costs-and-charges");

function loadRealRevolutFiles(): PickedFile[] {
  const csv = readFileSync(join(fixturesDir, "account-statement.csv"), "utf8");
  const accountPdf = readFileSync(join(fixturesDir, "account-statement.pdf"));
  const pnlPdf = readFileSync(join(fixturesDir, "pnl-statement.pdf"));
  return [
    { name: "account-statement.csv", content: csv, encoding: "utf8" },
    { name: "account-statement.pdf", content: accountPdf.toString("base64"), encoding: "base64" },
    { name: "pnl-statement.pdf", content: pnlPdf.toString("base64"), encoding: "base64" },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { extractPdfPages } = require("@/lib/pdfExtract") as { extractPdfPages: jest.Mock };

function pageBytesFor(fixtureName: string): string {
  return readFileSync(join(fixturesDir, `${fixtureName}.pdf`)).toString("base64");
}

beforeEach(() => {
  extractPdfPages.mockReset();
  // Each real PDF's title text ("Account Statement" vs "Profit and Loss
  // Statement" vs "Costs and Charges Report") is what the adapter's
  // resolvePdfKind() reads from page 1 — every fixture is queried for
  // kind-resolution AND full parsing, so the mock must answer correctly
  // regardless of call order/count, not just once.
  extractPdfPages.mockImplementation(async (bytes: Uint8Array) => {
    const decoded = Buffer.from(bytes).toString("base64");
    if (decoded === pageBytesFor("account-statement")) return ACCOUNT_STATEMENT_PAGES;
    if (decoded === pageBytesFor("costs-and-charges")) return COSTS_AND_CHARGES_PAGES;
    return PNL_STATEMENT_PAGES;
  });
});

describe("buildImportPreview — end-to-end against the real 3-file Revolut export", () => {
  const noExistingInvestments: Investment[] = [];

  it("detects all three real files by content, not filename", async () => {
    const files = loadRealRevolutFiles();
    const preview = await buildImportPreview("revolut", files, noExistingInvestments);
    expect(preview.warnings.some((w) => w.kind === "unsupportedFile")).toBe(false);
  });

  it("reconciles CSV + both PDFs into rows carrying fees, ISIN, and broker-reported realized P&L all at once", async () => {
    const files = loadRealRevolutFiles();
    const preview = await buildImportPreview("revolut", files, noExistingInvestments);

    const tmeSell = preview.rows.find((r) => r.row.ticker === "TME" && r.row.type === "sell");
    expect(tmeSell).toBeDefined();
    // From the CSV/account-statement PDF: precise timestamp + sell-side commission. From the pnl-statement PDF: total round-trip Fees (buy+sell combined — see the CVX multi-lot proof), realized P&L/cost basis/ISIN.
    expect(tmeSell!.row.timestampPrecision).toBe("exact");
    expect(tmeSell!.row.feesMinor).toBe(15); // pnl-statement's total round-trip fee for this closed lot ($0.15), not the account-statement PDF's sell-side-only $0.01.
    expect(tmeSell!.row.commissionMinor).toBe(8); // pnl-statement doesn't split commission separately — backfilled from the account-statement PDF's sell-side commission.
    expect(tmeSell!.row.realizedPnlMinor).toBe(2428);
    expect(tmeSell!.row.costBasisMinor).toBe(5650);
    expect(tmeSell!.row.isin).toBe("US88034P1093");
    expect(tmeSell!.row.pnlSource).toBe("broker-reported");
  });

  it("surfaces the TKMS corporate action as a preview warning with unknown cost basis, never a silent €0", async () => {
    const files = loadRealRevolutFiles();
    const preview = await buildImportPreview("revolut", files, noExistingInvestments);

    const tkms = preview.rows.find((r) => r.row.ticker === "TKMS");
    expect(tkms).toBeDefined();
    expect(tkms!.row.type).toBe("corporate_action");
    expect(tkms!.row.costBasisKnown).toBe(false);
    expect(preview.warnings.some((w) => w.kind === "unknownCostBasis" && w.message.includes("TKMS"))).toBe(true);
  });

  it("counts buy/sell/dividend/corporate_action matching the forensic review exactly", async () => {
    const files = loadRealRevolutFiles();
    const preview = await buildImportPreview("revolut", files, noExistingInvestments);
    expect(preview.counts.sell).toBe(18);
    expect(preview.counts.dividend).toBe(36);
    expect(preview.counts.correctiveAction).toBe(1);
    expect(preview.counts.duplicate).toBe(0); // First import — nothing persisted yet.
  });

  it("marks every row as a new instrument when no existing Investments exist yet", async () => {
    const files = loadRealRevolutFiles();
    const preview = await buildImportPreview("revolut", files, noExistingInvestments);
    expect(preview.rows.every((r) => r.isNewInstrument)).toBe(true);
  });

  it("matches to an existing Investment by ISIN when one already exists, never by ticker alone once ISIN is known", async () => {
    const files = loadRealRevolutFiles();
    const existing: Investment[] = [
      {
        id: "existing-tme",
        name: "Tencent Music Entertainment Group",
        ticker: "TME",
        isin: "US88034P1093",
        type: "stock",
        quantity: 0,
        averagePriceMinor: 0,
        currentPriceMinor: 0,
        currency: "USD",
        broker: "Revolut",
        purchaseDate: "2025-06-02T00:00:00.000Z",
        origin: "synced",
        createdAt: "2025-06-02T00:00:00.000Z",
        updatedAt: "2025-06-02T00:00:00.000Z",
      },
    ];
    const preview = await buildImportPreview("revolut", files, existing);
    const tmeSell = preview.rows.find((r) => r.row.ticker === "TME" && r.row.type === "sell");
    expect(tmeSell!.matchedInvestmentId).toBe("existing-tme");
    expect(tmeSell!.matchedByTickerOnly).toBe(false);
    expect(tmeSell!.isNewInstrument).toBe(false);
  });

  it("returns the 13 current holdings from the account-statement PDF's portfolio breakdown", async () => {
    const files = loadRealRevolutFiles();
    const preview = await buildImportPreview("revolut", files, noExistingInvestments);
    expect(preview.currentHoldings).toHaveLength(13);
  });

  it("recognizes the real costs-and-charges report (the 5th original export file) but warns that it contributes nothing, rather than staying silent", async () => {
    const costsPdf = readFileSync(join(fixturesDir, "costs-and-charges.pdf"));
    const files: PickedFile[] = [...loadRealRevolutFiles(), { name: "costs-and-charges.pdf", content: costsPdf.toString("base64"), encoding: "base64" }];

    const preview = await buildImportPreview("revolut", files, noExistingInvestments);

    // It's recognized by content (never flagged as an unrecognized file)...
    expect(preview.warnings.some((w) => w.message.includes("bestandstype niet herkend"))).toBe(false);
    // ...but explicitly warns the user it produced nothing, rather than silently doing so.
    const ignoredWarning = preview.warnings.find((w) => w.message.includes("costs-and-charges.pdf"));
    expect(ignoredWarning).toBeDefined();
    expect(ignoredWarning!.kind).toBe("unsupportedFile");
    // And it genuinely contributes zero rows — counts are unchanged from the 3-file case.
    expect(preview.counts.sell).toBe(18);
    expect(preview.counts.dividend).toBe(36);
  });
});
