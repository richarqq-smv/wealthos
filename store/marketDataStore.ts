import { create } from "zustand";
import type { Investment } from "@/types/models";
import type { MarketDataErrorKind, MarketQuote } from "@/types/marketData";
import { MarketDataCacheRepository } from "@/lib/repositories/MarketDataCacheRepository";
import { MarketDataService } from "@/services/market/MarketDataService";
import { useInvestmentsStore } from "@/store/investmentsStore";
import { marketDataInstrumentKey } from "@/types/marketData";
import { EMPTY_REFRESH_STATUS, type RefreshStatus } from "@/lib/marketData/liveStatus";
import { nowISO } from "@/utils/date";

/**
 * Writes a fetched quote back into the matching investment's stored price so
 * the existing (untouched) 0.1.0 net-worth/portfolio calculations pick it up
 * automatically — no separate "live value" codepath needed elsewhere in the
 * app. Only touches positions the user explicitly linked to live data.
 *
 * QUOTE CURRENCY (what the provider returns, e.g. USD for a BTC/USD quote)
 * and POSITION CURRENCY (`investment.currency`, e.g. EUR) are two different
 * things and are never conflated: when they differ, the quote's price is
 * converted into the position's own currency via
 * `MarketDataService.convertQuotePrice` (the existing FX cache/provider —
 * see rule #12/60, no second FX system) BEFORE it is ever written to
 * `currentPriceMinor`. That field's existing invariant — always denominated
 * in `investment.currency` — is exactly what every downstream calculation
 * (`calculateInvestmentValue`, P&L, portfolio/net-worth totals) already
 * assumes, so nothing downstream needs to change. If no valid FX rate is
 * available (offline, rate-limited, no key, no cache), the position is left
 * untouched at its last known, correctly-denominated value — never a
 * silent 1:1, never a wrong-currency number.
 */
async function applyQuoteToInvestments(quote: MarketQuote): Promise<void> {
  const { investments, editInvestment } = useInvestmentsStore.getState();
  const matches = investments.filter(
    (inv) =>
      inv.liveDataEnabled &&
      inv.providerSymbol === quote.providerSymbol &&
      // Same ticker on a different exchange (e.g. a NASDAQ ADR vs a Euronext
      // listing) is a different instrument — never cross-apply its price.
      (inv.exchange ?? "") === (quote.exchange ?? "")
  );
  for (const investment of matches) {
    const priceMinor = await MarketDataService.convertQuotePrice(quote, investment.currency);
    if (priceMinor === null) continue;
    await editInvestment(investment.id, {
      currentPriceMinor: priceMinor,
      priceUpdatedAt: quote.timestamp,
    });
  }
}

/**
 * Per-instrument in-flight tracker for `refreshOne` (module-level, not part
 * of Zustand state — nothing in the UI needs to render off it). `refreshAll`
 * already has its own `isRefreshing` guard, but that flag is never set by
 * `refreshOne`, so without this a rapid double-click of the investment-detail
 * refresh button — or a manual refresh landing next to an auto-refresh tick —
 * could fire two concurrent requests for the same symbol. Keyed by instrument
 * (`symbol@exchange`), not by investment id, so two different instruments can
 * still refresh at the same time; always cleared in `finally` so a thrown
 * error can never leave an instrument permanently locked out.
 */
const inFlightInstrumentRefreshes = new Set<string>();

interface MarketDataState {
  quotesBySymbol: Record<string, MarketQuote>;
  /** Per-instrument (`symbol@exchange`) refresh bookkeeping — the only source `deriveLiveStatus` may read from. Never derive "live" from cache age alone. */
  statusByInstrument: Record<string, RefreshStatus>;
  isRefreshing: boolean;
  lastError: MarketDataErrorKind | null;
  /** When the next automatic refresh tick is expected — set by useMarketDataAutoRefresh, read by any UI that wants a countdown. Null when auto-refresh is off. */
  nextRefreshAt: string | null;
  loadCachedQuotes: () => Promise<void>;
  /** Returns whether at least one quote was genuinely fetched this cycle — the only honest basis for bumping a "last successful update" timestamp. */
  refreshAll: (investments: Investment[]) => Promise<{ hadSuccess: boolean }>;
  refreshOne: (investment: Investment) => Promise<void>;
  setNextRefreshAt: (iso: string | null) => void;
  /** For call sites that fetch outside `refreshAll`/`refreshOne` (the FX detail screen, via `getFxRate`) but still need to report honest status through the exact same `deriveLiveStatus` machinery — never poke `statusByInstrument` directly. */
  recordInstrumentAttempt: (instrumentKey: string) => void;
  recordInstrumentResult: (instrumentKey: string, result: { success: true } | { success: false; error: MarketDataErrorKind }) => void;
}

function markAttempted(status: Record<string, RefreshStatus>, instrumentKey: string, at: string): void {
  const current = status[instrumentKey] ?? EMPTY_REFRESH_STATUS;
  status[instrumentKey] = { ...current, lastAttemptAt: at };
}

function markSucceeded(status: Record<string, RefreshStatus>, instrumentKey: string, at: string): void {
  status[instrumentKey] = { lastAttemptAt: at, lastSuccessAt: at, lastErrorKind: null };
}

function markFailed(status: Record<string, RefreshStatus>, instrumentKey: string, at: string, error: MarketDataErrorKind): void {
  const current = status[instrumentKey] ?? EMPTY_REFRESH_STATUS;
  status[instrumentKey] = { ...current, lastAttemptAt: at, lastErrorKind: error };
}

export const useMarketDataStore = create<MarketDataState>((set, get) => ({
  quotesBySymbol: {},
  statusByInstrument: {},
  isRefreshing: false,
  lastError: null,
  nextRefreshAt: null,

  loadCachedQuotes: async () => {
    const quotes = await MarketDataCacheRepository.getAllQuotes();
    set({ quotesBySymbol: quotes });
  },

  refreshAll: async (investments) => {
    if (get().isRefreshing) return { hadSuccess: false };
    set({ isRefreshing: true, lastError: null });
    try {
      const result = await MarketDataService.refreshQuotes(investments);
      const quotes = await MarketDataCacheRepository.getAllQuotes();
      const now = nowISO();

      set((state) => {
        const status = { ...state.statusByInstrument };
        for (const instrumentKey of result.attempted) markAttempted(status, instrumentKey, now);
        for (const quote of result.quotes) {
          markSucceeded(status, marketDataInstrumentKey(quote.providerSymbol, quote.exchange), now);
        }
        for (const failure of result.failed) {
          markFailed(status, failure.instrumentKey, now, failure.error);
        }
        return { quotesBySymbol: quotes, statusByInstrument: status, lastError: result.error ?? null };
      });

      // Only re-apply the quotes actually fetched this cycle, not the entire
      // cache — investments whose cache entry was already fresh (and thus
      // skipped by refreshQuotes) don't need a redundant AsyncStorage write.
      await Promise.all(result.quotes.map(applyQuoteToInvestments));
      return { hadSuccess: result.quotes.length > 0 };
    } finally {
      set({ isRefreshing: false });
    }
  },

  refreshOne: async (investment) => {
    const instrumentKey = marketDataInstrumentKey(investment.providerSymbol ?? investment.id, investment.exchange);
    if (inFlightInstrumentRefreshes.has(instrumentKey)) return;

    inFlightInstrumentRefreshes.add(instrumentKey);
    const now = nowISO();
    set((state) => {
      const status = { ...state.statusByInstrument };
      markAttempted(status, instrumentKey, now);
      return { statusByInstrument: status };
    });
    try {
      const result = await MarketDataService.getQuote(investment);
      const at = nowISO();
      if (result.quote) {
        const quoteKey = marketDataInstrumentKey(result.quote.providerSymbol, result.quote.exchange);
        set((state) => {
          const status = { ...state.statusByInstrument };
          markSucceeded(status, quoteKey, at);
          return {
            quotesBySymbol: { ...state.quotesBySymbol, [quoteKey]: result.quote! },
            statusByInstrument: status,
          };
        });
        await applyQuoteToInvestments(result.quote);
      }
      if (result.error) {
        set((state) => {
          const status = { ...state.statusByInstrument };
          markFailed(status, instrumentKey, at, result.error!);
          return { statusByInstrument: status, lastError: result.error! };
        });
      }
    } finally {
      inFlightInstrumentRefreshes.delete(instrumentKey);
    }
  },

  setNextRefreshAt: (iso) => set({ nextRefreshAt: iso }),

  recordInstrumentAttempt: (instrumentKey) => {
    const status = { ...get().statusByInstrument };
    markAttempted(status, instrumentKey, nowISO());
    set({ statusByInstrument: status });
  },

  recordInstrumentResult: (instrumentKey, result) => {
    const status = { ...get().statusByInstrument };
    const at = nowISO();
    if (result.success) {
      markSucceeded(status, instrumentKey, at);
    } else {
      markFailed(status, instrumentKey, at, result.error);
    }
    set({ statusByInstrument: status });
  },
}));
