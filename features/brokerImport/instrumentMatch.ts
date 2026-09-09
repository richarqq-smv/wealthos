import type { Investment } from "@/types/models";
import { StorageKeys, readValue, writeValue } from "@/lib/storage";
import type { NormalizedBrokerTransaction } from "./types";

/** ticker+currency composite key, e.g. "SAP|USD" vs "SAP|EUR" — the exact case the forensic review proved matters: Revolut's "SAP" is the US ADR (USD), not the Xetra share (EUR), and only the currency-qualified key keeps them apart when ISIN isn't present on a given row. */
function tickerKey(ticker: string, currency: string): string {
  return `${ticker.toUpperCase()}|${currency.toUpperCase()}`;
}

export const TickerIsinMap = {
  async getAll(): Promise<Record<string, string>> {
    return (await readValue<Record<string, string>>(StorageKeys.tickerIsinMap)) ?? {};
  },

  /** Learns from any rows that DO carry an ISIN — called once per import, after normalization. */
  async learnFrom(rows: NormalizedBrokerTransaction[]): Promise<void> {
    const learnable = rows.filter((r) => r.isin && r.ticker);
    if (learnable.length === 0) return;
    const map = await this.getAll();
    let changed = false;
    for (const row of learnable) {
      const key = tickerKey(row.ticker!, row.currency);
      if (map[key] !== row.isin) {
        map[key] = row.isin!;
        changed = true;
      }
    }
    if (changed) await writeValue(StorageKeys.tickerIsinMap, map);
  },

  async lookup(ticker: string, currency: string): Promise<string | null> {
    const map = await this.getAll();
    return map[tickerKey(ticker, currency)] ?? null;
  },
};

/**
 * Resolves the ISIN to use for matching, preferring the row's own value
 * (most authoritative — e.g. the account-statement PDF's portfolio
 * breakdown, or the pnl-statement's Sells table) and falling back to the
 * learned ticker+currency map for rows that never carry one (Revolut's
 * ledger CSV structurally never has ISIN — see the forensic review).
 */
export async function resolveIsin(row: NormalizedBrokerTransaction): Promise<string | null> {
  if (row.isin) return row.isin;
  if (!row.ticker) return null;
  return TickerIsinMap.lookup(row.ticker, row.currency);
}

export interface InstrumentMatchResult {
  investmentId: string | null;
  /** True when no ISIN could be resolved at all (neither on the row nor in the learned map) — matching fell back to ticker+currency alone, which the SAP-ADR case proves can be wrong. Surfaced as a preview warning, never silently accepted as certain. */
  matchedByTickerOnly: boolean;
}

/**
 * ISIN-first instrument matching against the user's existing Investments.
 * Never matches on ticker alone when an ISIN is known for either side —
 * that's precisely the ambiguity the SAP case (US ADR vs Xetra share, same
 * ticker, different ISIN/currency/exchange) proved unsafe.
 */
export async function matchInstrument(
  row: NormalizedBrokerTransaction,
  existingInvestments: Investment[]
): Promise<InstrumentMatchResult> {
  const isin = await resolveIsin(row);

  if (isin) {
    const byIsin = existingInvestments.find((inv) => inv.isin === isin);
    if (byIsin) return { investmentId: byIsin.id, matchedByTickerOnly: false };
    // A resolved ISIN with no existing match means "create a new Investment"
    // — never fall through to a ticker-only guess once an ISIN is known.
    return { investmentId: null, matchedByTickerOnly: false };
  }

  if (!row.ticker) return { investmentId: null, matchedByTickerOnly: false };
  const candidates = existingInvestments.filter(
    (inv) => !inv.isin && inv.ticker.toUpperCase() === row.ticker!.toUpperCase() && inv.currency === row.currency
  );
  if (candidates.length === 1) return { investmentId: candidates[0]!.id, matchedByTickerOnly: true };
  return { investmentId: null, matchedByTickerOnly: true };
}
