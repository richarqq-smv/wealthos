import type { Account, Transaction } from "@/types/models";
import type { BankingProvider } from "@/types/providers";
import { buildDemoAccounts, buildDemoTransactions } from "@/features/demoData/fixtures";

/**
 * Stands in for a future Open Banking / PSD2 integration. Returns the same
 * shaped data a real provider would, so the UI never has to know the
 * difference — only the `isMock` flag distinguishes it, used to label data
 * as "Demo" in the UI instead of pretending it is a live bank feed.
 */
export class MockBankingProvider implements BankingProvider {
  readonly id = "mock-banking";
  readonly isMock = true;

  async getAccounts(): Promise<Account[]> {
    return buildDemoAccounts();
  }

  async getTransactions(accountId: string): Promise<Transaction[]> {
    return buildDemoTransactions().filter((t) => t.accountId === accountId);
  }
}

export const mockBankingProvider = new MockBankingProvider();
