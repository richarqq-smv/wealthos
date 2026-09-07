import type { MarketQuote } from "@/types/marketData";

jest.mock("@/lib/secureKeyStore", () => ({
  getSecureKey: jest.fn(),
  setSecureKey: jest.fn(),
  deleteSecureKey: jest.fn(),
}));

jest.mock("@/lib/repositories/MarketDataCacheRepository", () => ({
  MarketDataCacheRepository: {
    getFxRate: jest.fn(),
    setFxRate: jest.fn(),
  },
}));

jest.mock("@/services/market/TwelveDataProvider", () => ({
  TwelveDataProvider: {
    id: "twelveData",
    testConnection: jest.fn(),
    getFxRate: jest.fn(),
  },
}));

import { getSecureKey } from "@/lib/secureKeyStore";
import { MarketDataCacheRepository } from "@/lib/repositories/MarketDataCacheRepository";
import { TwelveDataProvider } from "@/services/market/TwelveDataProvider";
import { MarketDataService } from "@/services/market/MarketDataService";

function quote(overrides: Partial<MarketQuote> = {}): MarketQuote {
  return {
    symbol: "BTC/USD",
    providerSymbol: "BTC/USD",
    provider: "twelveData",
    assetType: "crypto",
    priceMinor: 10_000_000, // $100,000.00 in minor units
    previousCloseMinor: null,
    changeMinor: null,
    changePercent: null,
    currency: "USD",
    timestamp: new Date().toISOString(),
    isDelayed: true,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (MarketDataCacheRepository.getFxRate as jest.Mock).mockResolvedValue(undefined);
  (getSecureKey as jest.Mock).mockResolvedValue("a-key");
});

describe("MarketDataService.convertQuotePrice — QUOTE CURRENCY === target (POSITION) CURRENCY", () => {
  it("TEST A: EUR quote + EUR position — direct valuation, no FX lookup at all", async () => {
    const q = quote({ currency: "EUR", priceMinor: 15_000 });
    const result = await MarketDataService.convertQuotePrice(q, "EUR");
    expect(result).toBe(15_000);
    expect(TwelveDataProvider.getFxRate).not.toHaveBeenCalled();
    expect(MarketDataCacheRepository.getFxRate).not.toHaveBeenCalled();
  });

  it("TEST B: USD quote + USD position — direct valuation, no FX conversion", async () => {
    const q = quote({ currency: "USD", priceMinor: 32_000 });
    const result = await MarketDataService.convertQuotePrice(q, "USD");
    expect(result).toBe(32_000);
    expect(TwelveDataProvider.getFxRate).not.toHaveBeenCalled();
  });

  it("TEST L: same currency — the FX endpoint is never called, not even for cache freshness", async () => {
    const q = quote({ currency: "GBP", priceMinor: 5_000 });
    await MarketDataService.convertQuotePrice(q, "GBP");
    expect(MarketDataCacheRepository.getFxRate).not.toHaveBeenCalled();
    expect(TwelveDataProvider.getFxRate).not.toHaveBeenCalled();
  });
});

describe("MarketDataService.convertQuotePrice — cross-currency conversion via the existing FX architecture", () => {
  it("TEST C: USD quote + EUR position — converts via the direct USD/EUR rate", async () => {
    (TwelveDataProvider.getFxRate as jest.Mock).mockResolvedValueOnce({
      base: "USD",
      quote: "EUR",
      rate: 0.85,
      timestamp: new Date().toISOString(),
    });

    const q = quote({ currency: "USD", priceMinor: 10_000_000 });
    const result = await MarketDataService.convertQuotePrice(q, "EUR");

    expect(result).toBe(8_500_000);
    expect(TwelveDataProvider.getFxRate).toHaveBeenCalledWith("USD", "EUR", "a-key");
  });

  it("TEST D: EUR quote + USD position — converts via the direct EUR/USD rate", async () => {
    (TwelveDataProvider.getFxRate as jest.Mock).mockResolvedValueOnce({
      base: "EUR",
      quote: "USD",
      rate: 1.08,
      timestamp: new Date().toISOString(),
    });

    const q = quote({ currency: "EUR", priceMinor: 100_000 });
    const result = await MarketDataService.convertQuotePrice(q, "USD");

    expect(result).toBe(108_000);
  });

  it("TEST E: GBP quote + EUR position — converts via the direct GBP/EUR rate", async () => {
    (TwelveDataProvider.getFxRate as jest.Mock).mockResolvedValueOnce({
      base: "GBP",
      quote: "EUR",
      rate: 1.17,
      timestamp: new Date().toISOString(),
    });

    const q = quote({ currency: "GBP", priceMinor: 50_000 });
    const result = await MarketDataService.convertQuotePrice(q, "EUR");

    expect(result).toBe(58_500);
  });

  it("falls back to the inverse pair when only that direction is cached (USD/EUR position needing EUR/USD)", async () => {
    // Direct USD->EUR lookup misses (no cache entry under that exact key,
    // provider also returns nothing usable this cycle)...
    (TwelveDataProvider.getFxRate as jest.Mock).mockRejectedValueOnce(new Error("not found"));
    // ...but the inverse EUR->USD rate IS available (e.g. from a prior FX-screen lookup).
    (TwelveDataProvider.getFxRate as jest.Mock).mockResolvedValueOnce({
      base: "EUR",
      quote: "USD",
      rate: 1.25,
      timestamp: new Date().toISOString(),
    });

    const q = quote({ currency: "USD", priceMinor: 100_000 });
    const result = await MarketDataService.convertQuotePrice(q, "EUR");

    // USD 1,000.00 -> EUR at (1 / 1.25) = 0.8 -> EUR 800.00
    expect(result).toBe(80_000);
    expect(TwelveDataProvider.getFxRate).toHaveBeenNthCalledWith(1, "USD", "EUR", "a-key");
    expect(TwelveDataProvider.getFxRate).toHaveBeenNthCalledWith(2, "EUR", "USD", "a-key");
  });
});

describe("MarketDataService.convertQuotePrice — honest degradation, never a corrupt or 1:1 value", () => {
  it("TEST H: FX provider unavailable (no key) and no cache — returns null, never a silent 1:1", async () => {
    (getSecureKey as jest.Mock).mockResolvedValue(null);
    const q = quote({ currency: "USD" });
    const result = await MarketDataService.convertQuotePrice(q, "EUR");
    expect(result).toBeNull();
  });

  it("TEST I: quote available but FX provider throws in both directions — returns null, never NaN/Infinity", async () => {
    (TwelveDataProvider.getFxRate as jest.Mock).mockRejectedValue(new Error("network down"));
    const q = quote({ currency: "USD" });
    const result = await MarketDataService.convertQuotePrice(q, "EUR");
    expect(result).toBeNull();
    expect(result).not.toBe(Number.NaN);
  });

  it("rejects a non-positive rate rather than propagating it (defensive, even though the provider itself already guards this)", async () => {
    (TwelveDataProvider.getFxRate as jest.Mock).mockResolvedValueOnce({
      base: "USD",
      quote: "EUR",
      rate: 0,
      timestamp: new Date().toISOString(),
    });
    (TwelveDataProvider.getFxRate as jest.Mock).mockResolvedValueOnce({
      base: "EUR",
      quote: "USD",
      rate: -1.1,
      timestamp: new Date().toISOString(),
    });

    const q = quote({ currency: "USD" });
    const result = await MarketDataService.convertQuotePrice(q, "EUR");
    expect(result).toBeNull();
  });

  it("TEST G: a fresh cached FX rate is used directly, without calling the provider even though a key is available", async () => {
    (MarketDataCacheRepository.getFxRate as jest.Mock).mockImplementation((base: string, quote: string) => {
      if (base === "GBP" && quote === "EUR") {
        return Promise.resolve({ base: "GBP", quote: "EUR", rate: 1.17, timestamp: new Date().toISOString() });
      }
      return Promise.resolve(undefined);
    });

    const q = quote({ currency: "GBP", priceMinor: 10_000 });
    const result = await MarketDataService.convertQuotePrice(q, "EUR");

    expect(result).toBe(11_700);
    expect(TwelveDataProvider.getFxRate).not.toHaveBeenCalled();
  });

  it("TEST K: FX provider unreachable but a valid cached rate exists — uses the cached rate for a correct offline valuation", async () => {
    (getSecureKey as jest.Mock).mockResolvedValue(null); // fully offline / no key
    (MarketDataCacheRepository.getFxRate as jest.Mock).mockImplementation((base: string, quote: string) => {
      if (base === "USD" && quote === "EUR") {
        return Promise.resolve({ base: "USD", quote: "EUR", rate: 0.9, timestamp: new Date().toISOString() });
      }
      return Promise.resolve(undefined);
    });

    const q = quote({ currency: "USD", priceMinor: 20_000 });
    const result = await MarketDataService.convertQuotePrice(q, "EUR");

    expect(result).toBe(18_000);
    expect(TwelveDataProvider.getFxRate).not.toHaveBeenCalled();
  });
});

describe("MarketDataService.convertQuotePrice — deterministic rounding (existing minor-unit convention)", () => {
  it("rounds to the nearest minor unit, matching convertAmountMinor's own rounding", async () => {
    (TwelveDataProvider.getFxRate as jest.Mock).mockResolvedValueOnce({
      base: "USD",
      quote: "EUR",
      rate: 1 / 3,
      timestamp: new Date().toISOString(),
    });

    const q = quote({ currency: "USD", priceMinor: 100 });
    const result = await MarketDataService.convertQuotePrice(q, "EUR");
    expect(result).toBe(33);
  });
});
