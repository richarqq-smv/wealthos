import type { MarketAssetType } from "@/types/marketData";

/**
 * How stale cached data may get before a refresh is attempted. WealthOS is
 * a personal tracker, not a trading terminal — a few minutes of lag is the
 * deliberate trade-off for staying inside free API rate limits (rule #12/60).
 */
export const QUOTE_STALE_AFTER_MINUTES: Record<MarketAssetType, number> = {
  stock: 10,
  etf: 10,
  crypto: 5,
  forex: 10,
};

export const FX_STALE_AFTER_MINUTES = 10;
export const DIVIDEND_STALE_AFTER_HOURS = 24;
export const COMPANY_PROFILE_STALE_AFTER_HOURS = 24;

export function minutesSince(isoTimestamp: string): number {
  return (Date.now() - new Date(isoTimestamp).getTime()) / 60_000;
}

export function isQuoteStale(assetType: MarketAssetType, timestamp: string): boolean {
  return minutesSince(timestamp) >= QUOTE_STALE_AFTER_MINUTES[assetType];
}

export function isFxRateStale(timestamp: string): boolean {
  return minutesSince(timestamp) >= FX_STALE_AFTER_MINUTES;
}

export function isDividendStale(timestamp: string): boolean {
  return minutesSince(timestamp) >= DIVIDEND_STALE_AFTER_HOURS * 60;
}

export function isCompanyProfileStale(timestamp: string): boolean {
  return minutesSince(timestamp) >= COMPANY_PROFILE_STALE_AFTER_HOURS * 60;
}
