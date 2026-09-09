import AsyncStorage from "@react-native-async-storage/async-storage";
import { FREE_TIER_DAILY_REQUEST_LIMIT, getQuotaStatus, recordMarketDataRequest } from "@/lib/marketData/requestQuota";
import { StorageKeys } from "@/lib/storage";

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.useRealTimers();
});

describe("requestQuota — persisted, backend-authoritative counter", () => {
  it("starts at the full limit with zero usage when nothing has been recorded yet", async () => {
    const status = await getQuotaStatus();
    expect(status.requestsUsed).toBe(0);
    expect(status.requestsRemaining).toBe(FREE_TIER_DAILY_REQUEST_LIMIT);
    expect(status.exhausted).toBe(false);
  });

  it("decrements requestsRemaining by exactly one per recorded request (N remaining)", async () => {
    await recordMarketDataRequest();
    await recordMarketDataRequest();
    await recordMarketDataRequest();
    const status = await getQuotaStatus();
    expect(status.requestsUsed).toBe(3);
    expect(status.requestsRemaining).toBe(FREE_TIER_DAILY_REQUEST_LIMIT - 3);
    expect(status.exhausted).toBe(false);
  });

  it("reports exactly 1 remaining one request before the limit", async () => {
    for (let i = 0; i < FREE_TIER_DAILY_REQUEST_LIMIT - 1; i++) await recordMarketDataRequest();
    const status = await getQuotaStatus();
    expect(status.requestsRemaining).toBe(1);
    expect(status.exhausted).toBe(false);
  });

  it("reports 0 remaining and exhausted:true exactly at the limit", async () => {
    for (let i = 0; i < FREE_TIER_DAILY_REQUEST_LIMIT; i++) await recordMarketDataRequest();
    const status = await getQuotaStatus();
    expect(status.requestsUsed).toBe(FREE_TIER_DAILY_REQUEST_LIMIT);
    expect(status.requestsRemaining).toBe(0);
    expect(status.exhausted).toBe(true);
  });

  it("never reports negative remaining even if more requests are recorded past the limit (defense in depth failing open on the counter, not the gate)", async () => {
    for (let i = 0; i < FREE_TIER_DAILY_REQUEST_LIMIT + 5; i++) await recordMarketDataRequest();
    const status = await getQuotaStatus();
    expect(status.requestsRemaining).toBe(0);
    expect(status.exhausted).toBe(true);
  });

  it("resets to 0 used on a UTC-day rollover — a stale stored counter from a previous day is never carried over", async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60_000).toISOString().slice(0, 10);
    await AsyncStorage.setItem(StorageKeys.marketDataQuota, JSON.stringify({ date: yesterday, requestsUsed: FREE_TIER_DAILY_REQUEST_LIMIT }));

    const status = await getQuotaStatus();
    expect(status.requestsUsed).toBe(0);
    expect(status.exhausted).toBe(false);
  });

  it("recording a new request after a day rollover starts counting from 0, not from the stale total", async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60_000).toISOString().slice(0, 10);
    await AsyncStorage.setItem(StorageKeys.marketDataQuota, JSON.stringify({ date: yesterday, requestsUsed: FREE_TIER_DAILY_REQUEST_LIMIT }));

    const next = await recordMarketDataRequest();
    expect(next.requestsUsed).toBe(1);
    expect(next.date).toBe(new Date().toISOString().slice(0, 10));
  });
});
