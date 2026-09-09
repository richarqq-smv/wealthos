// @ts-ignore - pdfjs-dist v6 ships ESM only; this file is imported exclusively by app code bundled via Metro (which handles ESM fine), never directly by Jest — see lib/pdfTable.ts for the pure, pdfjs-independent logic that IS unit-tested, and tests/brokerImport for how the real extraction is verified via a Node subprocess instead.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PdfTextItem } from "./pdfTable";

/**
 * Extracts every page's positioned text runs from a PDF's raw bytes. Kept
 * as the only module in the app that imports pdfjs-dist, so the pure
 * row/column-reconstruction logic in pdfTable.ts stays trivially unit
 * testable without an ESM-capable Jest environment.
 */
export async function extractPdfPages(bytes: Uint8Array): Promise<PdfTextItem[][]> {
  const doc = await getDocument({ data: bytes }).promise;
  const pages: PdfTextItem[][] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items: PdfTextItem[] = [];
    for (const raw of content.items as unknown[]) {
      const item = raw as { str?: string; transform?: number[] };
      if (typeof item.str !== "string" || item.str.trim().length === 0 || !item.transform) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      if (x === undefined || y === undefined) continue;
      items.push({ str: item.str, x, y });
    }
    pages.push(items);
  }
  return pages;
}
