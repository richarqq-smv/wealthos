import type { Investment, Transaction } from "@/types/models";
import {
  calculateMonthlyExpenses,
  calculatePortfolioAllocation,
  calculateSavingsRate,
} from "@/lib/calculations";
import { TRANSACTION_CATEGORY_LABEL } from "@/constants/categories";
import { formatMoneyCompact, formatPercentage } from "@/utils/money";
import { monthKey, previousMonthKey } from "@/utils/date";

export interface Insight {
  id: string;
  text: string;
}

/**
 * Rule-based, entirely local summaries of the user's own data — never
 * financial advice, just arithmetic phrased as a sentence.
 */
export function generateInsights(transactions: Transaction[], investments: Investment[]): Insight[] {
  const insights: Insight[] = [];
  const thisMonth = monthKey();
  const lastMonth = previousMonthKey(thisMonth);

  const expensesThisMonth = calculateMonthlyExpenses(transactions, thisMonth);
  const expensesLastMonth = calculateMonthlyExpenses(transactions, lastMonth);

  if (expensesLastMonth > 0) {
    const diff = expensesThisMonth - expensesLastMonth;
    const pct = Math.abs(diff) / expensesLastMonth;
    if (Math.abs(diff) > 500) {
      insights.push({
        id: "expenses-vs-last-month",
        text:
          diff < 0
            ? `Je uitgaven zijn deze maand ${formatPercentage(pct)} lager dan vorige maand.`
            : `Je uitgaven zijn deze maand ${formatPercentage(pct)} hoger dan vorige maand.`,
      });
    }
  }

  const byCategory = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    if (t.date.slice(0, 7) !== thisMonth) continue;
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amountMinor);
  }
  const topCategory = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1])[0];
  if (topCategory) {
    insights.push({
      id: "top-category",
      text: `Je grootste uitgavencategorie deze maand is ${TRANSACTION_CATEGORY_LABEL[topCategory[0] as keyof typeof TRANSACTION_CATEGORY_LABEL].toLowerCase()} (${formatMoneyCompact(topCategory[1])}).`,
    });
  }

  const incomeThisMonth = transactions
    .filter((t) => t.type === "income" && t.date.slice(0, 7) === thisMonth)
    .reduce((sum, t) => sum + t.amountMinor, 0);
  if (incomeThisMonth > 0) {
    const savingsRate = calculateSavingsRate(incomeThisMonth, expensesThisMonth);
    insights.push({
      id: "savings-rate",
      text: `Je spaart deze maand ${formatPercentage(savingsRate)} van je inkomen.`,
    });
  }

  if (investments.length > 0) {
    const allocation = calculatePortfolioAllocation(investments);
    const largest = allocation[0];
    if (largest) {
      insights.push({
        id: "portfolio-allocation",
        text: `Je portefeuille bestaat voor ${formatPercentage(largest.percentage)} uit ${largest.label.toLowerCase()}.`,
      });
    }
  }

  return insights;
}
