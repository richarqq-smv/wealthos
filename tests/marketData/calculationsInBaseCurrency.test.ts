import {
  calculateInvestmentValueInBaseCurrency,
  calculateNetWorthInBaseCurrency,
  calculatePortfolioValueInBaseCurrency,
  calculateTotalInvestedCapitalInBaseCurrency,
} from "@/lib/calculations";
import { buildFxLookup } from "@/lib/marketData/currencyConversion";
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

describe("calculateNetWorthInBaseCurrency", () => {
  it("nets FX-converted assets against liabilities (which are always base-currency)", () => {
    const accounts = [account({ balanceMinor: 100_000, currency: "EUR" })];
    const investments = [investment({ quantity: 10, currentPriceMinor: 20_000, currency: "USD" })];
    const liabilities = [liability({ amountMinor: 50_000 })];
    const lookup = buildFxLookup({ "USD:EUR": 0.5 });
    // cash: 100_000 + investments: 200_000 USD -> 100_000 EUR = 200_000 - liabilities 50_000
    expect(calculateNetWorthInBaseCurrency(accounts, investments, liabilities, "EUR", lookup)).toBe(150_000);
  });
});
