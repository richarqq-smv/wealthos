import { StorageKeys, readValue, writeValue } from "@/lib/storage";
import type { MarketDataQuota } from "@/types/models";

/**
 * WealthOS's documented supported tier is Twelve Data's free Basic plan
 * (8 requests/minute, 800/day — see README and lib/marketData/constants.ts'
 * RATE_LIMIT_BACKOFF_MS neighbor). This is a *local estimate* of how many of
 * those 800 daily requests WealthOS itself has used, not the provider's own
 * authoritative remaining quota (Twelve Data doesn't expose that via the
 * quote/time_series endpoints WealthOS calls) — the UI must always phrase
 * this as an estimate, never a guarantee, and it says nothing about a paid
 * plan with a higher limit.
 */
export const FREE_TIER_DAILY_REQUEST_LIMIT = 800;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readCurrent(): Promise<MarketDataQuota> {
  const stored = await readValue<MarketDataQuota>(StorageKeys.marketDataQuota);
  const today = todayUtc();
  if (!stored || stored.date !== today) {
    return { date: today, requestsUsed: 0 };
  }
  return stored;
}

/** Called once per real provider call site (MarketDataService), never from the UI directly. */
export async function recordMarketDataRequest(): Promise<MarketDataQuota> {
  const current = await readCurrent();
  const next: MarketDataQuota = { ...current, requestsUsed: current.requestsUsed + 1 };
  await writeValue(StorageKeys.marketDataQuota, next);
  return next;
}

export interface QuotaStatus {
  requestsUsed: number;
  requestsRemaining: number;
  limit: number;
  exhausted: boolean;
}

export async function getQuotaStatus(): Promise<QuotaStatus> {
  const current = await readCurrent();
  const remaining = Math.max(0, FREE_TIER_DAILY_REQUEST_LIMIT - current.requestsUsed);
  return {
    requestsUsed: current.requestsUsed,
    requestsRemaining: remaining,
    limit: FREE_TIER_DAILY_REQUEST_LIMIT,
    exhausted: remaining <= 0,
  };
}
