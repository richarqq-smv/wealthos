import type { Investment } from "@/types/models";

jest.mock("@/lib/secureKeyStore", () => ({
  getSecureKey: jest.fn(),
  setSecureKey: jest.fn(),
  deleteSecureKey: jest.fn(),
}));

jest.mock("@/lib/repositories/MarketDataCacheRepository", () => ({
  MarketDataCacheRepository: {
    getQuote: jest.fn(),
    setQuote: jest.fn(),
    getAllQuotes: jest.fn().mockResolvedValue({}),
    getFxRate: jest.fn(),
    setFxRate: jest.fn(),
  },
}));

jest.mock("@/services/market/TwelveDataProvider", () => ({
  TwelveDataProvider: {
    id: "twelveData",
    testConnection: jest.fn(),
    getQuote: jest.fn(),
    getFxRate: jest.fn(),
  },
}));

import { getSecureKey } from "@/lib/secureKeyStore";
import { MarketDataCacheRepository } from "@/lib/repositories/MarketDataCacheRepository";
import { TwelveDataProvider } from "@/services/market/TwelveDataProvider";
import { useMarketDataStore } from "@/store/marketDataStore";
import { useInvestmentsStore } from "@/store/investmentsStore";
import {
  calculateInvestedCapital,
  calculateInvestmentValue,
  calculatePortfolioValue,
  calculateProfitLoss,
  calculateReturnPercentage,
} from "@/lib/calculations";

function investment(overrides: Partial<Investment> = {}): Investment {
  return {
    id: "i1",
    name: "Test",
    ticker: "TEST",
    type: "stock",
    quantity: 1,
    averagePriceMinor: 100_000,
    currentPriceMinor: 100_000,
    currency: "EUR",
    broker: "DEGIRO",
    purchaseDate: "2026-01-01T00:00:00.000Z",
    origin: "manual",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    liveDataEnabled: true,
    ...overrides,
  };
}

/** Mirrors the real store's editInvestment (partial merge, re-set the array) closely enough for these tests. */
function installFakeInvestmentsStore(initial: Investment[]) {
  const editInvestment = jest.fn(async (id: string, patch: Partial<Investment>) => {
    const current = useInvestmentsStore.getState().investments;
    useInvestmentsStore.setState({
      investments: current.map((inv) => (inv.id === id ? { ...inv, ...patch } : inv)),
    });
  });
  useInvestmentsStore.setState({ investments: initial, editInvestment } as never);
  return editInvestment;
}

beforeEach(() => {
  jest.clearAllMocks();
  (MarketDataCacheRepository.getQuote as jest.Mock).mockResolvedValue(undefined);
  (MarketDataCacheRepository.getFxRate as jest.Mock).mockResolvedValue(undefined);
  (getSecureKey as jest.Mock).mockResolvedValue("a-key");
});

describe("TEST M — a BTC/USD position stored in EUR gets a correct EUR market value", () => {
  it("converts the live BTC/USD quote into the EUR position's currentPriceMinor via the real conversion chain", async () => {
    const inv = investment({
      id: "btc1",
      name: "Bitcoin",
      ticker: "BTC/USD",
      type: "crypto",
      quantity: 0.1,
      averagePriceMinor: 400_000_000, // €40,000.00/BTC cost basis
      currentPriceMinor: 400_000_000,
      currency: "EUR",
      providerSymbol: "BTC/USD",
    });
    const editInvestment = installFakeInvestmentsStore([inv]);

    (TwelveDataProvider.getQuote as jest.Mock).mockResolvedValue({
      symbol: "BTC/USD",
      providerSymbol: "BTC/USD",
      provider: "twelveData",
      assetType: "crypto",
      priceMinor: 10_000_000, // $100,000.00
      previousCloseMinor: null,
      changeMinor: null,
      changePercent: null,
      currency: "USD",
      timestamp: new Date().toISOString(),
      isDelayed: true,
    });
    (TwelveDataProvider.getFxRate as jest.Mock).mockResolvedValue({
      base: "USD",
      quote: "EUR",
      rate: 0.85,
      timestamp: new Date().toISOString(),
    });

    await useMarketDataStore.getState().refreshOne(inv);

    // $100,000.00 * 0.85 = EUR 85,000.00/BTC -> 0.1 BTC = EUR 8,500.00
    expect(editInvestment).toHaveBeenCalledWith(
      "btc1",
      expect.objectContaining({ currentPriceMinor: 8_500_000 })
    );
    const updated = useInvestmentsStore.getState().investments.find((i) => i.id === "btc1")!;
    expect(updated.currency).toBe("EUR");
    expect(calculateInvestmentValue(updated)).toBe(850_000); // 0.1 * 8,500,000
  });
});

describe("TEST N — a USD stock in a EUR portfolio: the investment total uses the EUR-converted value", () => {
  it("the portfolio total reflects the converted EUR value, not the raw USD number", async () => {
    const aapl = investment({
      id: "aapl1",
      name: "Apple",
      ticker: "AAPL",
      quantity: 10,
      averagePriceMinor: 18_000, // €180.00
      currentPriceMinor: 18_000,
      currency: "EUR",
      providerSymbol: "AAPL",
    });
    installFakeInvestmentsStore([aapl]);

    (TwelveDataProvider.getQuote as jest.Mock).mockResolvedValue({
      symbol: "AAPL",
      providerSymbol: "AAPL",
      provider: "twelveData",
      assetType: "stock",
      priceMinor: 20_000, // $200.00
      previousCloseMinor: null,
      changeMinor: null,
      changePercent: null,
      currency: "USD",
      timestamp: new Date().toISOString(),
      isDelayed: true,
    });
    (TwelveDataProvider.getFxRate as jest.Mock).mockResolvedValue({
      base: "USD",
      quote: "EUR",
      rate: 0.85,
      timestamp: new Date().toISOString(),
    });

    await useMarketDataStore.getState().refreshOne(aapl);

    const updated = useInvestmentsStore.getState().investments;
    // $200.00 * 0.85 = EUR 170.00/share * 10 shares = EUR 1,700.00 — NEVER the raw $2,000 treated as EUR.
    expect(calculatePortfolioValue(updated)).toBe(170_000);
    expect(calculatePortfolioValue(updated)).not.toBe(200_000);
  });
});

describe("TEST J — P&L is only computed after both sides are in the same currency", () => {
  it("matches the worked example exactly: EUR 7,000 cost basis, $10,000 current @ USD/EUR 0.85 -> EUR 8,500, P&L +EUR 1,500 (+21.43%)", async () => {
    const inv = investment({
      id: "j1",
      name: "Worked Example",
      ticker: "WKD",
      quantity: 1,
      averagePriceMinor: 700_000, // EUR 7,000.00 cost basis
      currentPriceMinor: 700_000,
      currency: "EUR",
      providerSymbol: "WKD",
    });
    installFakeInvestmentsStore([inv]);

    (TwelveDataProvider.getQuote as jest.Mock).mockResolvedValue({
      symbol: "WKD",
      providerSymbol: "WKD",
      provider: "twelveData",
      assetType: "stock",
      priceMinor: 1_000_000, // $10,000.00
      previousCloseMinor: null,
      changeMinor: null,
      changePercent: null,
      currency: "USD",
      timestamp: new Date().toISOString(),
      isDelayed: true,
    });
    (TwelveDataProvider.getFxRate as jest.Mock).mockResolvedValue({
      base: "USD",
      quote: "EUR",
      rate: 0.85,
      timestamp: new Date().toISOString(),
    });

    await useMarketDataStore.getState().refreshOne(inv);

    const updated = useInvestmentsStore.getState().investments.find((i) => i.id === "j1")!;
    const currentValue = calculateInvestmentValue(updated);
    const invested = calculateInvestedCapital(updated);
    const profitLoss = calculateProfitLoss(currentValue, invested);
    const returnPct = calculateReturnPercentage(invested, profitLoss);

    expect(currentValue).toBe(850_000); // EUR 8,500.00
    expect(invested).toBe(700_000); // EUR 7,000.00
    expect(profitLoss).toBe(150_000); // EUR 1,500.00
    expect(returnPct).toBeCloseTo(0.2142857, 6); // +21.43%
    // Never the nonsensical raw-number subtraction $10,000 - EUR 7,000.
    expect(profitLoss).not.toBe(1_000_000 - 700_000);
  });
});

describe("TEST F — exchange-aware matching is preserved alongside currency conversion", () => {
  it("the same ticker on two different exchanges/currencies each get their own correctly-converted price", async () => {
    const nasdaq = investment({
      id: "nasdaq1",
      ticker: "ASML",
      quantity: 1,
      averagePriceMinor: 100_000,
      currentPriceMinor: 100_000,
      currency: "EUR",
      providerSymbol: "ASML",
      exchange: "NASDAQ",
    });
    const euronext = investment({
      id: "euronext1",
      ticker: "ASML",
      quantity: 1,
      averagePriceMinor: 100_000,
      currentPriceMinor: 100_000,
      currency: "EUR",
      providerSymbol: "ASML",
      exchange: "Euronext",
    });
    const editInvestment = installFakeInvestmentsStore([nasdaq, euronext]);

    (TwelveDataProvider.getQuote as jest.Mock).mockImplementation(
      async (_symbol: string, _assetType: string, _apiKey: string, exchange?: string) => {
        if (exchange === "NASDAQ") {
          return {
            symbol: "ASML",
            providerSymbol: "ASML",
            exchange: "NASDAQ",
            provider: "twelveData",
            assetType: "stock",
            priceMinor: 70_000, // $700.00 (USD ADR listing)
            previousCloseMinor: null,
            changeMinor: null,
            changePercent: null,
            currency: "USD",
            timestamp: new Date().toISOString(),
            isDelayed: true,
          };
        }
        return {
          symbol: "ASML",
          providerSymbol: "ASML",
          exchange: "Euronext",
          provider: "twelveData",
          assetType: "stock",
          priceMinor: 65_000, // EUR 650.00 (native Euronext listing) — no FX needed
          previousCloseMinor: null,
          changeMinor: null,
          changePercent: null,
          currency: "EUR",
          timestamp: new Date().toISOString(),
          isDelayed: true,
        };
      }
    );
    (TwelveDataProvider.getFxRate as jest.Mock).mockResolvedValue({
      base: "USD",
      quote: "EUR",
      rate: 0.85,
      timestamp: new Date().toISOString(),
    });

    await Promise.all([
      useMarketDataStore.getState().refreshOne(nasdaq),
      useMarketDataStore.getState().refreshOne(euronext),
    ]);

    // NASDAQ (USD) listing converted: $700.00 * 0.85 = EUR 595.00
    expect(editInvestment).toHaveBeenCalledWith("nasdaq1", expect.objectContaining({ currentPriceMinor: 59_500 }));
    // Euronext (EUR) listing applied directly, no conversion, never mixed up with the NASDAQ listing's price.
    expect(editInvestment).toHaveBeenCalledWith("euronext1", expect.objectContaining({ currentPriceMinor: 65_000 }));
  });
});

describe("TEST I (store level) — quote available but FX unavailable: no corrupt write, position left untouched", () => {
  it("does not call editInvestment for a cross-currency position when no FX rate is available in either direction", async () => {
    const inv = investment({
      id: "nofx1",
      ticker: "USDX",
      currency: "EUR",
      currentPriceMinor: 50_000,
      providerSymbol: "USDX",
    });
    const editInvestment = installFakeInvestmentsStore([inv]);

    (TwelveDataProvider.getQuote as jest.Mock).mockResolvedValue({
      symbol: "USDX",
      providerSymbol: "USDX",
      provider: "twelveData",
      assetType: "stock",
      priceMinor: 60_000,
      previousCloseMinor: null,
      changeMinor: null,
      changePercent: null,
      currency: "USD",
      timestamp: new Date().toISOString(),
      isDelayed: true,
    });
    (TwelveDataProvider.getFxRate as jest.Mock).mockRejectedValue(new Error("offline"));

    await useMarketDataStore.getState().refreshOne(inv);

    expect(editInvestment).not.toHaveBeenCalled();
    // The position keeps its last known, correctly-denominated EUR value.
    const unchanged = useInvestmentsStore.getState().investments.find((i) => i.id === "nofx1")!;
    expect(unchanged.currentPriceMinor).toBe(50_000);
    expect(Number.isFinite(unchanged.currentPriceMinor)).toBe(true);
  });
});

describe("TEST O — multiple positions (EUR/USD-quoted/GBP-quoted, all stored in EUR) sum to a correct total", () => {
  it("sums three converted EUR-denominated positions to the exact expected total", async () => {
    const eur = investment({
      id: "eur1",
      ticker: "EURX",
      quantity: 2,
      currentPriceMinor: 100_000,
      currency: "EUR",
      providerSymbol: "EURX",
    });
    const usd = investment({
      id: "usd1",
      ticker: "USDX",
      quantity: 10,
      currentPriceMinor: 0,
      currency: "EUR",
      providerSymbol: "USDX",
    });
    const gbp = investment({
      id: "gbp1",
      ticker: "GBPX",
      quantity: 5,
      currentPriceMinor: 0,
      currency: "EUR",
      providerSymbol: "GBPX",
    });
    installFakeInvestmentsStore([eur, usd, gbp]);

    (TwelveDataProvider.getQuote as jest.Mock).mockImplementation(async (symbol: string) => {
      if (symbol === "EURX") {
        return {
          symbol,
          providerSymbol: symbol,
          provider: "twelveData",
          assetType: "stock",
          priceMinor: 100_000,
          previousCloseMinor: null,
          changeMinor: null,
          changePercent: null,
          currency: "EUR",
          timestamp: new Date().toISOString(),
          isDelayed: true,
        };
      }
      if (symbol === "USDX") {
        return {
          symbol,
          providerSymbol: symbol,
          provider: "twelveData",
          assetType: "stock",
          priceMinor: 20_000, // $200.00
          previousCloseMinor: null,
          changeMinor: null,
          changePercent: null,
          currency: "USD",
          timestamp: new Date().toISOString(),
          isDelayed: true,
        };
      }
      return {
        symbol,
        providerSymbol: symbol,
        provider: "twelveData",
        assetType: "stock",
        priceMinor: 8_000, // £80.00
        previousCloseMinor: null,
        changeMinor: null,
        changePercent: null,
        currency: "GBP",
        timestamp: new Date().toISOString(),
        isDelayed: true,
      };
    });
    (TwelveDataProvider.getFxRate as jest.Mock).mockImplementation(async (base: string, quote: string) => {
      if (base === "USD" && quote === "EUR") return { base, quote, rate: 0.85, timestamp: new Date().toISOString() };
      if (base === "GBP" && quote === "EUR") return { base, quote, rate: 1.17, timestamp: new Date().toISOString() };
      throw new Error(`unexpected FX pair ${base}/${quote}`);
    });

    await Promise.all([
      useMarketDataStore.getState().refreshOne(eur),
      useMarketDataStore.getState().refreshOne(usd),
      useMarketDataStore.getState().refreshOne(gbp),
    ]);

    const finalInvestments = useInvestmentsStore.getState().investments;
    // EUR: 2 * 100,000 = 200,000
    // USD->EUR: 10 * (20,000 * 0.85) = 10 * 17,000 = 170,000
    // GBP->EUR: 5 * (8,000 * 1.17) = 5 * 9,360 = 46,800
    expect(calculatePortfolioValue(finalInvestments)).toBe(200_000 + 170_000 + 46_800);
  });
});
