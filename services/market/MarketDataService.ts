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

export interface RefreshQuotesResult {
  updated: number;
  quotes: MarketQuote[];
  /** Every instrument that was actually due for a refresh this cycle (not skipped as still-fresh). */
  attempted: string[];
  /** The subset of `attempted` that did not come back with a fresh quote — always populated on partial batch failures, never silently dropped. */
  failed: Array<{ instrumentKey: string; error: MarketDataErrorKind }>;
  error?: MarketDataErrorKind;
}

export type HistoricalResult =
  | { ok: true; series: HistoricalSeries }
  | { ok: false; reason: "noApiKey" | "rateLimited" | MarketDataErrorKind };

/**
 * Concurrent identical historical requests (e.g. a chart's effect firing
 * twice for the same symbol+period, or the user tapping a period chip
 * rapidly) must not become two live HTTP calls — this keys the in-flight
 * promise by the exact same identity the cache uses (`symbol@exchange` +
 * period) so a second caller just awaits the first request's result.
 */
const inFlightHistorical = new Map<string, Promise<HistoricalResult>>();

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

export function investmentAssetType(investment: Investment): MarketAssetType {
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
    const assetType = investmentAssetType(investment);
    const fresh = cached && !isQuoteStale(assetType, cached.timestamp);
    if (fresh) return { quote: cached, fromCache: true };

    const apiKey = await getApiKey("twelveData");
    if (!apiKey) {
      return { quote: cached ?? null, fromCache: true };
    }
    if (isBackedOff("twelveData")) {
      // Explicit, not silent: a caller (e.g. the per-instrument LIVE badge)
      // must be able to tell "rate limited" apart from "never configured".
      return { quote: cached ?? null, fromCache: true, error: "rateLimited", errorMessage: "Limiet bereikt, probeer later opnieuw." };
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

  /**
   * Batched refresh for the whole portfolio — one HTTP call for every stale
   * symbol, per rule #28. Returns exactly which instruments were due this
   * cycle (`attempted`) and which of those did not come back with a fresh
   * quote (`failed`) — a symbol silently dropped inside
   * `getQuotesBatch`'s own per-symbol try/catch is exactly the kind of
   * "error swallowed, UI still says LIVE" bug this exists to prevent.
   */
  async refreshQuotes(investments: Investment[]): Promise<RefreshQuotesResult> {
    const tracked = investments.filter((inv) => inv.liveDataEnabled && inv.providerSymbol);
    const toRefresh: Array<{ providerSymbol: string; assetType: MarketAssetType; exchange?: string }> = [];
    const seen = new Set<string>();

    for (const investment of tracked) {
      const symbol = investment.providerSymbol!;
      const instrumentKey = marketDataInstrumentKey(symbol, investment.exchange);
      if (seen.has(instrumentKey)) continue;
      const cached = await MarketDataCacheRepository.getQuote(symbol, investment.exchange);
      const assetType = investmentAssetType(investment);
      if (!cached || isQuoteStale(assetType, cached.timestamp)) {
        toRefresh.push({ providerSymbol: symbol, assetType, exchange: investment.exchange });
        seen.add(instrumentKey);
      }
    }

    if (toRefresh.length === 0) return { updated: 0, quotes: [], attempted: [], failed: [] };
    const attempted = toRefresh.map((s) => marketDataInstrumentKey(s.providerSymbol, s.exchange));

    const apiKey = await getApiKey("twelveData");
    if (!apiKey) return { updated: 0, quotes: [], attempted: [], failed: [] };
    if (isBackedOff("twelveData")) {
      return {
        updated: 0,
        quotes: [],
        attempted,
        failed: attempted.map((instrumentKey) => ({ instrumentKey, error: "rateLimited" as const })),
        error: "rateLimited",
      };
    }

    try {
      const quotes = await TwelveDataProvider.getQuotesBatch!(toRefresh, apiKey);
      for (const quote of quotes) {
        await MarketDataCacheRepository.setQuote(quote);
      }
      const succeeded = new Set(quotes.map((q) => marketDataInstrumentKey(q.providerSymbol, q.exchange)));
      const failed = attempted
        .filter((key) => !succeeded.has(key))
        .map((instrumentKey) => ({ instrumentKey, error: "unknown" as const }));
      return { updated: quotes.length, quotes, attempted, failed };
    } catch (error) {
      registerResult("twelveData", error);
      const kind = error instanceof MarketDataError ? error.kind : "unknown";
      return {
        updated: 0,
        quotes: [],
        attempted,
        failed: attempted.map((instrumentKey) => ({ instrumentKey, error: kind })),
        error: kind,
      };
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

  /** Investment-shaped convenience wrapper around {@link getHistoricalForSymbol} — kept for existing call sites (investment detail screen). */
  async getHistorical(investment: Investment, period: HistoricalPeriod): Promise<HistoricalSeries | null> {
    if (!investment.providerSymbol) return null;
    const result = await this.getHistoricalForSymbol(
      investment.providerSymbol,
      investmentAssetType(investment),
      period,
      investment.exchange
    );
    return result.ok ? result.series : null;
  }

  /**
   * Symbol-based (no `Investment` required) so forex/FX-pair detail views
   * can reuse the exact same fetch/cache/backoff/dedup path instead of a
   * second competing implementation. In-flight-deduped per exact
   * `symbol@exchange + period` identity, and reports WHY nothing came back
   * (no key vs. rate-limited vs. a real provider error) instead of
   * collapsing every failure into a bare `null`.
   */
  async getHistoricalForSymbol(
    providerSymbol: string,
    assetType: MarketAssetType,
    period: HistoricalPeriod,
    exchange?: string
  ): Promise<HistoricalResult> {
    const cached = await MarketDataCacheRepository.getHistorical(providerSymbol, period, exchange);
    if (cached) return { ok: true, series: cached };

    const dedupeKey = `${marketDataInstrumentKey(providerSymbol, exchange)}:${period}`;
    const inFlight = inFlightHistorical.get(dedupeKey);
    if (inFlight) return inFlight;

    const promise = (async (): Promise<HistoricalResult> => {
      const apiKey = await getApiKey("twelveData");
      if (!apiKey) return { ok: false, reason: "noApiKey" };
      if (isBackedOff("twelveData")) return { ok: false, reason: "rateLimited" };

      try {
        const series = await TwelveDataProvider.getHistorical!(providerSymbol, assetType, period, apiKey, exchange);
        await MarketDataCacheRepository.setHistorical(series);
        return { ok: true, series };
      } catch (error) {
        registerResult("twelveData", error);
        const kind = error instanceof MarketDataError ? error.kind : "unknown";
        return { ok: false, reason: kind };
      }
    })();

    inFlightHistorical.set(dedupeKey, promise);
    try {
      return await promise;
    } finally {
      inFlightHistorical.delete(dedupeKey);
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
