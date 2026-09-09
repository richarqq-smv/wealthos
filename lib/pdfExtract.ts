import type { PdfTextItem } from "./pdfTable";

/**
 * Type-resolution fallback only. `tsc` doesn't apply Metro's own platform-
 * extension precedence (`.web.ts` / `.native.ts` beating a bare `.ts`), so
 * this bare-named file exists purely to give `@/lib/pdfExtract` a real
 * module for `tsc` to resolve. Metro itself ALWAYS prefers
 * `pdfExtract.web.ts` (web, and Electron desktop — itself a wrapped web
 * export) or `pdfExtract.native.ts` (Android/iOS) over this file at actual
 * bundle time on every platform WealthOS ships — this implementation never
 * runs in a real build.
 */
export async function extractPdfPages(_bytes: Uint8Array): Promise<PdfTextItem[][]> {
  throw new Error("extractPdfPages: platform-specific implementation not resolved (this bare fallback should never run).");
}
