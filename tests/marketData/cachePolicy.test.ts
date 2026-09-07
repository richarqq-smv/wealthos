import {
  isCompanyProfileStale,
  isDividendStale,
  isFxRateStale,
  isQuoteStale,
} from "@/lib/marketData/cachePolicy";

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function hoursAgo(hours: number): string {
  return minutesAgo(hours * 60);
}

describe("isQuoteStale", () => {
  it("is not stale just after fetching", () => {
    expect(isQuoteStale("stock", minutesAgo(0))).toBe(false);
  });

  it("uses a shorter staleness window for crypto than for stocks", () => {
    const timestamp = minutesAgo(7);
    expect(isQuoteStale("crypto", timestamp)).toBe(true);
    expect(isQuoteStale("stock", timestamp)).toBe(false);
  });

  it("is stale once the asset-type threshold has passed", () => {
    expect(isQuoteStale("etf", minutesAgo(11))).toBe(true);
  });
});

describe("isFxRateStale", () => {
  it("is fresh within the 10 minute window", () => {
    expect(isFxRateStale(minutesAgo(5))).toBe(false);
  });

  it("is stale past the 10 minute window", () => {
    expect(isFxRateStale(minutesAgo(15))).toBe(true);
  });
});

describe("isDividendStale", () => {
  it("is fresh within 24 hours", () => {
    expect(isDividendStale(hoursAgo(23))).toBe(false);
  });

  it("is stale past 24 hours", () => {
    expect(isDividendStale(hoursAgo(25))).toBe(true);
  });
});

describe("isCompanyProfileStale", () => {
  it("is fresh within 24 hours", () => {
    expect(isCompanyProfileStale(hoursAgo(1))).toBe(false);
  });

  it("is stale past 24 hours", () => {
    expect(isCompanyProfileStale(hoursAgo(48))).toBe(true);
  });
});
