import type {
  Account,
  Budget,
  Investment,
  InvestmentTransaction,
  Liability,
  Transaction,
} from "@/types/models";
import { isInMonth } from "@/utils/date";
import { convertAmountMinor, type FxRateLookup } from "@/lib/marketData/currencyConversion";

/**
 * Central financial calculations. The UI never derives money totals itself —
 * every screen reads these so a single change to the underlying data is
 * reflected everywhere (dashboard, accounts, investments, analytics).
 */

export function calculateTotalCash(accounts: Account[]): number {
  return accounts.reduce((sum, account) => sum + account.balanceMinor, 0);
}

export function calculateInvestmentValue(investment: Investment): number {
  return Math.round(investment.quantity * investment.currentPriceMinor);
}

export function calculateInvestedCapital(investment: Investment): number {
  return Math.round(investment.quantity * investment.averagePriceMinor);
}

export function calculatePortfolioValue(investments: Investment[]): number {
  return investments.reduce((sum, inv) => sum + calculateInvestmentValue(inv), 0);
}

export function calculateTotalInvestedCapital(investments: Investment[]): number {
  return investments.reduce((sum, inv) => sum + calculateInvestedCapital(inv), 0);
}

export function calculateTotalAssets(accounts: Account[], investments: Investment[]): number {
  return calculateTotalCash(accounts) + calculatePortfolioValue(investments);
}

/**
 * FX-aware siblings of the functions above. 0.1.0 assumed every investment
 * shared one currency; live market data means a position can now be priced
 * in USD/GBP/etc. while the portfolio total is shown in the user's base
 * currency. These wrap the original functions rather than replacing them —
 * same-currency portfolios (demo data, EUR-only holdings) get identical
 * results, and the un-converted functions keep working for every existing
 * caller and test.
 */
export function calculateInvestmentValueInBaseCurrency(
  investment: Investment,
  baseCurrency: string,
  fxLookup: FxRateLookup
): number {
  return convertAmountMinor(calculateInvestmentValue(investment), investment.currency, baseCurrency, fxLookup);
}

export function calculateInvestedCapitalInBaseCurrency(
  investment: Investment,
  baseCurrency: string,
  fxLookup: FxRateLookup
): number {
  return convertAmountMinor(calculateInvestedCapital(investment), investment.currency, baseCurrency, fxLookup);
}

export function calculatePortfolioValueInBaseCurrency(
  investments: Investment[],
  baseCurrency: string,
  fxLookup: FxRateLookup
): number {
  return investments.reduce(
    (sum, inv) => sum + calculateInvestmentValueInBaseCurrency(inv, baseCurrency, fxLookup),
    0
  );
}

export function calculateTotalInvestedCapitalInBaseCurrency(
  investments: Investment[],
  baseCurrency: string,
  fxLookup: FxRateLookup
): number {
  return investments.reduce(
    (sum, inv) => sum + calculateInvestedCapitalInBaseCurrency(inv, baseCurrency, fxLookup),
    0
  );
}

export function calculateTotalAssetsInBaseCurrency(
  accounts: Account[],
  investments: Investment[],
  baseCurrency: string,
  fxLookup: FxRateLookup
): number {
  return calculateTotalCash(accounts) + calculatePortfolioValueInBaseCurrency(investments, baseCurrency, fxLookup);
}

export function calculateNetWorthInBaseCurrency(
  accounts: Account[],
  investments: Investment[],
  liabilities: Liability[],
  baseCurrency: string,
  fxLookup: FxRateLookup
): number {
  return (
    calculateTotalAssetsInBaseCurrency(accounts, investments, baseCurrency, fxLookup) -
    calculateTotalLiabilities(liabilities)
  );
}

export function calculateTotalLiabilities(liabilities: Liability[]): number {
  return liabilities.reduce((sum, liability) => sum + liability.amountMinor, 0);
}

export function calculateNetWorth(
  accounts: Account[],
  investments: Investment[],
  liabilities: Liability[]
): number {
  return calculateTotalAssets(accounts, investments) - calculateTotalLiabilities(liabilities);
}

export function calculateProfitLoss(currentValueMinor: number, investedMinor: number): number {
  return currentValueMinor - investedMinor;
}

export function calculateReturnPercentage(investedMinor: number, profitLossMinor: number): number {
  if (investedMinor === 0) return 0;
  return profitLossMinor / investedMinor;
}

export interface AllocationSlice {
  key: string;
  label: string;
  valueMinor: number;
  percentage: number;
}

function buildAllocation(buckets: Map<string, number>): AllocationSlice[] {
  const total = Array.from(buckets.values()).reduce((sum, v) => sum + v, 0);
  return Array.from(buckets.entries())
    .filter(([, value]) => value > 0)
    .map(([key, valueMinor]) => ({
      key,
      label: key,
      valueMinor,
      percentage: total === 0 ? 0 : valueMinor / total,
    }))
    .sort((a, b) => b.valueMinor - a.valueMinor);
}

/** Dashboard-level allocation across the entire wealth: bank, savings, cash, and every investment type. */
export function calculateWealthAllocation(
  accounts: Account[],
  investments: Investment[]
): AllocationSlice[] {
  const buckets = new Map<string, number>([
    ["Bank", 0],
    ["Sparen", 0],
    ["Contant", 0],
    ["Aandelen", 0],
    ["ETF", 0],
    ["Crypto", 0],
    ["Overig", 0],
  ]);

  for (const account of accounts) {
    if (account.type === "checking") buckets.set("Bank", (buckets.get("Bank") ?? 0) + account.balanceMinor);
    else if (account.type === "savings") buckets.set("Sparen", (buckets.get("Sparen") ?? 0) + account.balanceMinor);
    else if (account.type === "cash") buckets.set("Contant", (buckets.get("Contant") ?? 0) + account.balanceMinor);
    else buckets.set("Overig", (buckets.get("Overig") ?? 0) + account.balanceMinor);
  }

  for (const investment of investments) {
    const value = calculateInvestmentValue(investment);
    if (investment.type === "stock") buckets.set("Aandelen", (buckets.get("Aandelen") ?? 0) + value);
    else if (investment.type === "etf") buckets.set("ETF", (buckets.get("ETF") ?? 0) + value);
    else if (investment.type === "crypto") buckets.set("Crypto", (buckets.get("Crypto") ?? 0) + value);
    else buckets.set("Overig", (buckets.get("Overig") ?? 0) + value);
  }

  return buildAllocation(buckets);
}

/** Investments-screen allocation: breakdown of the portfolio itself by investment type. */
export function calculatePortfolioAllocation(investments: Investment[]): AllocationSlice[] {
  const buckets = new Map<string, number>([
    ["Aandelen", 0],
    ["ETF", 0],
    ["Crypto", 0],
    ["Fonds", 0],
    ["Overig", 0],
  ]);
  const typeToLabel: Record<Investment["type"], string> = {
    stock: "Aandelen",
    etf: "ETF",
    crypto: "Crypto",
    fund: "Fonds",
    other: "Overig",
  };
  for (const investment of investments) {
    const label = typeToLabel[investment.type];
    buckets.set(label, (buckets.get(label) ?? 0) + calculateInvestmentValue(investment));
  }
  return buildAllocation(buckets);
}

export interface WeightedPosition {
  quantity: number;
  averagePriceMinor: number;
  investedMinor: number;
}

/**
 * Replays buy/sell transactions in chronological order to derive the current
 * quantity and weighted-average purchase price. A sell never changes the
 * average price (only realizes part of the position) and quantity is
 * clamped at zero so an over-sell in bad data can never go negative.
 */
/**
 * Rounds to 8 decimal places (satoshi-level precision, generous for any
 * stock/ETF/crypto quantity) so repeated float addition/subtraction never
 * surfaces IEEE-754 artifacts like `0.0999999999999999` in the UI.
 */
function roundQuantity(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}

export function calculateWeightedAveragePosition(
  transactions: InvestmentTransaction[]
): WeightedPosition {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let quantity = 0;
  let investedMinor = 0;

  for (const tx of sorted) {
    if (tx.type === "buy") {
      investedMinor += tx.quantity * tx.priceMinor;
      quantity = roundQuantity(quantity + tx.quantity);
    } else {
      const sellQuantity = Math.min(tx.quantity, quantity);
      const averagePriceMinor = quantity === 0 ? 0 : investedMinor / quantity;
      investedMinor -= sellQuantity * averagePriceMinor;
      quantity = roundQuantity(quantity - sellQuantity);
    }
  }

  quantity = Math.max(0, quantity);
  investedMinor = Math.max(0, Math.round(investedMinor));
  const averagePriceMinor = quantity === 0 ? 0 : Math.round(investedMinor / quantity);

  return { quantity, averagePriceMinor, investedMinor };
}

export function calculateMonthlyIncome(transactions: Transaction[], month: string): number {
  return transactions
    .filter((t) => t.type === "income" && isInMonth(t.date, month))
    .reduce((sum, t) => sum + t.amountMinor, 0);
}

export function calculateMonthlyExpenses(transactions: Transaction[], month: string): number {
  return transactions
    .filter((t) => t.type === "expense" && isInMonth(t.date, month))
    .reduce((sum, t) => sum + t.amountMinor, 0);
}

export function calculateNetCashflow(incomeMinor: number, expensesMinor: number): number {
  return incomeMinor - expensesMinor;
}

export function calculateSavingsRate(incomeMinor: number, expensesMinor: number): number {
  if (incomeMinor === 0) return 0;
  return (incomeMinor - expensesMinor) / incomeMinor;
}

export type BudgetStatus = "ok" | "warning" | "danger" | "over";

export function calculateBudgetStatus(percentage: number): BudgetStatus {
  if (percentage >= 1) return "over";
  if (percentage >= 0.9) return "danger";
  if (percentage >= 0.7) return "warning";
  return "ok";
}

export interface BudgetUsage {
  spentMinor: number;
  budgetMinor: number;
  percentage: number;
  status: BudgetStatus;
}

export function calculateBudgetUsage(budget: Budget, transactions: Transaction[]): BudgetUsage {
  const spentMinor = transactions
    .filter(
      (t) => t.type === "expense" && t.category === budget.category && isInMonth(t.date, budget.month)
    )
    .reduce((sum, t) => sum + t.amountMinor, 0);
  const percentage = budget.amountMinor === 0 ? 0 : spentMinor / budget.amountMinor;
  return {
    spentMinor,
    budgetMinor: budget.amountMinor,
    percentage,
    status: calculateBudgetStatus(percentage),
  };
}
