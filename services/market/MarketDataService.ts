import type { Investment } from "@/types/models";
import type {
  CompanyProfile,
  DividendInfo,
  FxRate,
  HistoricalPeriod,
  HistoricalSeries,
  MarketAssetType,
  MarketDataErrorKind,
  MarketDataProviderId,
  MarketQuote,
  SymbolSearchResult,
} from "@/types/marketData";
import { MarketDataError, marketDataInstrumentKey } from "@/types/marketData";
import { getSecureKey } from "@/lib/secureKeyStore";
import { MarketDataCacheRepository } from "@/lib/repositories/MarketDataCacheRepository";
import {
  isCompanyProfileStale,
  isDividendStale,
  isFxRateStale,
  isQuoteStale,
} from "@/lib/marketData/cachePolicy";
import { API_KEY_STORAGE, RATE_LIMIT_BACKOFF_MS } from "@/lib/marketData/constants";
import { TwelveDataProvider } from "./TwelveDataProvider";
import { AlphaVantageProvider } from "./AlphaVantageProvider";

export interface QuoteResult {
  quote: MarketQuote | null;
  fromCache: boolean;
  error?: MarketDataErrorKind;
  errorMessage?: string;
}

const backoffUntil: Partial<Record<MarketDataProviderId, number>> = {};

function isBackedOff(providerId: MarketDataProviderId): boolean {
  const until = backoffUntil[providerId];
  return until !== undefined && Date.now() < until;
}

function registerResult(providerId: MarketDataProviderId, error: unknown): void {
  if (error instanceof MarketDataError && error.kind === "rateLimited") {
    backoffUntil[providerId] = Date.now() + RATE_LIMIT_BACKOFF_MS;
  }
}

async function getApiKey(providerId: MarketDataProviderId): Promise<string | null> {
  return getSecureKey(API_KEY_STORAGE[providerId]);
}

function toAssetType(investment: Investment): MarketAssetType {
  if (investment.type === "etf") return "etf";
  if (investment.type === "crypto") return "crypto";
  return "stock";
}

class MarketDataServiceImpl {
  async testConnection(
    providerId: MarketDataProviderId,
    apiKey: string
  ): Promise<{ ok: true } | { ok: false; kind: MarketDataErrorKind; message: string }> {
    const provider = providerId === "twelveData" ? TwelveDataProvider : AlphaVantageProvider;
    const result = await provider.testConnection(apiKey);
    if (!result.ok && result.kind === "rateLimited") {
      backoffUntil[providerId] = Date.now() + RATE_LIMIT_BACKOFF_MS;
    }
    return result;
  }

  /** Cache-first single quote — used right after adding/editing one position. */
  async getQuote(investment: Investment): Promise<QuoteResult> {
    if (!investment.providerSymbol) {
      return { quote: null, fromCache: false, error: "notFound", errorMessage: "Geen gekoppeld symbool." };
    }

    const cached = await MarketDataCacheRepository.getQuote(investment.providerSymbol, investment.exchange);
    const assetType = toAssetType(investment);
    const fresh = cached && !isQuoteStale(assetType, cached.timestamp);
    if (fresh) return { quote: cached, fromCache: true };

    const apiKey = await getApiKey("twelveData");
    if (!apiKey || isBackedOff("twelveData")) {
      return { quote: cached ?? null, fromCache: true };
    }

    try {
      const quote = await TwelveDataProvider.getQuote!(investment.providerSymbol, assetType, apiKey, investment.exchange);
      await MarketDataCacheRepository.setQuote(quote);
      return { quote, fromCache: false };
    } catch (error) {
      registerResult("twelveData", error);
      const kind = error instanceof MarketDataError ? error.kind : "unknown";
      const message = error instanceof MarketDataError ? error.message : "Onbekende fout.";
      return { quote: cached ?? null, fromCache: true, error: kind, errorMessage: message };
    }
  }

  /** Batched refresh for the whole portfolio — one HTTP call for every stale symbol, per rule #28. */
  async refreshQuotes(
    investments: Investment[]
  ): Promise<{ updated: number; quotes: MarketQuote[]; error?: MarketDataErrorKind }> {
    const tracked = investments.filter((inv) => inv.liveDataEnabled && inv.providerSymbol);
    const toRefresh: Array<{ providerSymbol: string; assetType: MarketAssetType; exchange?: string }> = [];
    const seen = new Set<string>();

    for (const investment of tracked) {
      const symbol = investment.providerSymbol!;
      const instrumentKey = marketDataInstrumentKey(symbol, investment.exchange);
      if (seen.has(instrumentKey)) continue;
      const cached = await MarketDataCacheRepository.getQuote(symbol, investment.exchange);
      const assetType = toAssetType(investment);
      if (!cached || isQuoteStale(assetType, cached.timestamp)) {
        toRefresh.push({ providerSymbol: symbol, assetType, exchange: investment.exchange });
        seen.add(instrumentKey);
      }
    }

    if (toRefresh.length === 0) return { updated: 0, quotes: [] };

    const apiKey = await getApiKey("twelveData");
    if (!apiKey || isBackedOff("twelveData")) return { updated: 0, quotes: [] };

    try {
      const quotes = await TwelveDataProvider.getQuotesBatch!(toRefresh, apiKey);
      for (const quote of quotes) {
        await MarketDataCacheRepository.setQuote(quote);
      }
      return { updated: quotes.length, quotes };
    } catch (error) {
      registerResult("twelveData", error);
      return { updated: 0, quotes: [], error: error instanceof MarketDataError ? error.kind : "unknown" };
    }
  }

  async searchSymbol(query: string): Promise<SymbolSearchResult[]> {
    const apiKey = await getApiKey("twelveData");
    if (!apiKey || isBackedOff("twelveData") || query.trim().length < 2) return [];
    try {
      return await TwelveDataProvider.searchSymbol!(query.trim(), apiKey);
    } catch (error) {
      registerResult("twelveData", error);
      return [];
    }
  }

  async getHistorical(investment: Investment, period: HistoricalPeriod): Promise<HistoricalSeries | null> {
    if (!investment.providerSymbol) return null;
    const cached = await MarketDataCacheRepository.getHistorical(investment.providerSymbol, period, investment.exchange);
    if (cached) return cached;

    const apiKey = await getApiKey("twelveData");
    if (!apiKey || isBackedOff("twelveData")) return null;

    try {
      const series = await TwelveDataProvider.getHistorical!(
        investment.providerSymbol,
        toAssetType(investment),
        period,
        apiKey,
        investment.exchange
      );
      await MarketDataCacheRepository.setHistorical(series);
      return series;
    } catch (error) {
      registerResult("twelveData", error);
      return null;
    }
  }

  async getFxRate(base: string, quote: string): Promise<FxRate | null> {
    if (base === quote) return { base, quote, rate: 1, timestamp: new Date().toISOString() };
    const cached = await MarketDataCacheRepository.getFxRate(base, quote);
    if (cached && !isFxRateStale(cached.timestamp)) return cached;

    const apiKey = await getApiKey("twelveData");
    if (!apiKey || isBackedOff("twelveData")) return cached ?? null;

    try {
      const rate = await TwelveDataProvider.getFxRate!(base, quote, apiKey);
      await MarketDataCacheRepository.setFxRate(rate);
      return rate;
    } catch (error) {
      registerResult("twelveData", error);
      return cached ?? null;
    }
  }

  async getDividend(investment: Investment): Promise<DividendInfo | null> {
    if (!investment.providerSymbol) return null;
    const cached = await MarketDataCacheRepository.getDividend(investment.providerSymbol);
    if (cached && !isDividendStale(cached.timestamp)) return cached;

    const apiKey = await getApiKey("alphaVantage");
    if (!apiKey || isBackedOff("alphaVantage") || !AlphaVantageProvider.getDividend) return cached ?? null;

    try {
      const info = await AlphaVantageProvider.getDividend(investment.providerSymbol, apiKey);
      await MarketDataCacheRepository.setDividend(info);
      return info;
    } catch (error) {
      registerResult("alphaVantage", error);
      return cached ?? null;
    }
  }

  async getCompanyProfile(investment: Investment): Promise<CompanyProfile | null> {
    if (!investment.providerSymbol) return null;
    const cached = await MarketDataCacheRepository.getCompanyProfile(investment.providerSymbol);
    if (cached && !isCompanyProfileStale(cached.timestamp)) return cached;

    const apiKey = await getApiKey("alphaVantage");
    if (!apiKey || isBackedOff("alphaVantage") || !AlphaVantageProvider.getCompanyProfile) return cached ?? null;

    try {
      const profile = await AlphaVantageProvider.getCompanyProfile(investment.providerSymbol, apiKey);
      await MarketDataCacheRepository.setCompanyProfile(profile);
      return profile;
    } catch (error) {
      registerResult("alphaVantage", error);
      return cached ?? null;
    }
  }
}

export const MarketDataService = new MarketDataServiceImpl();
