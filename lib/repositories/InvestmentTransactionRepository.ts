import { StorageKeys } from "@/lib/storage";
import type { InvestmentTransaction } from "@/types/models";
import { generateId } from "@/utils/id";
import { nowISO } from "@/utils/date";
import { BaseRepository } from "./BaseRepository";

export type InvestmentTransactionInput = Omit<InvestmentTransaction, "id" | "createdAt">;

class InvestmentTransactionRepositoryImpl extends BaseRepository<InvestmentTransaction> {
  async create(input: InvestmentTransactionInput): Promise<InvestmentTransaction> {
    const record: InvestmentTransaction = {
      ...input,
      id: generateId(),
      createdAt: nowISO(),
    };
    await this.save(record);
    return record;
  }

  async getByInvestmentId(investmentId: string): Promise<InvestmentTransaction[]> {
    const all = await this.getAll();
    return all
      .filter((tx) => tx.investmentId === investmentId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async removeByInvestmentId(investmentId: string): Promise<void> {
    const all = await this.getAll();
    await this.replaceAll(all.filter((tx) => tx.investmentId !== investmentId));
  }
}

export const InvestmentTransactionRepository = new InvestmentTransactionRepositoryImpl(
  StorageKeys.investmentTransactions
);
