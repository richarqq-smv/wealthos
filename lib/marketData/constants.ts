export const API_KEY_STORAGE = {
  twelveData: "wealthos:marketData:twelveDataApiKey",
  alphaVantage: "wealthos:marketData:alphaVantageApiKey",
} as const;

/** How long to stop calling a provider after it reports a rate limit, per rule #26/#60. */
export const RATE_LIMIT_BACKOFF_MS = 15 * 60 * 1000;
