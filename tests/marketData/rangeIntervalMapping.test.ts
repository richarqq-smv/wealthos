import { TwelveDataProvider } from "@/services/market/TwelveDataProvider";
import type { HistoricalPeriod } from "@/types/marketData";

function mockFetchOnce(status: number, body: unknown) {
  (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
    status,
    json: async () => body,
  });
}

beforeEach(() => {
  globalThis.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

/**
 * Every chart range the UI exposes (1D/5D→1W/1M/3M/1Y/MAX) must map to an
 * explicit Twelve Data `interval` + `outputsize` pair — never the provider's
 * bare default — so free-tier request budget is spent deliberately instead
 * of accidentally pulling more (or less) data than the range needs.
 */
const EXPECTED_PARAMS: Record<HistoricalPeriod, { interval: string; outputsize: number }> = {
  "1D": { interval: "15min", outputsize: 32 },
  "1W": { interval: "1h", outputsize: 40 },
  "1M": { interval: "1day", outputsize: 22 },
  "3M": { interval: "1day", outputsize: 65 },
  "6M": { interval: "1day", outputsize: 130 },
  YTD: { interval: "1day", outputsize: 260 },
  "1Y": { interval: "1week", outputsize: 52 },
  "5Y": { interval: "1month", outputsize: 60 },
  MAX: { interval: "1month", outputsize: 500 },
};

describe("TwelveDataProvider.getHistorical — range→interval mapping", () => {
  for (const [period, { interval, outputsize }] of Object.entries(EXPECTED_PARAMS) as [
    HistoricalPeriod,
    { interval: string; outputsize: number },
  ][]) {
    it(`maps period "${period}" to interval=${interval}&outputsize=${outputsize}`, async () => {
      mockFetchOnce(200, { values: [{ datetime: "2026-01-01", close: "100.00" }], meta: { currency: "USD" } });

      await TwelveDataProvider.getHistorical!("AAPL", "stock", period, "key");

      const calledUrl = (globalThis.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain(`interval=${interval}`);
      expect(calledUrl).toContain(`outputsize=${outputsize}`);
    });
  }

  it("passes the exchange param through on a historical request, exactly like the quote endpoint", async () => {
    mockFetchOnce(200, { values: [{ datetime: "2026-01-01", close: "700.00" }], meta: { currency: "EUR" } });
    await TwelveDataProvider.getHistorical!("ASML", "stock", "1Y", "key", "Euronext");
    const calledUrl = (globalThis.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain("exchange=Euronext");
  });

  it("omits the exchange param when the instrument has none (e.g. a bare crypto pair)", async () => {
    mockFetchOnce(200, { values: [{ datetime: "2026-01-01", close: "60000.00" }], meta: { currency: "USD" } });
    await TwelveDataProvider.getHistorical!("BTC/USD", "crypto", "1M", "key");
    const calledUrl = (globalThis.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain("exchange=");
  });
});

describe("TwelveDataProvider.getHistorical — chart data transformation", () => {
  it("converts closes to minor units and returns points oldest-first (Twelve Data returns newest-first)", async () => {
    mockFetchOnce(200, {
      values: [
        { datetime: "2026-03-01", close: "160.00" },
        { datetime: "2026-02-01", close: "155.50" },
        { datetime: "2026-01-01", close: "150.00" },
      ],
      meta: { currency: "USD" },
    });

    const series = await TwelveDataProvider.getHistorical!("AAPL", "stock", "3M", "key");

    expect(series.points.map((p) => p.date)).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
    expect(series.points.map((p) => p.closeMinor)).toEqual([15_000, 15_550, 16_000]);
  });

  it("carries the reported currency through onto the series for automatic currency display", async () => {
    mockFetchOnce(200, { values: [{ datetime: "2026-01-01", close: "1.08" }], meta: { currency: "EUR" } });
    const series = await TwelveDataProvider.getHistorical!("EUR/USD", "forex", "1M", "key");
    expect(series.currency).toBe("EUR");
  });

  it("defaults to USD when the response carries no currency metadata", async () => {
    mockFetchOnce(200, { values: [{ datetime: "2026-01-01", close: "100.00" }] });
    const series = await TwelveDataProvider.getHistorical!("AAPL", "stock", "1M", "key");
    expect(series.currency).toBe("USD");
  });

  it("drops malformed points (missing date or unparsable close) instead of corrupting the chart", async () => {
    mockFetchOnce(200, {
      values: [
        { datetime: "2026-01-01", close: "100.00" },
        { datetime: "", close: "105.00" },
        { datetime: "2026-01-03", close: "not-a-number" },
      ],
      meta: { currency: "USD" },
    });
    const series = await TwelveDataProvider.getHistorical!("AAPL", "stock", "1M", "key");
    expect(series.points).toEqual([{ date: "2026-01-01", closeMinor: 10_000 }]);
  });

  it("throws malformedResponse when the provider returns no `values` array at all", async () => {
    mockFetchOnce(200, { meta: { currency: "USD" } });
    await expect(TwelveDataProvider.getHistorical!("AAPL", "stock", "1M", "key")).rejects.toMatchObject({
      kind: "malformedResponse",
    });
  });

  it("preserves the requested period on the returned series, so the UI can trust it over its own local state", async () => {
    mockFetchOnce(200, { values: [{ datetime: "2026-01-01", close: "100.00" }], meta: { currency: "USD" } });
    const series = await TwelveDataProvider.getHistorical!("AAPL", "stock", "MAX", "key");
    expect(series.period).toBe("MAX");
  });
});
