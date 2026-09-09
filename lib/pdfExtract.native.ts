import type { PdfTextItem } from "./pdfTable";

/**
 * PDF-based broker import (Revolut's Winst- & verliesrekening) is web/
 * Electron-only — see the doc comment on `pdfExtract.web.ts` for why
 * pdfjs-dist can't be bundled for Android/iOS at all. The Revolut CSV/Excel
 * import path never calls this and is fully unaffected; the broker-import
 * screen already catches any thrown error here as a normal, user-facing
 * "kon dit bestand niet verwerken" message (see app/import/revolut.tsx) — no
 * data is invented and nothing crashes.
 */
export async function extractPdfPages(_bytes: Uint8Array): Promise<PdfTextItem[][]> {
  throw new Error(
    "PDF-import wordt niet ondersteund op dit platform. Gebruik de CSV- of Excel-export van je Rekeningoverzicht."
  );
}
