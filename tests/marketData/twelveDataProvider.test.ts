import { TwelveDataProvider } from "@/services/market/TwelveDataProvider";
import { MarketDataError } from "@/types/marketData";

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

describe("TwelveDataProvider.getQuote", () => {
  it("parses a successful quote response", async () => {
    mockFetchOnce(200, {
      symbol: "AAPL",
      close: "150.25",
      previous_close: "148.00",
      change: "2.25",
      percent_change: "1.52",
      currency: "USD",
    });

    const quote = await TwelveDataProvider.getQuote!("AAPL", "stock", "key");
    expect(quote.priceMinor).toBe(15025);
    expect(quote.currency).toBe("USD");
    expect(quote.provider).toBe("twelveData");
    expect(quote.isDelayed).toBe(true);
  });

  it("passes the exchange param through when the instrument is cross-listed", async () => {
    mockFetchOnce(200, { symbol: "ASML", close: "700.00", currency: "EUR" });
    await TwelveDataProvider.getQuote!("ASML", "stock", "key", "Euronext");
    const calledUrl = (globalThis.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain("exchange=Euronext");
  });

  it("throws invalidApiKey for a 401-style error body", async () => {
    mockFetchOnce(200, { status: "error", code: 401, message: "invalid apikey" });
    await expect(TwelveDataProvider.getQuote!("AAPL", "stock", "bad-key")).rejects.toMatchObject({
      kind: "invalidApiKey",
    });
  });

  it("throws rateLimited for a 429-style error body", async () => {
    mockFetchOnce(200, { status: "error", code: 429, message: "out of credits" });
    await expect(TwelveDataProvider.getQuote!("AAPL", "stock", "key")).rejects.toMatchObject({
      kind: "rateLimited",
    });
  });

  it("throws notFound for a 404-style error body (unknown symbol or plan-gated instrument)", async () => {
    mockFetchOnce(200, { status: "error", code: 404, message: "available starting with the Grow plan" });
    await expect(TwelveDataProvider.getQuote!("HEIA", "stock", "key")).rejects.toMatchObject({
      kind: "notFound",
    });
  });

  it("throws malformedResponse when the close price cannot be parsed", async () => {
    mockFetchOnce(200, { symbol: "AAPL", close: undefined });
    await expect(TwelveDataProvider.getQuote!("AAPL", "stock", "key")).rejects.toMatchObject({
      kind: "malformedResponse",
    });
  });

  it("throws networkUnavailable when the request aborts (timeout)", async () => {
    (globalThis.fetch as jest.Mock).mockImplementationOnce(() => {
      const error = new Error("aborted");
      error.name = "AbortError";
      return Promise.reject(error);
    });
    await expect(TwelveDataProvider.getQuote!("AAPL", "stock", "key")).rejects.toMatchObject({
      kind: "networkUnavailable",
    });
  });

  it("throws networkUnavailable for a plain network failure (offline)", async () => {
    (globalThis.fetch as jest.Mock).mockRejectedValueOnce(new Error("fetch failed"));
    await expect(TwelveDataProvider.getQuote!("AAPL", "stock", "key")).rejects.toBeInstanceOf(MarketDataError);
  });
});

describe("TwelveDataProvider.testConnection", () => {
  it("reports ok on a valid key", async () => {
    mockFetchOnce(200, { current_usage: 1, plan_limit: 8 });
    const result = await TwelveDataProvider.testConnection("good-key");
    expect(result.ok).toBe(true);
  });

  it("reports the failure kind on an invalid key", async () => {
    mockFetchOnce(200, { status: "error", code: 401, message: "invalid apikey" });
    const result = await TwelveDataProvider.testConnection("bad-key");
    expect(result).toMatchObject({ ok: false, kind: "invalidApiKey" });
  });
});

describe("TwelveDataProvider.getQuotesBatch", () => {
  it("uses the shared multi-symbol endpoint for plain (non-disambiguated) symbols", async () => {
    mockFetchOnce(200, {
      AAPL: { symbol: "AAPL", close: "150.00", currency: "USD" },
      MSFT: { symbol: "MSFT", close: "300.00", currency: "USD" },
    });
    const quotes = await TwelveDataProvider.getQuotesBatch!(
      [
        { providerSymbol: "AAPL", assetType: "stock" },
        { providerSymbol: "MSFT", assetType: "stock" },
      ],
      "key"
    );
    expect(quotes).toHaveLength(2);
    expect((globalThis.fetch as jest.Mock).mock.calls).toHaveLength(1);
  });

  it("routes exchange-disambiguated symbols through individual getQuote calls", async () => {
    mockFetchOnce(200, { symbol: "ASML", close: "700.00", currency: "EUR" });
    // Only one "plain" (non-disambiguated) symbol here, so it also goes through
    // the single-quote endpoint, not the multi-symbol keyed-by-symbol shape.
    mockFetchOnce(200, { symbol: "AAPL", close: "150.00", currency: "USD" });

    const quotes = await TwelveDataProvider.getQuotesBatch!(
      [
        { providerSymbol: "ASML", assetType: "stock", exchange: "Euronext" },
        { providerSymbol: "AAPL", assetType: "stock" },
      ],
      "key"
    );
    expect(quotes).toHaveLength(2);
    const firstUrl = (globalThis.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(firstUrl).toContain("exchange=Euronext");
  });

  it("skips a symbol that fails without failing the whole batch", async () => {
    mockFetchOnce(200, { status: "error", code: 404, message: "not found" });
    const quotes = await TwelveDataProvider.getQuotesBatch!(
      [{ providerSymbol: "XXXX", assetType: "stock", exchange: "Nowhere" }],
      "key"
    );
    expect(quotes).toHaveLength(0);
  });
});
