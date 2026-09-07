import { create } from "zustand";
import type { Investment } from "@/types/models";
import type { MarketDataErrorKind, MarketQuote } from "@/types/marketData";
import { MarketDataCacheRepository } from "@/lib/repositories/MarketDataCacheRepository";
import { MarketDataService } from "@/services/market/MarketDataService";
import { useInvestmentsStore } from "@/store/investmentsStore";

/**
 * Writes a fetched quote back into the matching investment's stored price so
 * the existing (untouched) 0.1.0 net-worth/portfolio calculations pick it up
 * automatically — no separate "live value" codepath needed elsewhere in the
 * app. Only touches positions the user explicitly linked to live data.
 */
async function applyQuoteToInvestments(quote: MarketQuote): Promise<void> {
  const { investments, editInvestment } = useInvestmentsStore.getState();
  const matches = investments.filter(
    (inv) => inv.liveDataEnabled && inv.providerSymbol === quote.providerSymbol
  );
  for (const investment of matches) {
    if (investment.currency !== quote.currency) continue;
    await editInvestment(investment.id, {
      currentPriceMinor: quote.priceMinor,
      priceUpdatedAt: quote.timestamp,
    });
  }
}

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
      await Promise.all(Object.values(quotes).map(applyQuoteToInvestments));
    } finally {
      set({ isRefreshing: false });
    }
  },

  refreshOne: async (investment) => {
    const result = await MarketDataService.getQuote(investment);
    if (result.quote) {
      set((state) => ({
        quotesBySymbol: { ...state.quotesBySymbol, [result.quote!.symbol]: result.quote! },
      }));
      await applyQuoteToInvestments(result.quote);
    }
    if (result.error) set({ lastError: result.error });
  },
}));
