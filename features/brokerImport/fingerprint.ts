import type { NormalizedBrokerTransaction } from "./types";

/**
 * Composite dedup key: full timestamp + isin-or-ticker + type + quantity +
 * price + currency. No Revolut or DEGIRO export carries a real transaction
 * ID, so this is the only option — and it has to be this specific, because
 * two genuine transactions in the real Revolut dataset this was built
 * against share the exact same *second* (only distinguishable at
 * millisecond precision): 2025-03-24T13:30:01.052Z (NOC buy) and
 * 2025-03-24T13:30:01.451Z (TXN buy). A coarser key (e.g. date+amount, the
 * existing cash-CSV-importer's approach) would collide here.
 *
 * Deliberately a pure, synchronous string function — no hashing library
 * needed, and a plain string is trivial to persist/compare/test.
 */
export function computeImportFingerprint(row: NormalizedBrokerTransaction): string {
  const identity = row.isin ?? row.ticker ?? "";
  const parts = [
    row.timestamp,
    identity,
    row.type,
    row.quantity ?? "",
    row.priceMinor ?? "",
    row.currency,
  ];
  return parts.join("|");
}

export interface DedupResult {
  newRows: NormalizedBrokerTransaction[];
  duplicateRows: NormalizedBrokerTransaction[];
}

/** Pure — the caller (engine.ts) is responsible for loading `alreadyImported` from ImportedFingerprintStore and persisting the new set after confirmation. */
export function partitionByFingerprint(
  rows: NormalizedBrokerTransaction[],
  alreadyImported: ReadonlySet<string>
): DedupResult {
  const newRows: NormalizedBrokerTransaction[] = [];
  const duplicateRows: NormalizedBrokerTransaction[] = [];
  const seenThisBatch = new Set<string>();

  for (const row of rows) {
    const fp = computeImportFingerprint(row);
    if (alreadyImported.has(fp) || seenThisBatch.has(fp)) {
      duplicateRows.push(row);
    } else {
      newRows.push(row);
      seenThisBatch.add(fp);
    }
  }
  return { newRows, duplicateRows };
}
