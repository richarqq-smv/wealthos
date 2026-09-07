import type { HistoricalSeries } from "@/types/marketData";

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
import { MarketDataError } from "@/types/marketData";

function series(overrides: Partial<HistoricalSeries> = {}): HistoricalSeries {
  return {
    symbol: "AAPL",
    period: "1M",
    points: [
      { date: "2026-08-01", closeMinor: 15_000 },
      { date: "2026-08-15", closeMinor: 15_500 },
      { date: "2026-09-01", closeMinor: 16_000 },
    ],
    currency: "USD",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/** Lets already-queued microtasks (mocked `await`s inside the service) run before we assert mid-flight. */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  // `resetAllMocks` (not `clearAllMocks`) — a `mockReturnValue`/`mockImplementation`
  // set by one test (e.g. the deferred never-resolving promise below) must not
  // silently become the default implementation for a later test once its own
  // queued `mockResolvedValueOnce` calls run out.
  jest.resetAllMocks();
});

describe("MarketDataService.getHistoricalForSymbol — cache", () => {
  it("returns cached data without calling the provider when present (no TTL re-fetch on every render)", async () => {
    const cached = series();
    (MarketDataCacheRepository.getHistorical as jest.Mock).mockResolvedValue(cached);

    const result = await MarketDataService.getHistoricalForSymbol("AAPL", "stock", "1M");

    expect(result).toEqual({ ok: true, series: cached });
    expect(TwelveDataProvider.getHistorical).not.toHaveBeenCalled();
    expect(getSecureKey).not.toHaveBeenCalled();
  });

  it("fetches from the provider and writes the result back to cache on a miss", async () => {
    (MarketDataCacheRepository.getHistorical as jest.Mock).mockResolvedValue(undefined);
    (getSecureKey as jest.Mock).mockResolvedValue("a-key");
    const fetched = series({ symbol: "AAPL", period: "3M" });
    (TwelveDataProvider.getHistorical as jest.Mock).mockResolvedValue(fetched);

    const result = await MarketDataService.getHistoricalForSymbol("AAPL", "stock", "3M");

    expect(result).toEqual({ ok: true, series: fetched });
    expect(MarketDataCacheRepository.setHistorical).toHaveBeenCalledWith(fetched);
  });

  it("keys the cache lookup by symbol+exchange+period, never bare symbol alone", async () => {
    (MarketDataCacheRepository.getHistorical as jest.Mock).mockResolvedValue(undefined);
    (getSecureKey as jest.Mock).mockResolvedValue("a-key");
    (TwelveDataProvider.getHistorical as jest.Mock).mockResolvedValue(series());

    await MarketDataService.getHistoricalForSymbol("ASML", "stock", "1Y", "Euronext");

    expect(MarketDataCacheRepository.getHistorical).toHaveBeenCalledWith("ASML", "1Y", "Euronext");
    expect(TwelveDataProvider.getHistorical).toHaveBeenCalledWith("ASML", "stock", "1Y", "a-key", "Euronext");
  });
});

describe("MarketDataService.getHistoricalForSymbol — in-flight de-duplication", () => {
  it("two concurrent requests for the exact same symbol+exchange+period only trigger one provider call", async () => {
    (MarketDataCacheRepository.getHistorical as jest.Mock).mockResolvedValue(undefined);
    (getSecureKey as jest.Mock).mockResolvedValue("a-key");
    let resolveProvider!: (value: HistoricalSeries) => void;
    (TwelveDataProvider.getHistorical as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveProvider = resolve;
      })
    );

    const call1 = MarketDataService.getHistoricalForSymbol("AAPL", "stock", "1M");
    const call2 = MarketDataService.getHistoricalForSymbol("AAPL", "stock", "1M");

    // Let the mocked cache-read and API-key lookups (both real `await`s
    // inside the service) settle before asserting the provider call count.
    await flushMicrotasks();
    expect(TwelveDataProvider.getHistorical).toHaveBeenCalledTimes(1);
    resolveProvider(series());
    const [r1, r2] = await Promise.all([call1, call2]);
    expect(r1).toEqual(r2);
    expect(TwelveDataProvider.getHistorical).toHaveBeenCalledTimes(1);
  });

  it("a different period for the same symbol is NOT deduped against an in-flight request", async () => {
    (MarketDataCacheRepository.getHistorical as jest.Mock).mockResolvedValue(undefined);
    (getSecureKey as jest.Mock).mockResolvedValue("a-key");
    (TwelveDataProvider.getHistorical as jest.Mock).mockResolvedValue(series());

    await Promise.all([
      MarketDataService.getHistoricalForSymbol("AAPL", "stock", "1M"),
      MarketDataService.getHistoricalForSymbol("AAPL", "stock", "1Y"),
    ]);

    expect(TwelveDataProvider.getHistorical).toHaveBeenCalledTimes(2);
  });

  it("the same symbol on two different exchanges is NOT deduped against each other", async () => {
    (MarketDataCacheRepository.getHistorical as jest.Mock).mockResolvedValue(undefined);
    (getSecureKey as jest.Mock).mockResolvedValue("a-key");
    (TwelveDataProvider.getHistorical as jest.Mock).mockResolvedValue(series());

    await Promise.all([
      MarketDataService.getHistoricalForSymbol("ASML", "stock", "1M", "NASDAQ"),
      MarketDataService.getHistoricalForSymbol("ASML", "stock", "1M", "Euronext"),
    ]);

    expect(TwelveDataProvider.getHistorical).toHaveBeenCalledTimes(2);
  });

  it("releases the in-flight slot after completion so a later call fetches again", async () => {
    (MarketDataCacheRepository.getHistorical as jest.Mock).mockResolvedValue(undefined);
    (getSecureKey as jest.Mock).mockResolvedValue("a-key");
    (TwelveDataProvider.getHistorical as jest.Mock).mockResolvedValue(series());

    await MarketDataService.getHistoricalForSymbol("AAPL", "stock", "1M");
    await MarketDataService.getHistoricalForSymbol("AAPL", "stock", "1M");

    expect(TwelveDataProvider.getHistorical).toHaveBeenCalledTimes(2);
  });

  it("releases the in-flight slot even when the provider call throws", async () => {
    (MarketDataCacheRepository.getHistorical as jest.Mock).mockResolvedValue(undefined);
    (getSecureKey as jest.Mock).mockResolvedValue("a-key");
    (TwelveDataProvider.getHistorical as jest.Mock).mockRejectedValueOnce(
      new MarketDataError("networkUnavailable", "twelveData", "offline")
    );

    const first = await MarketDataService.getHistoricalForSymbol("AAPL", "stock", "1M");
    expect(first).toEqual({ ok: false, reason: "networkUnavailable" });

    (TwelveDataProvider.getHistorical as jest.Mock).mockResolvedValueOnce(series());
    const second = await MarketDataService.getHistoricalForSymbol("AAPL", "stock", "1M");
    expect(second.ok).toBe(true);
    expect(TwelveDataProvider.getHistorical).toHaveBeenCalledTimes(2);
  });
});

describe("MarketDataService.getHistoricalForSymbol — honest failure reasons (never a bare null)", () => {
  it("reports `noApiKey` distinctly when market data was never configured", async () => {
    (MarketDataCacheRepository.getHistorical as jest.Mock).mockResolvedValue(undefined);
    (getSecureKey as jest.Mock).mockResolvedValue(null);

    const result = await MarketDataService.getHistoricalForSymbol("AAPL", "stock", "1M");

    expect(result).toEqual({ ok: false, reason: "noApiKey" });
    expect(TwelveDataProvider.getHistorical).not.toHaveBeenCalled();
  });

  it("reports the real provider error kind on a genuine failure, not a swallowed null", async () => {
    (MarketDataCacheRepository.getHistorical as jest.Mock).mockResolvedValue(undefined);
    (getSecureKey as jest.Mock).mockResolvedValue("a-key");
    (TwelveDataProvider.getHistorical as jest.Mock).mockRejectedValue(
      new MarketDataError("malformedResponse", "twelveData", "bad body")
    );

    const result = await MarketDataService.getHistoricalForSymbol("AAPL", "stock", "1M");

    expect(result).toEqual({ ok: false, reason: "malformedResponse" });
  });
});

describe("MarketDataService.getHistoricalForSymbol — crypto and forex use the same symbol-based path", () => {
  it("fetches a crypto pair's historical series exactly like a stock, keyed by its symbol", async () => {
    (MarketDataCacheRepository.getHistorical as jest.Mock).mockResolvedValue(undefined);
    (getSecureKey as jest.Mock).mockResolvedValue("a-key");
    const btcSeries = series({ symbol: "BTC/USD", currency: "USD" });
    (TwelveDataProvider.getHistorical as jest.Mock).mockResolvedValue(btcSeries);

    const result = await MarketDataService.getHistoricalForSymbol("BTC/USD", "crypto", "1Y");

    expect(result).toEqual({ ok: true, series: btcSeries });
    expect(TwelveDataProvider.getHistorical).toHaveBeenCalledWith("BTC/USD", "crypto", "1Y", "a-key", undefined);
  });

  it("fetches a forex pair's historical series via the existing symbol-based path — no second competing implementation", async () => {
    (MarketDataCacheRepository.getHistorical as jest.Mock).mockResolvedValue(undefined);
    (getSecureKey as jest.Mock).mockResolvedValue("a-key");
    const fxSeries = series({ symbol: "EUR/USD", currency: "USD" });
    (TwelveDataProvider.getHistorical as jest.Mock).mockResolvedValue(fxSeries);

    const result = await MarketDataService.getHistoricalForSymbol("EUR/USD", "forex", "3M");

    expect(result).toEqual({ ok: true, series: fxSeries });
    expect(TwelveDataProvider.getHistorical).toHaveBeenCalledWith("EUR/USD", "forex", "3M", "a-key", undefined);
  });
});

describe("MarketDataService.getHistorical (investment-shaped wrapper)", () => {
  it("delegates to getHistoricalForSymbol using the investment's providerSymbol/exchange, and unwraps to null on failure", async () => {
    (MarketDataCacheRepository.getHistorical as jest.Mock).mockResolvedValue(undefined);
    (getSecureKey as jest.Mock).mockResolvedValue(null);

    const investment = {
      id: "i1",
      name: "Apple",
      ticker: "AAPL",
      type: "stock" as const,
      quantity: 1,
      averagePriceMinor: 100,
      currentPriceMinor: 100,
      currency: "USD" as const,
      broker: "DEGIRO",
      purchaseDate: "2026-01-01T00:00:00.000Z",
      origin: "manual" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      providerSymbol: "AAPL",
      liveDataEnabled: true,
    };

    const result = await MarketDataService.getHistorical(investment, "1M");
    expect(result).toBeNull();
  });

  it("returns null immediately for a position with no linked symbol, without touching cache or provider", async () => {
    const investment = {
      id: "i1",
      name: "Cash-only",
      ticker: "N/A",
      type: "stock" as const,
      quantity: 1,
      averagePriceMinor: 100,
      currentPriceMinor: 100,
      currency: "USD" as const,
      broker: "DEGIRO",
      purchaseDate: "2026-01-01T00:00:00.000Z",
      origin: "manual" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      liveDataEnabled: false,
    };

    const result = await MarketDataService.getHistorical(investment, "1M");
    expect(result).toBeNull();
    expect(MarketDataCacheRepository.getHistorical).not.toHaveBeenCalled();
  });
});
