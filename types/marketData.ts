import type { CurrencyCode } from "./models";

export type MarketDataProviderId = "twelveData" | "alphaVantage";

export type MarketAssetType = "stock" | "etf" | "crypto" | "forex";

export interface MarketQuote {
  symbol: string;
  providerSymbol: string;
  /** Which listing this quote is for, when the position was disambiguated (e.g. "Euronext" vs "NASDAQ" for the same ticker). */
  exchange?: string;
  provider: MarketDataProviderId;
  assetType: MarketAssetType;
  priceMinor: number;
  previousCloseMinor: number | null;
  changeMinor: number | null;
  changePercent: number | null;
  currency: CurrencyCode | string;
  timestamp: string;
  isDelayed: boolean;
}

/** A stable cache/matching key so "ASML on NASDAQ" and "ASML on Euronext" never collide. */
export function marketDataInstrumentKey(providerSymbol: string, exchange?: string): string {
  return `${providerSymbol}@${exchange ?? ""}`;
}

export type HistoricalPeriod = "1D" | "1W" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "MAX";

export interface HistoricalPoint {
  date: string;
  closeMinor: number;
}

export interface HistoricalSeries {
  symbol: string;
  exchange?: string;
  period: HistoricalPeriod;
  points: HistoricalPoint[];
  currency: CurrencyCode | string;
  timestamp: string;
}

export interface DividendInfo {
  symbol: string;
  dividendPerShareMinor: number | null;
  dividendYield: number | null;
  exDividendDate: string | null;
  currency: CurrencyCode | string;
  timestamp: string;
}

export interface CompanyProfile {
  symbol: string;
  name: string | null;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  website: string | null;
  marketCapMinor: number | null;
  description: string | null;
  currency: CurrencyCode | string;
  timestamp: string;
}

export interface FxRate {
  base: string;
  quote: string;
  rate: number;
  timestamp: string;
}

export interface SymbolSearchResult {
  symbol: string;
  providerSymbol: string;
  name: string;
  exchange: string;
  assetType: MarketAssetType;
  currency: CurrencyCode | string;
}

/** Every provider-facing failure mode WealthOS needs to react to distinctly. */
export type MarketDataErrorKind =
  | "invalidApiKey"
  | "rateLimited"
  | "networkUnavailable"
  | "providerUnavailable"
  | "notFound"
  | "malformedResponse"
  | "unknown";

export class MarketDataError extends Error {
  readonly kind: MarketDataErrorKind;
  readonly provider: MarketDataProviderId;

  constructor(kind: MarketDataErrorKind, provider: MarketDataProviderId, message: string) {
    super(message);
    this.name = "MarketDataError";
    this.kind = kind;
    this.provider = provider;
  }
}

/**
 * Every provider implements `id` + `testConnection`; everything else is
 * optional. Twelve Data is the primary source (quotes/historical/search/fx);
 * Alpha Vantage only adds `getDividend`/`getCompanyProfile` — it deliberately
 * does not re-implement quote/historical/search to avoid burning its much
 * stricter free-tier budget (25 requests/day) on data Twelve Data already
 * provides.
 */
export interface MarketDataProviderClient {
  readonly id: MarketDataProviderId;
  testConnection(apiKey: string): Promise<{ ok: true } | { ok: false; kind: MarketDataErrorKind; message: string }>;
  /**
   * `exchange` disambiguates tickers that are cross-listed on multiple
   * exchanges (e.g. "ASML" resolves to a NASDAQ-listed USD ADR unless the
   * Euronext Amsterdam EUR listing is explicitly requested) — always pass it
   * through when the investment has one, or the wrong instrument/currency
   * can come back silently.
   */
  getQuote?(providerSymbol: string, assetType: MarketAssetType, apiKey: string, exchange?: string): Promise<MarketQuote>;
  /** One HTTP request for many symbols where the provider supports it — see rule #28 (API call budget). */
  getQuotesBatch?(
    symbols: Array<{ providerSymbol: string; assetType: MarketAssetType; exchange?: string }>,
    apiKey: string
  ): Promise<MarketQuote[]>;
  getHistorical?(
    providerSymbol: string,
    assetType: MarketAssetType,
    period: HistoricalPeriod,
    apiKey: string,
    exchange?: string
  ): Promise<HistoricalSeries>;
  searchSymbol?(query: string, apiKey: string): Promise<SymbolSearchResult[]>;
  getFxRate?(base: string, quote: string, apiKey: string): Promise<FxRate>;
  getDividend?(providerSymbol: string, apiKey: string): Promise<DividendInfo>;
  getCompanyProfile?(providerSymbol: string, apiKey: string): Promise<CompanyProfile>;
}
