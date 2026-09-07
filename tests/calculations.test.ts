import {
  calculateBudgetStatus,
  calculateBudgetUsage,
  calculateInvestedCapital,
  calculateInvestmentValue,
  calculateMonthlyExpenses,
  calculateMonthlyIncome,
  calculateNetCashflow,
  calculateNetWorth,
  calculatePortfolioAllocation,
  calculatePortfolioValue,
  calculateProfitLoss,
  calculateReturnPercentage,
  calculateSavingsRate,
  calculateTotalAssets,
  calculateTotalCash,
  calculateTotalLiabilities,
  calculateWealthAllocation,
  calculateWeightedAveragePosition,
} from "@/lib/calculations";
import type { Account, Budget, Investment, InvestmentTransaction, Liability, Transaction } from "@/types/models";

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

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "t1",
    type: "expense",
    amountMinor: 1000,
    description: "Test",
    category: "overig",
    accountId: "a1",
    date: "2026-03-15T00:00:00.000Z",
    origin: "manual",
    createdAt: "2026-03-15T00:00:00.000Z",
    updatedAt: "2026-03-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("cash and portfolio totals", () => {
  it("sums cash across accounts", () => {
    expect(calculateTotalCash([account({ balanceMinor: 1000 }), account({ balanceMinor: 2000 })])).toBe(3000);
  });

  it("returns zero for no accounts", () => {
    expect(calculateTotalCash([])).toBe(0);
  });

  it("handles negative balances (roodstand)", () => {
    expect(calculateTotalCash([account({ balanceMinor: -500 })])).toBe(-500);
  });

  it("computes investment value from quantity and current price", () => {
    expect(calculateInvestmentValue(investment({ quantity: 3, currentPriceMinor: 1000 }))).toBe(3000);
  });

  it("computes invested capital from quantity and average price", () => {
    expect(calculateInvestedCapital(investment({ quantity: 3, averagePriceMinor: 800 }))).toBe(2400);
  });

  it("sums portfolio value across investments", () => {
    const value = calculatePortfolioValue([
      investment({ quantity: 1, currentPriceMinor: 1000 }),
      investment({ quantity: 2, currentPriceMinor: 500 }),
    ]);
    expect(value).toBe(2000);
  });

  it("returns zero portfolio value for empty portfolio", () => {
    expect(calculatePortfolioValue([])).toBe(0);
  });
});

describe("net worth", () => {
  it("equals assets minus liabilities", () => {
    const accounts = [account({ balanceMinor: 10_000 })];
    const investments = [investment({ quantity: 1, currentPriceMinor: 5_000 })];
    const liabilities = [liability({ amountMinor: 3_000 })];
    const assets = calculateTotalAssets(accounts, investments);
    expect(assets).toBe(15_000);
    expect(calculateTotalLiabilities(liabilities)).toBe(3_000);
    expect(calculateNetWorth(accounts, investments, liabilities)).toBe(12_000);
  });

  it("can be negative when liabilities exceed assets", () => {
    const accounts = [account({ balanceMinor: 1_000 })];
    const liabilities = [liability({ amountMinor: 5_000 })];
    expect(calculateNetWorth(accounts, [], liabilities)).toBe(-4_000);
  });

  it("handles fully empty state", () => {
    expect(calculateNetWorth([], [], [])).toBe(0);
  });
});

describe("profit/loss and return percentage", () => {
  it("computes positive profit and return", () => {
    const profitLoss = calculateProfitLoss(1500, 1000);
    expect(profitLoss).toBe(500);
    expect(calculateReturnPercentage(1000, profitLoss)).toBeCloseTo(0.5);
  });

  it("computes a loss as negative return", () => {
    const profitLoss = calculateProfitLoss(800, 1000);
    expect(calculateReturnPercentage(1000, profitLoss)).toBeCloseTo(-0.2);
  });

  it("returns 0% when nothing was invested (avoids division by zero)", () => {
    expect(calculateReturnPercentage(0, 0)).toBe(0);
  });
});

describe("wealth and portfolio allocation", () => {
  it("groups accounts and investments into buckets that sum to 100%", () => {
    const accounts = [account({ type: "checking", balanceMinor: 6000 }), account({ type: "savings", balanceMinor: 4000 })];
    const investments = [investment({ type: "stock", quantity: 1, currentPriceMinor: 10_000 })];
    const allocation = calculateWealthAllocation(accounts, investments);
    const totalPercentage = allocation.reduce((sum, slice) => sum + slice.percentage, 0);
    expect(totalPercentage).toBeCloseTo(1);
    const stockSlice = allocation.find((s) => s.label === "Aandelen");
    expect(stockSlice?.valueMinor).toBe(10_000);
  });

  it("returns an empty array when there is nothing to allocate", () => {
    expect(calculateWealthAllocation([], [])).toEqual([]);
  });

  it("computes portfolio-only allocation by investment type", () => {
    const investments = [
      investment({ type: "stock", quantity: 1, currentPriceMinor: 1000 }),
      investment({ type: "crypto", quantity: 1, currentPriceMinor: 3000 }),
    ];
    const allocation = calculatePortfolioAllocation(investments);
    expect(allocation[0]?.label).toBe("Crypto");
    expect(allocation[0]?.percentage).toBeCloseTo(0.75);
  });
});

describe("weighted average purchase price", () => {
  const tx = (overrides: Partial<InvestmentTransaction>): InvestmentTransaction => ({
    id: "tx",
    investmentId: "i1",
    type: "buy",
    quantity: 1,
    priceMinor: 1000,
    date: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });

  it("returns zero position for no transactions", () => {
    expect(calculateWeightedAveragePosition([])).toEqual({ quantity: 0, averagePriceMinor: 0, investedMinor: 0 });
  });

  it("computes a simple single buy", () => {
    const position = calculateWeightedAveragePosition([tx({ quantity: 10, priceMinor: 1000 })]);
    expect(position).toEqual({ quantity: 10, averagePriceMinor: 1000, investedMinor: 10_000 });
  });

  it("computes the weighted average across two buys at different prices", () => {
    const position = calculateWeightedAveragePosition([
      tx({ quantity: 10, priceMinor: 1000, date: "2026-01-01T00:00:00.000Z" }),
      tx({ quantity: 10, priceMinor: 2000, date: "2026-02-01T00:00:00.000Z" }),
    ]);
    expect(position.quantity).toBe(20);
    expect(position.averagePriceMinor).toBe(1500);
    expect(position.investedMinor).toBe(30_000);
  });

  it("reduces quantity on a sell without changing the average price", () => {
    const position = calculateWeightedAveragePosition([
      tx({ type: "buy", quantity: 10, priceMinor: 1000, date: "2026-01-01T00:00:00.000Z" }),
      tx({ type: "sell", quantity: 4, priceMinor: 1500, date: "2026-02-01T00:00:00.000Z" }),
    ]);
    expect(position.quantity).toBe(6);
    expect(position.averagePriceMinor).toBe(1000);
  });

  it("never lets quantity go negative when a sell exceeds the position", () => {
    const position = calculateWeightedAveragePosition([
      tx({ type: "buy", quantity: 5, priceMinor: 1000, date: "2026-01-01T00:00:00.000Z" }),
      tx({ type: "sell", quantity: 100, priceMinor: 1000, date: "2026-02-01T00:00:00.000Z" }),
    ]);
    expect(position.quantity).toBe(0);
    expect(position.investedMinor).toBe(0);
  });

  it("orders out-of-order transactions by date before replaying them", () => {
    const position = calculateWeightedAveragePosition([
      tx({ type: "sell", quantity: 4, priceMinor: 1500, date: "2026-02-01T00:00:00.000Z" }),
      tx({ type: "buy", quantity: 10, priceMinor: 1000, date: "2026-01-01T00:00:00.000Z" }),
    ]);
    expect(position.quantity).toBe(6);
  });

  it("never surfaces IEEE-754 float artifacts in fractional crypto quantities", () => {
    // 0.045 + 0.105 - 0.05 === 0.09999999999999999 in raw floating point.
    const position = calculateWeightedAveragePosition([
      tx({ type: "buy", quantity: 0.105, priceMinor: 3800000, date: "2026-01-01T00:00:00.000Z" }),
      tx({ type: "buy", quantity: 0.045, priceMinor: 4100000, date: "2026-02-01T00:00:00.000Z" }),
      tx({ type: "sell", quantity: 0.05, priceMinor: 5850000, date: "2026-03-01T00:00:00.000Z" }),
    ]);
    expect(position.quantity).toBe(0.1);
  });
});

describe("income, expenses and savings rate", () => {
  it("sums income and expenses within the given month only", () => {
    const transactions = [
      transaction({ type: "income", amountMinor: 4000, date: "2026-03-01T00:00:00.000Z" }),
      transaction({ type: "expense", amountMinor: 1500, date: "2026-03-10T00:00:00.000Z" }),
      transaction({ type: "expense", amountMinor: 999, date: "2026-02-10T00:00:00.000Z" }),
    ];
    expect(calculateMonthlyIncome(transactions, "2026-03")).toBe(4000);
    expect(calculateMonthlyExpenses(transactions, "2026-03")).toBe(1500);
  });

  it("computes net cashflow and savings rate", () => {
    expect(calculateNetCashflow(4000, 1500)).toBe(2500);
    expect(calculateSavingsRate(4000, 1500)).toBeCloseTo(0.625);
  });

  it("returns a savings rate of 0 when there is no income", () => {
    expect(calculateSavingsRate(0, 500)).toBe(0);
  });
});

describe("budget usage and status", () => {
  const budget: Budget = {
    id: "b1",
    category: "boodschappen",
    month: "2026-03",
    amountMinor: 50_000,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  };

  it("classifies status thresholds correctly", () => {
    expect(calculateBudgetStatus(0.5)).toBe("ok");
    expect(calculateBudgetStatus(0.7)).toBe("warning");
    expect(calculateBudgetStatus(0.9)).toBe("danger");
    expect(calculateBudgetStatus(1)).toBe("over");
    expect(calculateBudgetStatus(1.4)).toBe("over");
  });

  it("only counts expenses in the matching category and month", () => {
    const transactions = [
      transaction({ category: "boodschappen", amountMinor: 20_000, date: "2026-03-05T00:00:00.000Z" }),
      transaction({ category: "boodschappen", amountMinor: 20_000, date: "2026-02-05T00:00:00.000Z" }),
      transaction({ category: "wonen", amountMinor: 20_000, date: "2026-03-05T00:00:00.000Z" }),
      transaction({ type: "income", category: "boodschappen", amountMinor: 20_000, date: "2026-03-05T00:00:00.000Z" }),
    ];
    const usage = calculateBudgetUsage(budget, transactions);
    expect(usage.spentMinor).toBe(20_000);
    expect(usage.percentage).toBeCloseTo(0.4);
    expect(usage.status).toBe("ok");
  });

  it("handles a zero-amount budget without dividing by zero", () => {
    const usage = calculateBudgetUsage({ ...budget, amountMinor: 0 }, []);
    expect(usage.percentage).toBe(0);
    expect(usage.status).toBe("ok");
  });
});
