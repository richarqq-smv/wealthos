import { readFileSync } from "fs";
import { join } from "path";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildImportPreview } from "@/features/brokerImport/engine";
import { confirmImport } from "@/features/brokerImport/confirmImport";
import { InvestmentRepository } from "@/lib/repositories/InvestmentRepository";
import { InvestmentTransactionRepository } from "@/lib/repositories/InvestmentTransactionRepository";
import type { PdfTextItem } from "@/lib/pdfTable";
import type { PickedFile } from "@/features/brokerImport/types";

// Sanitized copies (see fixtures/revolut/README.md) — see engine.test.ts's identical comment for why the raw .pdf bytes being placeholders is safe here.
const fixturesDir = join(__dirname, "fixtures", "revolut", "sanitized");

function loadPageItems(fixtureName: string): PdfTextItem[][] {
  return JSON.parse(readFileSync(join(fixturesDir, `${fixtureName}.pdf.items.json`), "utf8")) as PdfTextItem[][];
}

jest.mock("@/lib/pdfExtract", () => ({ extractPdfPages: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { extractPdfPages } = require("@/lib/pdfExtract") as { extractPdfPages: jest.Mock };

const ACCOUNT_STATEMENT_PAGES = loadPageItems("account-statement");
const PNL_STATEMENT_PAGES = loadPageItems("pnl-statement");
const accountBytesBase64 = readFileSync(join(fixturesDir, "account-statement.pdf")).toString("base64");

beforeEach(async () => {
  await AsyncStorage.clear();
  extractPdfPages.mockReset();
  extractPdfPages.mockImplementation(async (bytes: Uint8Array) => {
    const decoded = Buffer.from(bytes).toString("base64");
    return decoded === accountBytesBase64 ? ACCOUNT_STATEMENT_PAGES : PNL_STATEMENT_PAGES;
  });
});

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

describe("confirmImport — end-to-end persistence against the real 3-file Revolut export", () => {
  it("creates exactly 30 investments (13 open, 17 closed) and persists them via InvestmentRepository", async () => {
    const files = loadRealRevolutFiles();
    const preview = await buildImportPreview("revolut", files, []);
    const result = await confirmImport(preview, []);

    expect(result.investmentsCreated).toBe(30);
    expect(result.investmentsUpdated).toBe(0);

    const investments = await InvestmentRepository.getAll();
    expect(investments).toHaveLength(30);

    const open = investments.filter((inv) => inv.quantity > 0);
    const closed = investments.filter((inv) => inv.quantity === 0);
    expect(open).toHaveLength(13);
    expect(closed).toHaveLength(17);
    expect(closed.every((inv) => inv.closedAt !== undefined)).toBe(true);
    expect(open.every((inv) => inv.closedAt === undefined)).toBe(true);

    const allTransactions = await InvestmentTransactionRepository.getAll();
    expect(allTransactions.length).toBe(preview.counts.new);
  });

  it("gives GOOGL (two accumulating buys, never sold) the exact quantity proven in the forensic review", async () => {
    const files = loadRealRevolutFiles();
    const preview = await buildImportPreview("revolut", files, []);
    await confirmImport(preview, []);

    const investments = await InvestmentRepository.getAll();
    const googl = investments.find((inv) => inv.ticker === "GOOGL");
    expect(googl?.quantity).toBeCloseTo(0.3087324, 6);
  });

  it("gives TKMS (corporate action only, no buy) a nonzero quantity with no fabricated cost basis", async () => {
    const files = loadRealRevolutFiles();
    const preview = await buildImportPreview("revolut", files, []);
    await confirmImport(preview, []);

    const investments = await InvestmentRepository.getAll();
    const tkms = investments.find((inv) => inv.ticker === "TKMS");
    expect(tkms?.quantity).toBeCloseTo(0.3927146, 6);
    expect(tkms?.averagePriceMinor).toBe(0); // No cost basis known — never fabricated, not silently averaged from €0.

    const allTx = await InvestmentTransactionRepository.getAll();
    const tkmsTx = allTx.find((t) => t.investmentId === tkms!.id);
    expect(tkmsTx?.type).toBe("corporate_action");
    expect(tkmsTx?.costBasisKnown).toBe(false);
  });

  it("re-running the exact same import a second time persists zero new transactions (persistent dedup, not just preview-time)", async () => {
    const files = loadRealRevolutFiles();

    const firstPreview = await buildImportPreview("revolut", files, []);
    await confirmImport(firstPreview, []);
    const afterFirst = await InvestmentTransactionRepository.getAll();

    const existingInvestments = await InvestmentRepository.getAll();
    const secondPreview = await buildImportPreview("revolut", files, existingInvestments);
    expect(secondPreview.counts.new).toBe(0);
    expect(secondPreview.counts.duplicate).toBe(secondPreview.counts.totalScanned);

    const result = await confirmImport(secondPreview, existingInvestments);
    expect(result.transactionsCreated).toBe(0);

    const afterSecond = await InvestmentTransactionRepository.getAll();
    expect(afterSecond).toHaveLength(afterFirst.length); // No duplicate transactions were written.
  });
});
