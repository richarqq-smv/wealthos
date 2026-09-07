import type { Investment } from "@/types/models";
import type { QuoteResult } from "@/services/market/MarketDataService";

jest.mock("@/services/market/MarketDataService", () => ({
  MarketDataService: {
    getQuote: jest.fn(),
  },
}));

jest.mock("@/lib/repositories/MarketDataCacheRepository", () => ({
  MarketDataCacheRepository: {
    getAllQuotes: jest.fn().mockResolvedValue({}),
  },
}));

import { MarketDataService } from "@/services/market/MarketDataService";
import { useMarketDataStore } from "@/store/marketDataStore";
import { useInvestmentsStore } from "@/store/investmentsStore";

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

/** A getQuote that only resolves once `release()` is called, so two overlapping calls can be observed. */
function deferredQuoteResult(): { promise: Promise<QuoteResult>; release: (result: QuoteResult) => void } {
  let release!: (result: QuoteResult) => void;
  const promise = new Promise<QuoteResult>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

beforeEach(() => {
  jest.clearAllMocks();
  useInvestmentsStore.setState({ investments: [], editInvestment: jest.fn().mockResolvedValue(undefined) } as never);
});

describe("marketDataStore.refreshOne — M1 (per-instrument in-flight deduplication)", () => {
  it("two concurrent refreshOne() calls for the SAME instrument only trigger one provider request", async () => {
    const deferred = deferredQuoteResult();
    (MarketDataService.getQuote as jest.Mock).mockReturnValue(deferred.promise);

    const inv = investment();
    const refreshOne = useMarketDataStore.getState().refreshOne;

    const call1 = refreshOne(inv);
    const call2 = refreshOne(inv);

    expect(MarketDataService.getQuote).toHaveBeenCalledTimes(1);

    deferred.release({ quote: null, fromCache: false });
    await Promise.all([call1, call2]);

    expect(MarketDataService.getQuote).toHaveBeenCalledTimes(1);
  });

  it("a second refreshOne() for the SAME instrument is allowed again once the first has finished", async () => {
    (MarketDataService.getQuote as jest.Mock).mockResolvedValue({ quote: null, fromCache: false });

    const inv = investment();
    const refreshOne = useMarketDataStore.getState().refreshOne;

    await refreshOne(inv);
    await refreshOne(inv);

    expect(MarketDataService.getQuote).toHaveBeenCalledTimes(2);
  });

  it("the in-flight lock is released even when getQuote throws, so the instrument isn't stuck locked", async () => {
    (MarketDataService.getQuote as jest.Mock).mockRejectedValueOnce(new Error("boom"));
    const inv = investment();
    const refreshOne = useMarketDataStore.getState().refreshOne;

    await expect(refreshOne(inv)).rejects.toThrow("boom");

    (MarketDataService.getQuote as jest.Mock).mockResolvedValueOnce({ quote: null, fromCache: false });
    await refreshOne(inv);

    expect(MarketDataService.getQuote).toHaveBeenCalledTimes(2);
  });

  it("two concurrent refreshOne() calls for DIFFERENT instruments both proceed", async () => {
    (MarketDataService.getQuote as jest.Mock).mockResolvedValue({ quote: null, fromCache: false });

    const a = investment({ id: "a", providerSymbol: "AAPL" });
    const b = investment({ id: "b", providerSymbol: "MSFT" });
    const refreshOne = useMarketDataStore.getState().refreshOne;

    await Promise.all([refreshOne(a), refreshOne(b)]);

    expect(MarketDataService.getQuote).toHaveBeenCalledTimes(2);
  });

  it("the same ticker on two different exchanges are treated as different instruments and both proceed", async () => {
    (MarketDataService.getQuote as jest.Mock).mockResolvedValue({ quote: null, fromCache: false });

    const nasdaq = investment({ id: "a", providerSymbol: "ASML", exchange: "NASDAQ" });
    const euronext = investment({ id: "b", providerSymbol: "ASML", exchange: "Euronext" });
    const refreshOne = useMarketDataStore.getState().refreshOne;

    await Promise.all([refreshOne(nasdaq), refreshOne(euronext)]);

    expect(MarketDataService.getQuote).toHaveBeenCalledTimes(2);
  });
});
