import {
  calculateInvestmentValueInBaseCurrency,
  calculateNetWorthInBaseCurrency,
  calculatePortfolioValueInBaseCurrency,
  calculateTotalCash,
  calculateTotalCashInBaseCurrency,
  calculateTotalInvestedCapitalInBaseCurrency,
} from "@/lib/calculations";
import { buildFxLookup, type FxRateLookup } from "@/lib/marketData/currencyConversion";
import type { Account, Investment, Liability } from "@/types/models";

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
    ...overrides,
  };
}

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: "a1",
    name: "Test",
    institution: "Test Bank",
    type: "checking",
    balanceMinor: 100_000,
    currency: "EUR",
    origin: "manual",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function liability(overrides: Partial<Liability> = {}): Liability {
  return {
    id: "l1",
    name: "Lening",
    type: "loan",
    amountMinor: 50_000,
    origin: "manual",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("calculateInvestmentValueInBaseCurrency", () => {
  it("matches the plain (non-FX) value for a same-currency portfolio", () => {
    const inv = investment({ quantity: 10, currentPriceMinor: 15_000, currency: "EUR" });
    const lookup = buildFxLookup({});
    expect(calculateInvestmentValueInBaseCurrency(inv, "EUR", lookup)).toBe(150_000);
  });

  it("converts a foreign-currency position into the base currency", () => {
    const inv = investment({ quantity: 10, currentPriceMinor: 15_000, currency: "USD" });
    const lookup = buildFxLookup({ "USD:EUR": 0.9 });
    expect(calculateInvestmentValueInBaseCurrency(inv, "EUR", lookup)).toBe(135_000);
  });
});

describe("calculatePortfolioValueInBaseCurrency", () => {
  it("sums a mixed-currency portfolio correctly", () => {
    const investments = [
      investment({ id: "i1", quantity: 10, currentPriceMinor: 10_000, currency: "EUR" }),
      investment({ id: "i2", quantity: 5, currentPriceMinor: 20_000, currency: "USD" }),
    ];
    const lookup = buildFxLookup({ "USD:EUR": 0.9 });
    // i1: 10 * 10_000 = 100_000 EUR
    // i2: 5 * 20_000 = 100_000 USD -> 90_000 EUR
    expect(calculatePortfolioValueInBaseCurrency(investments, "EUR", lookup)).toBe(190_000);
  });

  it("degrades to native-currency amounts when no FX rate is cached (offline)", () => {
    const investments = [investment({ quantity: 1, currentPriceMinor: 50_000, currency: "GBP" })];
    const lookup = buildFxLookup({});
    expect(calculatePortfolioValueInBaseCurrency(investments, "EUR", lookup)).toBe(50_000);
  });
});

describe("calculateTotalInvestedCapitalInBaseCurrency", () => {
  it("converts invested capital per position before summing", () => {
    const investments = [
      investment({ id: "i1", quantity: 10, averagePriceMinor: 8_000, currency: "USD" }),
    ];
    const lookup = buildFxLookup({ "USD:EUR": 0.9 });
    expect(calculateTotalInvestedCapitalInBaseCurrency(investments, "EUR", lookup)).toBe(72_000);
  });
});

describe("calculateTotalCashInBaseCurrency — H3 (multi-currency accounts)", () => {
  it("Test A (EUR only): matches calculateTotalCash exactly for an all-EUR portfolio", () => {
    const accounts = [
      account({ id: "a1", balanceMinor: 100_000, currency: "EUR" }),
      account({ id: "a2", balanceMinor: 50_000, currency: "EUR" }),
    ];
    const lookup = buildFxLookup({});
    expect(calculateTotalCashInBaseCurrency(accounts, "EUR", lookup)).toBe(calculateTotalCash(accounts));
    expect(calculateTotalCashInBaseCurrency(accounts, "EUR", lookup)).toBe(150_000);
  });

  it("Test B (single USD account): converts using the cached USD/EUR rate", () => {
    const accounts = [account({ balanceMinor: 10_000, currency: "USD" })];
    const lookup = buildFxLookup({ "USD:EUR": 0.9 });
    expect(calculateTotalCashInBaseCurrency(accounts, "EUR", lookup)).toBe(9_000);
  });

  it("Test C (mixed EUR/USD/GBP accounts): sums each account converted into the base currency", () => {
    const accounts = [
      account({ id: "a1", balanceMinor: 10_000, currency: "EUR" }),
      account({ id: "a2", balanceMinor: 10_000, currency: "USD" }),
      account({ id: "a3", balanceMinor: 10_000, currency: "GBP" }),
    ];
    const lookup = buildFxLookup({ "USD:EUR": 0.9, "GBP:EUR": 1.15 });
    // 10_000 EUR + (10_000 USD -> 9_000 EUR) + (10_000 GBP -> 11_500 EUR) = 30_500
    expect(calculateTotalCashInBaseCurrency(accounts, "EUR", lookup)).toBe(30_500);
  });

  it("Test D (missing FX rate): degrades to the native amount — no crash, no NaN, no Infinity", () => {
    const accounts = [account({ balanceMinor: 10_000, currency: "USD" })];
    const lookup: FxRateLookup = () => null; // simulates "no rate cached yet / offline"
    const result = calculateTotalCashInBaseCurrency(accounts, "EUR", lookup);
    expect(result).toBe(10_000);
    expect(Number.isNaN(result)).toBe(false);
    expect(Number.isFinite(result)).toBe(true);
  });

  it("Test E (same currency): EUR account with an EUR base never consults the FX lookup", () => {
    const accounts = [account({ balanceMinor: 10_000, currency: "EUR" })];
    const lookup = jest.fn<ReturnType<FxRateLookup>, Parameters<FxRateLookup>>(() => 1.5);
    expect(calculateTotalCashInBaseCurrency(accounts, "EUR", lookup)).toBe(10_000);
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe("calculateNetWorthInBaseCurrency", () => {
  it("nets FX-converted assets against liabilities (which are always base-currency)", () => {
    const accounts = [account({ balanceMinor: 100_000, currency: "EUR" })];
    const investments = [investment({ quantity: 10, currentPriceMinor: 20_000, currency: "USD" })];
    const liabilities = [liability({ amountMinor: 50_000 })];
    const lookup = buildFxLookup({ "USD:EUR": 0.5 });
    // cash: 100_000 + investments: 200_000 USD -> 100_000 EUR = 200_000 - liabilities 50_000
    expect(calculateNetWorthInBaseCurrency(accounts, investments, liabilities, "EUR", lookup)).toBe(150_000);
  });

  it("H3 regression: a EUR 10,000 account and a USD 10,000 account must NOT be treated as EUR 20,000", () => {
    const accounts = [
      account({ id: "eur", balanceMinor: 1_000_000, currency: "EUR" }), // EUR 10,000.00
      account({ id: "usd", balanceMinor: 1_000_000, currency: "USD" }), // USD 10,000.00
    ];
    const lookup = buildFxLookup({ "USD:EUR": 0.9 });
    const netWorth = calculateNetWorthInBaseCurrency(accounts, [], [], "EUR", lookup);
    // EUR 10,000 + (USD 10,000 -> EUR 9,000) = EUR 19,000 — never the naive EUR 20,000.
    expect(netWorth).toBe(1_900_000);
    expect(netWorth).not.toBe(2_000_000);
  });
});
