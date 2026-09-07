import { readValue, writeValue } from "@/lib/storage";
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

function historicalKey(symbol: string, period: string): string {
  return `${symbol}:${period}`;
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
  async getQuote(symbol: string): Promise<MarketQuote | undefined> {
    const cache = await readCache();
    return cache.quotes[symbol];
  }

  async setQuote(quote: MarketQuote): Promise<void> {
    const cache = await readCache();
    cache.quotes[quote.symbol] = quote;
    await writeValue(CACHE_KEY, cache);
  }

  async getAllQuotes(): Promise<Record<string, MarketQuote>> {
    const cache = await readCache();
    return cache.quotes;
  }

  async getHistorical(symbol: string, period: string): Promise<HistoricalSeries | undefined> {
    const cache = await readCache();
    return cache.historical[historicalKey(symbol, period)];
  }

  async setHistorical(series: HistoricalSeries): Promise<void> {
    const cache = await readCache();
    cache.historical[historicalKey(series.symbol, series.period)] = series;
    await writeValue(CACHE_KEY, cache);
  }

  async getDividend(symbol: string): Promise<DividendInfo | undefined> {
    const cache = await readCache();
    return cache.dividends[symbol];
  }

  async setDividend(info: DividendInfo): Promise<void> {
    const cache = await readCache();
    cache.dividends[info.symbol] = info;
    await writeValue(CACHE_KEY, cache);
  }

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
