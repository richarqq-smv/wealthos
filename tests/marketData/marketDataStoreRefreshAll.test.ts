import type { Investment } from "@/types/models";
import type { MarketQuote } from "@/types/marketData";
import type { RefreshQuotesResult } from "@/services/market/MarketDataService";

jest.mock("@/services/market/MarketDataService", () => ({
  MarketDataService: {
    refreshQuotes: jest.fn(),
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
import { marketDataInstrumentKey } from "@/types/marketData";

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

function refreshResult(overrides: Partial<RefreshQuotesResult> = {}): RefreshQuotesResult {
  return { updated: 0, quotes: [], attempted: [], failed: [], ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
  useInvestmentsStore.setState({ investments: [], editInvestment: jest.fn().mockResolvedValue(undefined) } as never);
  useMarketDataStore.setState({ statusByInstrument: {}, quotesBySymbol: {}, lastError: null, isRefreshing: false });
});

describe("marketDataStore.refreshAll — honest hadSuccess (drives whether 'Laatst bijgewerkt' may be bumped)", () => {
  it("hadSuccess is true only when at least one quote genuinely came back", async () => {
    (MarketDataService.refreshQuotes as jest.Mock).mockResolvedValue(
      refreshResult({ attempted: [marketDataInstrumentKey("AAPL")], quotes: [quote()], updated: 1 })
    );

    const { hadSuccess } = await useMarketDataStore.getState().refreshAll([investment()]);
    expect(hadSuccess).toBe(true);
  });

  it("hadSuccess is false when the cycle attempted instruments but none came back (all failed)", async () => {
    (MarketDataService.refreshQuotes as jest.Mock).mockResolvedValue(
      refreshResult({
        attempted: [marketDataInstrumentKey("AAPL")],
        failed: [{ instrumentKey: marketDataInstrumentKey("AAPL"), error: "networkUnavailable" }],
      })
    );

    const { hadSuccess } = await useMarketDataStore.getState().refreshAll([investment()]);
    expect(hadSuccess).toBe(false);
  });

  it("hadSuccess is false when nothing was due this cycle (everything already fresh) — a no-op is not a success", async () => {
    (MarketDataService.refreshQuotes as jest.Mock).mockResolvedValue(refreshResult());

    const { hadSuccess } = await useMarketDataStore.getState().refreshAll([investment()]);
    expect(hadSuccess).toBe(false);
  });

  it("hadSuccess is false, and re-entrant calls short-circuit, while a refresh is already in-flight", async () => {
    let resolveRefresh!: (value: RefreshQuotesResult) => void;
    (MarketDataService.refreshQuotes as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      })
    );

    const first = useMarketDataStore.getState().refreshAll([investment()]);
    const second = useMarketDataStore.getState().refreshAll([investment()]);

    const secondResult = await second;
    expect(secondResult).toEqual({ hadSuccess: false });
    expect(MarketDataService.refreshQuotes).toHaveBeenCalledTimes(1);

    resolveRefresh(refreshResult({ attempted: [marketDataInstrumentKey("AAPL")], quotes: [quote()] }));
    await first;
  });
});

describe("marketDataStore.refreshAll — statusByInstrument bookkeeping (the only source deriveLiveStatus may read)", () => {
  it("marks every attempted instrument's lastAttemptAt, and a succeeding one's lastSuccessAt", async () => {
    (MarketDataService.refreshQuotes as jest.Mock).mockResolvedValue(
      refreshResult({ attempted: [marketDataInstrumentKey("AAPL")], quotes: [quote({ providerSymbol: "AAPL" })] })
    );

    await useMarketDataStore.getState().refreshAll([investment()]);

    const status = useMarketDataStore.getState().statusByInstrument[marketDataInstrumentKey("AAPL")];
    expect(status?.lastAttemptAt).toBeTruthy();
    expect(status?.lastSuccessAt).toBeTruthy();
    expect(status?.lastErrorKind).toBeNull();
  });

  it("marks a failed instrument's lastErrorKind without touching lastSuccessAt", async () => {
    (MarketDataService.refreshQuotes as jest.Mock).mockResolvedValue(
      refreshResult({
        attempted: [marketDataInstrumentKey("AAPL")],
        failed: [{ instrumentKey: marketDataInstrumentKey("AAPL"), error: "invalidApiKey" }],
      })
    );

    await useMarketDataStore.getState().refreshAll([investment()]);

    const status = useMarketDataStore.getState().statusByInstrument[marketDataInstrumentKey("AAPL")];
    expect(status?.lastErrorKind).toBe("invalidApiKey");
    expect(status?.lastSuccessAt).toBeFalsy();
  });

  it("propagates the batch-level rate-limit error onto the store's lastError field", async () => {
    (MarketDataService.refreshQuotes as jest.Mock).mockResolvedValue(
      refreshResult({
        attempted: [marketDataInstrumentKey("AAPL")],
        failed: [{ instrumentKey: marketDataInstrumentKey("AAPL"), error: "rateLimited" }],
        error: "rateLimited",
      })
    );

    await useMarketDataStore.getState().refreshAll([investment()]);
    expect(useMarketDataStore.getState().lastError).toBe("rateLimited");
  });

  it("clears lastError on a fully successful cycle", async () => {
    useMarketDataStore.setState({ lastError: "rateLimited" });
    (MarketDataService.refreshQuotes as jest.Mock).mockResolvedValue(
      refreshResult({ attempted: [marketDataInstrumentKey("AAPL")], quotes: [quote()] })
    );

    await useMarketDataStore.getState().refreshAll([investment()]);
    expect(useMarketDataStore.getState().lastError).toBeNull();
  });
});

describe("marketDataStore.recordInstrumentAttempt / recordInstrumentResult (used by the FX detail screen)", () => {
  it("recordInstrumentAttempt sets lastAttemptAt without touching lastSuccessAt", () => {
    const key = "EUR/USD@";
    useMarketDataStore.getState().recordInstrumentAttempt(key);

    const status = useMarketDataStore.getState().statusByInstrument[key];
    expect(status?.lastAttemptAt).toBeTruthy();
    expect(status?.lastSuccessAt).toBeNull();
  });

  it("recordInstrumentResult({success:true}) sets lastSuccessAt and clears any prior error", () => {
    const key = "EUR/USD@";
    useMarketDataStore.getState().recordInstrumentAttempt(key);
    useMarketDataStore.getState().recordInstrumentResult(key, { success: true });

    const status = useMarketDataStore.getState().statusByInstrument[key];
    expect(status?.lastSuccessAt).toBeTruthy();
    expect(status?.lastErrorKind).toBeNull();
  });

  it("recordInstrumentResult({success:false}) records the error kind without a success timestamp", () => {
    const key = "EUR/USD@";
    useMarketDataStore.getState().recordInstrumentAttempt(key);
    useMarketDataStore.getState().recordInstrumentResult(key, { success: false, error: "providerUnavailable" });

    const status = useMarketDataStore.getState().statusByInstrument[key];
    expect(status?.lastErrorKind).toBe("providerUnavailable");
    expect(status?.lastSuccessAt).toBeFalsy();
  });
});
