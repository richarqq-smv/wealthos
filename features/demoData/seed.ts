import { AccountRepository } from "@/lib/repositories/AccountRepository";
import { BudgetRepository } from "@/lib/repositories/BudgetRepository";
import { InvestmentRepository } from "@/lib/repositories/InvestmentRepository";
import { InvestmentTransactionRepository } from "@/lib/repositories/InvestmentTransactionRepository";
import { LiabilityRepository } from "@/lib/repositories/LiabilityRepository";
import { PortfolioSnapshotRepository } from "@/lib/repositories/PortfolioSnapshotRepository";
import { TransactionRepository } from "@/lib/repositories/TransactionRepository";
import { calculateNetWorth } from "@/lib/calculations";
import {
  buildDemoAccounts,
  buildDemoBudgets,
  buildDemoInvestmentTransactions,
  buildDemoInvestments,
  buildDemoLiabilities,
  buildDemoPortfolioSnapshots,
  buildDemoTransactions,
} from "./fixtures";

export async function seedDemoData(): Promise<void> {
  const accounts = buildDemoAccounts();
  const investments = buildDemoInvestments();
  const liabilities = buildDemoLiabilities();
  const netWorthMinor = calculateNetWorth(accounts, investments, liabilities);

  await Promise.all([
    AccountRepository.replaceAll(accounts),
    InvestmentRepository.replaceAll(investments),
    InvestmentTransactionRepository.replaceAll(buildDemoInvestmentTransactions()),
    LiabilityRepository.replaceAll(liabilities),
    TransactionRepository.replaceAll(buildDemoTransactions()),
    BudgetRepository.replaceAll(buildDemoBudgets()),
    PortfolioSnapshotRepository.replaceAll(buildDemoPortfolioSnapshots(netWorthMinor)),
  ]);
}

export async function clearFinancialData(): Promise<void> {
  await Promise.all([
    AccountRepository.replaceAll([]),
    InvestmentRepository.replaceAll([]),
    InvestmentTransactionRepository.replaceAll([]),
    LiabilityRepository.replaceAll([]),
    TransactionRepository.replaceAll([]),
    BudgetRepository.replaceAll([]),
    PortfolioSnapshotRepository.replaceAll([]),
  ]);
}
