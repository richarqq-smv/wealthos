import { readValue, writeValue } from "@/lib/storage";
import { marketDataInstrumentKey } from "@/types/marketData";
import type {
  CompanyProfile,
  DividendInfo,
  FxRate,
  HistoricalSeries,
  MarketQuote,
} from "@/types/marketData";

const CACHE_KEY = "wealthos:marketDataCache";

/**
 * A single flat cache document rather than one AsyncStorage key per symbol —
 * a personal portfolio has at most a few dozen positions, so this stays
 * small, and it means one read/write per cache access instead of N.
 */
interface MarketDataCacheDocument {
  quotes: Record<string, MarketQuote>;
  historical: Record<string, HistoricalSeries>;
  dividends: Record<string, DividendInfo>;
  companyProfiles: Record<string, CompanyProfile>;
  fxRates: Record<string, FxRate>;
}

const EMPTY_CACHE: MarketDataCacheDocument = {
  quotes: {},
  historical: {},
  dividends: {},
  companyProfiles: {},
  fxRates: {},
};

function historicalKey(symbol: string, period: string, exchange?: string): string {
  return `${marketDataInstrumentKey(symbol, exchange)}:${period}`;
}

function fxKey(base: string, quote: string): string {
  return `${base}:${quote}`;
}

async function readCache(): Promise<MarketDataCacheDocument> {
  const stored = await readValue<Partial<MarketDataCacheDocument>>(CACHE_KEY);
  if (!stored) return { ...EMPTY_CACHE };
  return {
    quotes: stored.quotes ?? {},
    historical: stored.historical ?? {},
    dividends: stored.dividends ?? {},
    companyProfiles: stored.companyProfiles ?? {},
    fxRates: stored.fxRates ?? {},
  };
}

class MarketDataCacheRepositoryImpl {
  /** `exchange` MUST be passed whenever the position has one — "ASML on NASDAQ" and "ASML on Euronext" are different instruments and must never share a cache entry. */
  async getQuote(symbol: string, exchange?: string): Promise<MarketQuote | undefined> {
    const cache = await readCache();
    return cache.quotes[marketDataInstrumentKey(symbol, exchange)];
  }

  async setQuote(quote: MarketQuote): Promise<void> {
    const cache = await readCache();
    cache.quotes[marketDataInstrumentKey(quote.providerSymbol, quote.exchange)] = quote;
    await writeValue(CACHE_KEY, cache);
  }

  async getAllQuotes(): Promise<Record<string, MarketQuote>> {
    const cache = await readCache();
    return cache.quotes;
  }

  async getHistorical(symbol: string, period: string, exchange?: string): Promise<HistoricalSeries | undefined> {
    const cache = await readCache();
    return cache.historical[historicalKey(symbol, period, exchange)];
  }

  async setHistorical(series: HistoricalSeries): Promise<void> {
    const cache = await readCache();
    cache.historical[historicalKey(series.symbol, series.period, series.exchange)] = series;
    await writeValue(CACHE_KEY, cache);
  }

  /**
   * KNOWN LIMITATION (deliberate, not an oversight): keyed by bare `symbol`,
   * not the exchange-aware `marketDataInstrumentKey` used for quotes/
   * historical above. Alpha Vantage's `OVERVIEW` endpoint — the sole source
   * of dividend/company data — has no exchange-disambiguation parameter at
   * all, so it always resolves a ticker to whichever single listing Alpha
   * Vantage itself considers primary, regardless of which exchange the
   * requesting WealthOS investment is actually linked to. Making this cache
   * exchange-aware would not make the underlying data any more correct
   * (both keys would end up holding the identical Alpha Vantage response) —
   * it would only cost extra, redundant free-tier requests for two cache
   * entries that are already guaranteed to be the same. If Alpha Vantage
   * ever adds real exchange disambiguation, this should switch to
   * `marketDataInstrumentKey` to match the quote/historical caches.
   */
  async getDividend(symbol: string): Promise<DividendInfo | undefined> {
    const cache = await readCache();
    return cache.dividends[symbol];
  }

  async setDividend(info: DividendInfo): Promise<void> {
    const cache = await readCache();
    cache.dividends[info.symbol] = info;
    await writeValue(CACHE_KEY, cache);
  }

  /** See the `getDividend` comment above — same known, deliberate limitation applies here. */
  async getCompanyProfile(symbol: string): Promise<CompanyProfile | undefined> {
    const cache = await readCache();
    return cache.companyProfiles[symbol];
  }

  async setCompanyProfile(profile: CompanyProfile): Promise<void> {
    const cache = await readCache();
    cache.companyProfiles[profile.symbol] = profile;
    await writeValue(CACHE_KEY, cache);
  }

  async getFxRate(base: string, quote: string): Promise<FxRate | undefined> {
    const cache = await readCache();
    return cache.fxRates[fxKey(base, quote)];
  }

  async setFxRate(rate: FxRate): Promise<void> {
    const cache = await readCache();
    cache.fxRates[fxKey(rate.base, rate.quote)] = rate;
    await writeValue(CACHE_KEY, cache);
  }

  async clear(): Promise<void> {
    await writeValue(CACHE_KEY, EMPTY_CACHE);
  }
}

export const MarketDataCacheRepository = new MarketDataCacheRepositoryImpl();
