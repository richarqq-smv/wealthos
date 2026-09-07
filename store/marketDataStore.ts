import { create } from "zustand";
import type { Investment } from "@/types/models";
import type { MarketDataErrorKind, MarketQuote } from "@/types/marketData";
import { MarketDataCacheRepository } from "@/lib/repositories/MarketDataCacheRepository";
import { MarketDataService } from "@/services/market/MarketDataService";
import { useInvestmentsStore } from "@/store/investmentsStore";
import { marketDataInstrumentKey } from "@/types/marketData";

/**
 * Writes a fetched quote back into the matching investment's stored price so
 * the existing (untouched) 0.1.0 net-worth/portfolio calculations pick it up
 * automatically — no separate "live value" codepath needed elsewhere in the
 * app. Only touches positions the user explicitly linked to live data.
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
    if (investment.currency !== quote.currency) continue;
    await editInvestment(investment.id, {
      currentPriceMinor: quote.priceMinor,
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
  isRefreshing: boolean;
  lastError: MarketDataErrorKind | null;
  loadCachedQuotes: () => Promise<void>;
  refreshAll: (investments: Investment[]) => Promise<void>;
  refreshOne: (investment: Investment) => Promise<void>;
}

export const useMarketDataStore = create<MarketDataState>((set, get) => ({
  quotesBySymbol: {},
  isRefreshing: false,
  lastError: null,

  loadCachedQuotes: async () => {
    const quotes = await MarketDataCacheRepository.getAllQuotes();
    set({ quotesBySymbol: quotes });
  },

  refreshAll: async (investments) => {
    if (get().isRefreshing) return;
    set({ isRefreshing: true, lastError: null });
    try {
      const result = await MarketDataService.refreshQuotes(investments);
      const quotes = await MarketDataCacheRepository.getAllQuotes();
      set({ quotesBySymbol: quotes, lastError: result.error ?? null });
      // Only re-apply the quotes actually fetched this cycle, not the entire
      // cache — investments whose cache entry was already fresh (and thus
      // skipped by refreshQuotes) don't need a redundant AsyncStorage write.
      await Promise.all(result.quotes.map(applyQuoteToInvestments));
    } finally {
      set({ isRefreshing: false });
    }
  },

  refreshOne: async (investment) => {
    const instrumentKey = marketDataInstrumentKey(investment.providerSymbol ?? investment.id, investment.exchange);
    if (inFlightInstrumentRefreshes.has(instrumentKey)) return;

    inFlightInstrumentRefreshes.add(instrumentKey);
    try {
      const result = await MarketDataService.getQuote(investment);
      if (result.quote) {
        set((state) => ({
          quotesBySymbol: {
            ...state.quotesBySymbol,
            [marketDataInstrumentKey(result.quote!.providerSymbol, result.quote!.exchange)]: result.quote!,
          },
        }));
        await applyQuoteToInvestments(result.quote);
      }
      if (result.error) set({ lastError: result.error });
    } finally {
      inFlightInstrumentRefreshes.delete(instrumentKey);
    }
  },
}));
