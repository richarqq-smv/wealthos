export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
}

export interface PdfRow {
  y: number;
  cells: PdfTextItem[];
}

/**
 * Pure geometry/table-reconstruction logic — deliberately has ZERO
 * dependency on pdfjs-dist (see lib/pdfExtract.ts for the one module that
 * imports it), so this whole file stays unit-testable in a plain CommonJS
 * Jest environment. Revolut's statements are real multi-column tables laid
 * out by absolute x/y text-run position, not a linear text stream — the
 * functions below turn PDF.js's raw positioned text runs into rows/columns,
 * verified against the real account-statement and pnl-statement PDFs during
 * development (see tests/brokerImport/revolut/*.test.ts).
 */

/** Groups a page's text items into visual rows by rounded y-coordinate — items on the same printed line always share (near-)identical y in PDF.js's output, verified against real Revolut statements. */
export function groupIntoRows(items: PdfTextItem[]): PdfRow[] {
  const rows = new Map<number, PdfTextItem[]>();
  for (const item of items) {
    const y = Math.round(item.y);
    const arr = rows.get(y) ?? [];
    arr.push(item);
    rows.set(y, arr);
  }
  return Array.from(rows.entries())
    .sort((a, b) => b[0] - a[0]) // top of page first
    .map(([y, cells]) => ({ y, cells: cells.sort((a, b) => a.x - b.x) }));
}

export interface TableColumn {
  label: string;
  x: number;
}

/**
 * Finds the header row containing every one of `expectedLabels` (matched
 * case-insensitively, substring match so e.g. "Fees" matches a header cell
 * exactly "Fees") and returns each label's x-position, which becomes the
 * column boundary for every following row until `isTableEnd` returns true.
 */
export function findTableHeader(
  rows: PdfRow[],
  expectedLabels: string[],
  startIndex = 0
): { headerIndex: number; columns: TableColumn[] } | null {
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i]!;
    const columns: TableColumn[] = [];
    for (const label of expectedLabels) {
      const cell = row.cells.find((c) => c.str.trim().toLowerCase() === label.toLowerCase());
      if (!cell) break;
      columns.push({ label, x: cell.x });
    }
    if (columns.length === expectedLabels.length) {
      return { headerIndex: i, columns: columns.sort((a, b) => a.x - b.x) };
    }
  }
  return null;
}

/**
 * Buckets one row's text items into the nearest column by x-position
 * (nearest-boundary, not exact match — right-aligned numeric cells drift a
 * few points depending on digit count, verified against real fee columns
 * like "US$0.15" vs "US$1.10" landing at slightly different x). Cells that
 * land in the same bucket (rare — only happens for long wrapped text) are
 * joined with a space, in encounter order.
 */
export function bucketRow(row: PdfRow, columns: TableColumn[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const column of columns) result[column.label] = "";

  for (const item of row.cells) {
    let nearest = columns[0]!;
    let nearestDistance = Math.abs(item.x - nearest.x);
    for (const column of columns) {
      const distance = Math.abs(item.x - column.x);
      if (distance < nearestDistance) {
        nearest = column;
        nearestDistance = distance;
      }
    }
    result[nearest.label] = result[nearest.label] ? `${result[nearest.label]} ${item.str}` : item.str;
  }
  return result;
}

/** "US$1,913.50" / "€82.93" / "-US$0.95" -> minor units. Returns null for an empty/unparseable cell — never a silent 0. */
export function parseCurrencyCell(cell: string): { currency: string; minor: number } | null {
  const trimmed = cell.trim();
  if (!trimmed) return null;
  const match = /^(-?)(US\$|€|£)([\d,]+(?:\.\d+)?)$/.exec(trimmed);
  if (!match) return null;
  const [, sign, symbol, numberPart] = match;
  const currency = symbol === "US$" ? "USD" : symbol === "€" ? "EUR" : "GBP";
  const amount = Number(numberPart!.replace(/,/g, ""));
  if (!Number.isFinite(amount)) return null;
  return { currency, minor: Math.round((sign === "-" ? -amount : amount) * 100) };
}
