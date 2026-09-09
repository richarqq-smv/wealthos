import type { NormalizedBrokerTransaction } from "./types";

/**
 * Join key for matching the "same real-world transaction" as it appears in
 * different files from the same broker. Deliberately NOT the same as the
 * dedup fingerprint (fingerprint.ts) — that one exists to detect
 * re-importing the same file twice; this one exists to merge two
 * *different* files describing the same event within a single import.
 *
 * Uses DAY granularity, not seconds — proven necessary because Revolut's
 * three real sources report timestamps at three different resolutions
 * (ledger CSV: full fractional-second ISO; account-statement PDF: whole
 * seconds in a human-readable format; pnl-statement PDF: date only, no time
 * at all) and day is the coarsest common denominator across all of them.
 * `quantity` still has to match too — this is what correctly keeps a
 * multi-lot FIFO split (one ledger sell trade closing two pnl-statement
 * lots at different quantities, e.g. the real CVX case) from being
 * incorrectly merged into one row; each lot simply stays its own row when
 * quantities don't line up exactly with any single ledger row.
 */
function joinKey(row: NormalizedBrokerTransaction): string {
  const day = new Date(row.timestamp).toISOString().slice(0, 10); // YYYY-MM-DD, robust across ISO/RFC-2822/date-only inputs
  return [day, (row.ticker ?? "").toUpperCase(), row.type, row.quantity ?? ""].join("|");
}

export interface ReconcileConflict {
  field: string;
  values: unknown[];
  joinKey: string;
}

/**
 * Merges normalized rows from multiple files of the same broker/import into
 * one row per real transaction. `pickField` lets each adapter apply its own
 * source-of-truth priority (e.g. Revolut: CSV wins for timestamp precision,
 * PDF wins for fees/ISIN) — this function only owns the grouping and
 * conflict surfacing, never silently picks a winner on its own.
 */
export function reconcileRows(
  rowsByFile: NormalizedBrokerTransaction[][],
  pickField: <K extends keyof NormalizedBrokerTransaction>(
    field: K,
    candidates: NormalizedBrokerTransaction[]
  ) => NormalizedBrokerTransaction[K]
): { rows: NormalizedBrokerTransaction[]; conflicts: ReconcileConflict[] } {
  const groups = new Map<string, NormalizedBrokerTransaction[]>();

  for (const fileRows of rowsByFile) {
    for (const row of fileRows) {
      const key = joinKey(row);
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }
  }

  const rows: NormalizedBrokerTransaction[] = [];
  const conflicts: ReconcileConflict[] = [];

  for (const [key, group] of groups) {
    if (group.length === 1) {
      rows.push(group[0]!);
      continue;
    }

    const merged: NormalizedBrokerTransaction = { ...group[0]! };
    const fields = Object.keys(merged) as Array<keyof NormalizedBrokerTransaction>;
    for (const field of fields) {
      const values = group.map((r) => r[field]);
      const distinct = new Set(values.filter((v) => v !== null && v !== undefined));
      if (distinct.size > 1) {
        conflicts.push({ field: String(field), values: Array.from(distinct), joinKey: key });
      }
      (merged as unknown as Record<string, unknown>)[field] = pickField(field, group);
    }
    merged.sourceFile = group.map((r) => r.sourceFile).join(", ");
    rows.push(merged);
  }

  return { rows, conflicts };
}
