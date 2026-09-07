import { MarketDataCacheRepository } from "@/lib/repositories/MarketDataCacheRepository";
import type { HistoricalSeries, MarketQuote } from "@/types/marketData";

function quote(overrides: Partial<MarketQuote>): MarketQuote {
  return {
    symbol: "ASML",
    providerSymbol: "ASML",
    provider: "twelveData",
    assetType: "stock",
    priceMinor: 0,
    previousCloseMinor: null,
    changeMinor: null,
    changePercent: null,
    currency: "USD",
    timestamp: new Date().toISOString(),
    isDelayed: true,
    ...overrides,
  };
}

beforeEach(async () => {
  await MarketDataCacheRepository.clear();
});

describe("MarketDataCacheRepository exchange isolation", () => {
  it("keeps quotes for the same ticker on different exchanges fully separate", async () => {
    const nasdaqQuote = quote({ exchange: "NASDAQ", currency: "USD", priceMinor: 171488 });
    const euronextQuote = quote({ exchange: "Euronext", currency: "EUR", priceMinor: 70000 });

    await MarketDataCacheRepository.setQuote(nasdaqQuote);
    await MarketDataCacheRepository.setQuote(euronextQuote);

    const nasdaqResult = await MarketDataCacheRepository.getQuote("ASML", "NASDAQ");
    const euronextResult = await MarketDataCacheRepository.getQuote("ASML", "Euronext");

    expect(nasdaqResult?.currency).toBe("USD");
    expect(nasdaqResult?.priceMinor).toBe(171488);
    expect(euronextResult?.currency).toBe("EUR");
    expect(euronextResult?.priceMinor).toBe(70000);
  });

  it("does not confuse an exchange-less lookup with a disambiguated one", async () => {
    await MarketDataCacheRepository.setQuote(quote({ exchange: "Euronext", priceMinor: 70000 }));
    const plain = await MarketDataCacheRepository.getQuote("ASML");
    expect(plain).toBeUndefined();
  });

  it("keeps historical series isolated per exchange and period", async () => {
    const nasdaqSeries: HistoricalSeries = {
      symbol: "ASML",
      exchange: "NASDAQ",
      period: "1M",
      points: [{ date: "2026-09-01", closeMinor: 171488 }],
      currency: "USD",
      timestamp: new Date().toISOString(),
    };
    const euronextSeries: HistoricalSeries = {
      symbol: "ASML",
      exchange: "Euronext",
      period: "1M",
      points: [{ date: "2026-09-01", closeMinor: 70000 }],
      currency: "EUR",
      timestamp: new Date().toISOString(),
    };

    await MarketDataCacheRepository.setHistorical(nasdaqSeries);
    await MarketDataCacheRepository.setHistorical(euronextSeries);

    expect((await MarketDataCacheRepository.getHistorical("ASML", "1M", "NASDAQ"))?.currency).toBe("USD");
    expect((await MarketDataCacheRepository.getHistorical("ASML", "1M", "Euronext"))?.currency).toBe("EUR");
  });
});
