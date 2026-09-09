import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Investment } from "@/types/models";
import type { MarketQuote } from "@/types/marketData";
import { FREE_TIER_DAILY_REQUEST_LIMIT } from "@/lib/marketData/requestQuota";

jest.mock("@/lib/secureKeyStore", () => ({
  getSecureKey: jest.fn(),
  setSecureKey: jest.fn(),
  deleteSecureKey: jest.fn(),
}));

jest.mock("@/lib/repositories/MarketDataCacheRepository", () => ({
  MarketDataCacheRepository: {
    getQuote: jest.fn(),
    setQuote: jest.fn(),
    getAllQuotes: jest.fn(),
    getHistorical: jest.fn(),
    setHistorical: jest.fn(),
    getDividend: jest.fn(),
    setDividend: jest.fn(),
    getCompanyProfile: jest.fn(),
    setCompanyProfile: jest.fn(),
    getFxRate: jest.fn(),
    setFxRate: jest.fn(),
  },
}));

jest.mock("@/services/market/TwelveDataProvider", () => ({
  TwelveDataProvider: {
    id: "twelveData",
    testConnection: jest.fn(),
    getQuote: jest.fn(),
    getQuotesBatch: jest.fn(),
    getHistorical: jest.fn(),
    searchSymbol: jest.fn(),
    getFxRate: jest.fn(),
  },
}));

import { getSecureKey } from "@/lib/secureKeyStore";
import { MarketDataCacheRepository } from "@/lib/repositories/MarketDataCacheRepository";
import { TwelveDataProvider } from "@/services/market/TwelveDataProvider";
import { MarketDataService } from "@/services/market/MarketDataService";
import { getQuotaStatus, recordMarketDataRequest } from "@/lib/marketData/requestQuota";

function investment(overrides: Partial<Investment> = {}): Investment {
  return {
    id: "i1",
    name: "Apple",
    ticker: "AAPL",
    type: "stock",
    quantity: 10,
    averagePriceMinor: 10_000,
    currentPriceMinor: 15_000,
    currency: "EUR",
    broker: "DEGIRO",
    purchaseDate: "2026-01-01T00:00:00.000Z",
    origin: "manual",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    providerSymbol: "AAPL",
    liveDataEnabled: true,
    ...overrides,
  };
}

function quote(overrides: Partial<MarketQuote> = {}): MarketQuote {
  return {
    symbol: "AAPL",
    providerSymbol: "AAPL",
    provider: "twelveData",
    assetType: "stock",
    priceMinor: 15_500,
    previousCloseMinor: 15_000,
    changeMinor: 500,
    changePercent: 0.033,
    currency: "USD",
    timestamp: new Date().toISOString(),
    isDelayed: true,
    ...overrides,
  };
}

/**
 * Defense-in-depth quota test: the UI-level guard (LiveDataRefreshControl
 * disabling its button at 0 remaining) is only one layer. This proves the
 * service layer — the actual network-call site — independently refuses to
 * dispatch once the persisted quota counter is exhausted, so a route that
 * bypasses the UI (e.g. the Investments-tab MarketDataStatusBar, or a future
 * caller) can't silently exceed the daily estimate either.
 */
describe("MarketDataService quota gate (defense in depth, real persisted counter)", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (MarketDataCacheRepository.getQuote as jest.Mock).mockResolvedValue(
      quote({ timestamp: new Date(Date.now() - 60 * 60_000).toISOString() })
    );
    (getSecureKey as jest.Mock).mockResolvedValue("a-key");
    (TwelveDataProvider.getQuote as jest.Mock).mockResolvedValue(quote());
  });

  it("dispatches normally and increments the counter when quota is available", async () => {
    const result = await MarketDataService.getQuote(investment());
    expect(TwelveDataProvider.getQuote).toHaveBeenCalledTimes(1);
    expect(result.error).toBeUndefined();

    const status = await getQuotaStatus();
    expect(status.requestsUsed).toBe(1);
  });

  it("refuses the call and never reaches the provider once the persisted quota is exhausted", async () => {
    for (let i = 0; i < FREE_TIER_DAILY_REQUEST_LIMIT; i++) await recordMarketDataRequest();

    const result = await MarketDataService.getQuote(investment());

    expect(TwelveDataProvider.getQuote).not.toHaveBeenCalled();
    expect(result.error).toBe("rateLimited");
    expect(result.errorMessage).not.toMatch(/stack|Error:|at\s+\w+\s*\(/i); // No technical stack trace surfaced to the user.

    const status = await getQuotaStatus();
    expect(status.requestsUsed).toBe(FREE_TIER_DAILY_REQUEST_LIMIT); // Refused call never incremented the counter further.
  });

  it("refuses batch refreshes the same way once exhausted", async () => {
    for (let i = 0; i < FREE_TIER_DAILY_REQUEST_LIMIT; i++) await recordMarketDataRequest();
    (TwelveDataProvider.getQuotesBatch as jest.Mock).mockResolvedValue({ ok: true, quotes: [quote()] });

    const result = await MarketDataService.refreshQuotes([investment()]);

    expect(TwelveDataProvider.getQuotesBatch).not.toHaveBeenCalled();
    expect(result.error).toBe("rateLimited");
  });

  it("allows the call again once one request of headroom remains (1 remaining)", async () => {
    for (let i = 0; i < FREE_TIER_DAILY_REQUEST_LIMIT - 1; i++) await recordMarketDataRequest();

    const result = await MarketDataService.getQuote(investment());

    expect(TwelveDataProvider.getQuote).toHaveBeenCalledTimes(1);
    expect(result.error).toBeUndefined();

    const status = await getQuotaStatus();
    expect(status.exhausted).toBe(true); // That last call consumed the final slot.
  });
});
