import type { Investment } from "@/types/models";
import type { MarketQuote } from "@/types/marketData";

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
import { MarketDataError } from "@/types/marketData";

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

beforeEach(() => {
  jest.clearAllMocks();
});

describe("MarketDataService.getQuote", () => {
  it("returns fresh cached data without calling the provider", async () => {
    (MarketDataCacheRepository.getQuote as jest.Mock).mockResolvedValue(quote({ timestamp: new Date().toISOString() }));

    const result = await MarketDataService.getQuote(investment());

    expect(result.fromCache).toBe(true);
    expect(TwelveDataProvider.getQuote).not.toHaveBeenCalled();
  });

  it("fetches from the provider when the cache is stale, and caches the result", async () => {
    (MarketDataCacheRepository.getQuote as jest.Mock).mockResolvedValue(
      quote({ timestamp: new Date(Date.now() - 60 * 60_000).toISOString() })
    );
    (getSecureKey as jest.Mock).mockResolvedValue("a-key");
    const freshQuote = quote({ priceMinor: 16_000 });
    (TwelveDataProvider.getQuote as jest.Mock).mockResolvedValue(freshQuote);

    const result = await MarketDataService.getQuote(investment());

    expect(result.fromCache).toBe(false);
    expect(result.quote?.priceMinor).toBe(16_000);
    expect(MarketDataCacheRepository.setQuote).toHaveBeenCalledWith(freshQuote);
  });

  it("degrades to cached data without throwing when there is no API key configured", async () => {
    const staleQuote = quote({ timestamp: new Date(Date.now() - 60 * 60_000).toISOString() });
    (MarketDataCacheRepository.getQuote as jest.Mock).mockResolvedValue(staleQuote);
    (getSecureKey as jest.Mock).mockResolvedValue(null);

    const result = await MarketDataService.getQuote(investment());

    expect(result.quote).toEqual(staleQuote);
    expect(result.fromCache).toBe(true);
    expect(TwelveDataProvider.getQuote).not.toHaveBeenCalled();
  });

  it("degrades to cached data (never throws) when the provider call fails", async () => {
    const staleQuote = quote({ timestamp: new Date(Date.now() - 60 * 60_000).toISOString() });
    (MarketDataCacheRepository.getQuote as jest.Mock).mockResolvedValue(staleQuote);
    (getSecureKey as jest.Mock).mockResolvedValue("a-key");
    (TwelveDataProvider.getQuote as jest.Mock).mockRejectedValue(
      new MarketDataError("networkUnavailable", "twelveData", "Geen internetverbinding.")
    );

    const result = await MarketDataService.getQuote(investment());

    expect(result.quote).toEqual(staleQuote);
    expect(result.fromCache).toBe(true);
    expect(result.error).toBe("networkUnavailable");
  });

  it("returns no quote (without throwing) for a position with no linked symbol", async () => {
    const result = await MarketDataService.getQuote(investment({ providerSymbol: undefined }));
    expect(result.quote).toBeNull();
    expect(result.error).toBe("notFound");
  });

  it("returns cached data with no crash when there is no cache and no key at all (fully offline, never configured)", async () => {
    (MarketDataCacheRepository.getQuote as jest.Mock).mockResolvedValue(undefined);
    (getSecureKey as jest.Mock).mockResolvedValue(null);

    const result = await MarketDataService.getQuote(investment());

    expect(result.quote).toBeNull();
    expect(result.fromCache).toBe(true);
  });
});

describe("MarketDataService.testConnection", () => {
  it("surfaces an invalid-key failure without throwing", async () => {
    (TwelveDataProvider.testConnection as jest.Mock).mockResolvedValue({
      ok: false,
      kind: "invalidApiKey",
      message: "invalid apikey",
    });

    const result = await MarketDataService.testConnection("twelveData", "bad-key");
    expect(result).toEqual({ ok: false, kind: "invalidApiKey", message: "invalid apikey" });
  });
});
