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
  },
}));

jest.mock("@/services/market/TwelveDataProvider", () => ({
  TwelveDataProvider: {
    id: "twelveData",
    testConnection: jest.fn(),
    getQuote: jest.fn(),
    getQuotesBatch: jest.fn(),
    getHistorical: jest.fn(),
  },
}));

import { getSecureKey } from "@/lib/secureKeyStore";
import { MarketDataCacheRepository } from "@/lib/repositories/MarketDataCacheRepository";
import { TwelveDataProvider } from "@/services/market/TwelveDataProvider";
import { MarketDataService } from "@/services/market/MarketDataService";
import { MarketDataError, marketDataInstrumentKey } from "@/types/marketData";

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

const STALE = new Date(Date.now() - 60 * 60_000).toISOString();

beforeEach(() => {
  jest.clearAllMocks();
  (MarketDataCacheRepository.getQuote as jest.Mock).mockResolvedValue(undefined);
});

describe("MarketDataService.refreshQuotes", () => {
  it("returns no attempted/failed instruments when every tracked position is skipped (not stale, or not live-linked)", async () => {
    (MarketDataCacheRepository.getQuote as jest.Mock).mockResolvedValue(quote({ timestamp: new Date().toISOString() }));
    const result = await MarketDataService.refreshQuotes([investment()]);
    expect(result).toEqual({ updated: 0, quotes: [], attempted: [], failed: [] });
    expect(TwelveDataProvider.getQuotesBatch).not.toHaveBeenCalled();
  });

  it("ignores positions that are not linked to live data or have no provider symbol", async () => {
    const untracked = investment({ id: "u1", liveDataEnabled: false });
    const unlinked = investment({ id: "u2", providerSymbol: undefined });
    const result = await MarketDataService.refreshQuotes([untracked, unlinked]);
    expect(result.attempted).toEqual([]);
  });

  it("marks every due instrument as attempted, and genuinely calls the provider (not just cache/re-render)", async () => {
    (getSecureKey as jest.Mock).mockResolvedValue("a-key");
    const fresh = quote({ priceMinor: 16_000 });
    (TwelveDataProvider.getQuotesBatch as jest.Mock).mockResolvedValue([fresh]);

    const result = await MarketDataService.refreshQuotes([investment({ providerSymbol: "AAPL" })]);

    expect(TwelveDataProvider.getQuotesBatch).toHaveBeenCalledTimes(1);
    expect(result.attempted).toEqual([marketDataInstrumentKey("AAPL")]);
    expect(result.quotes).toEqual([fresh]);
    expect(result.failed).toEqual([]);
    expect(MarketDataCacheRepository.setQuote).toHaveBeenCalledWith(fresh);
  });

  it("reports a partial batch failure as `failed`, not silently dropped", async () => {
    (getSecureKey as jest.Mock).mockResolvedValue("a-key");
    // Only AAPL comes back; MSFT silently missing from the provider's response.
    (TwelveDataProvider.getQuotesBatch as jest.Mock).mockResolvedValue([quote({ providerSymbol: "AAPL" })]);

    const investments = [
      investment({ id: "a", providerSymbol: "AAPL" }),
      investment({ id: "b", providerSymbol: "MSFT" }),
    ];
    const result = await MarketDataService.refreshQuotes(investments);

    expect(result.attempted).toEqual(
      expect.arrayContaining([marketDataInstrumentKey("AAPL"), marketDataInstrumentKey("MSFT")])
    );
    expect(result.failed).toEqual([{ instrumentKey: marketDataInstrumentKey("MSFT"), error: "unknown" }]);
  });

  it("marks every attempted instrument failed with `rateLimited` when the provider is backed off, and never calls it again this cycle", async () => {
    // Backoff is in-memory, module-level state with a 15-minute window — it
    // must not leak into any other test in this file, so this one test runs
    // against a freshly-isolated module registry instead of the shared
    // top-level `MarketDataService` import.
    await jest.isolateModulesAsync(async () => {
      const { getSecureKey: isolatedGetSecureKey } = require("@/lib/secureKeyStore");
      const { MarketDataCacheRepository: isolatedCache } = require("@/lib/repositories/MarketDataCacheRepository");
      const { TwelveDataProvider: isolatedProvider } = require("@/services/market/TwelveDataProvider");
      const { MarketDataService: isolatedService } = require("@/services/market/MarketDataService");
      const { MarketDataError: IsolatedError } = require("@/types/marketData");

      (isolatedCache.getQuote as jest.Mock).mockResolvedValue(undefined);
      (isolatedGetSecureKey as jest.Mock).mockResolvedValue("a-key");
      (isolatedProvider.getQuotesBatch as jest.Mock).mockRejectedValueOnce(
        new IsolatedError("rateLimited", "twelveData", "out of credits")
      );
      await isolatedService.refreshQuotes([investment({ providerSymbol: "AAPL" })]);

      (isolatedProvider.getQuotesBatch as jest.Mock).mockClear();
      const result = await isolatedService.refreshQuotes([investment({ providerSymbol: "MSFT" })]);

      expect(isolatedProvider.getQuotesBatch).not.toHaveBeenCalled();
      expect(result.error).toBe("rateLimited");
      expect(result.failed).toEqual([{ instrumentKey: marketDataInstrumentKey("MSFT"), error: "rateLimited" }]);
    });
  });

  it("de-duplicates the same instrument (symbol+exchange) tracked by two different investments into a single provider request", async () => {
    (getSecureKey as jest.Mock).mockResolvedValue("a-key");
    (TwelveDataProvider.getQuotesBatch as jest.Mock).mockResolvedValue([quote()]);

    const a = investment({ id: "a", providerSymbol: "AAPL" });
    const b = investment({ id: "b", providerSymbol: "AAPL" });
    await MarketDataService.refreshQuotes([a, b]);

    const calledSymbols = (TwelveDataProvider.getQuotesBatch as jest.Mock).mock.calls[0][0];
    expect(calledSymbols).toHaveLength(1);
  });

  it("keeps the same ticker on two different exchanges as separate instruments, never merging their cache identity", async () => {
    (getSecureKey as jest.Mock).mockResolvedValue("a-key");
    (TwelveDataProvider.getQuotesBatch as jest.Mock).mockResolvedValue([
      quote({ providerSymbol: "ASML", exchange: "NASDAQ", currency: "USD" }),
      quote({ providerSymbol: "ASML", exchange: "Euronext", currency: "EUR" }),
    ]);

    const nasdaq = investment({ id: "a", providerSymbol: "ASML", exchange: "NASDAQ" });
    const euronext = investment({ id: "b", providerSymbol: "ASML", exchange: "Euronext" });
    const result = await MarketDataService.refreshQuotes([nasdaq, euronext]);

    const calledSymbols = (TwelveDataProvider.getQuotesBatch as jest.Mock).mock.calls[0][0];
    expect(calledSymbols).toHaveLength(2);
    expect(result.attempted).toEqual(
      expect.arrayContaining([marketDataInstrumentKey("ASML", "NASDAQ"), marketDataInstrumentKey("ASML", "Euronext")])
    );
  });

  it("no API key configured: no attempted/failed entries, and the provider is never called", async () => {
    (getSecureKey as jest.Mock).mockResolvedValue(null);
    const result = await MarketDataService.refreshQuotes([investment({ providerSymbol: "AAPL" })]);
    expect(result).toEqual({ updated: 0, quotes: [], attempted: [], failed: [] });
    expect(TwelveDataProvider.getQuotesBatch).not.toHaveBeenCalled();
  });

  it("a thrown non-rateLimit provider error still reports the failure kind honestly, not silently", async () => {
    (getSecureKey as jest.Mock).mockResolvedValue("a-key");
    (TwelveDataProvider.getQuotesBatch as jest.Mock).mockRejectedValue(
      new MarketDataError("networkUnavailable", "twelveData", "offline")
    );

    const result = await MarketDataService.refreshQuotes([investment({ providerSymbol: "AAPL" })]);

    expect(result.error).toBe("networkUnavailable");
    expect(result.failed).toEqual([{ instrumentKey: marketDataInstrumentKey("AAPL"), error: "networkUnavailable" }]);
    expect(result.quotes).toEqual([]);
  });
});

describe("stale-cache detection uses the SAME symbol+exchange identity used by refreshQuotes to decide what's due", () => {
  it("keeps AAPL@NASDAQ untouched while a stale AAPL@Euronext refreshes", async () => {
    (getSecureKey as jest.Mock).mockResolvedValue("a-key");
    (MarketDataCacheRepository.getQuote as jest.Mock).mockImplementation((_symbol: string, exchange?: string) => {
      if (exchange === "NASDAQ") return Promise.resolve(quote({ exchange: "NASDAQ", timestamp: new Date().toISOString() }));
      return Promise.resolve(quote({ exchange: "Euronext", timestamp: STALE }));
    });
    (TwelveDataProvider.getQuotesBatch as jest.Mock).mockResolvedValue([quote({ exchange: "Euronext" })]);

    const nasdaq = investment({ id: "a", providerSymbol: "AAPL", exchange: "NASDAQ" });
    const euronext = investment({ id: "b", providerSymbol: "AAPL", exchange: "Euronext" });
    const result = await MarketDataService.refreshQuotes([nasdaq, euronext]);

    expect(result.attempted).toEqual([marketDataInstrumentKey("AAPL", "Euronext")]);
  });
});
