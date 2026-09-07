import { StorageKeys } from "@/lib/storage";
import type { Transaction } from "@/types/models";
import { generateId } from "@/utils/id";
import { nowISO } from "@/utils/date";
import { BaseRepository } from "./BaseRepository";

export type TransactionInput = Omit<Transaction, "id" | "createdAt" | "updatedAt" | "origin">;

class TransactionRepositoryImpl extends BaseRepository<Transaction> {
  async create(input: TransactionInput): Promise<Transaction> {
    const now = nowISO();
    const transaction: Transaction = {
      ...input,
      id: generateId(),
      origin: "manual",
      createdAt: now,
      updatedAt: now,
    };
    await this.save(transaction);
    return transaction;
  }

  async update(id: string, patch: Partial<TransactionInput>): Promise<Transaction | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;
    const updated: Transaction = { ...existing, ...patch, updatedAt: nowISO() };
    await this.save(updated);
    return updated;
  }

  async getByAccountId(accountId: string): Promise<Transaction[]> {
    const all = await this.getAll();
    return all
      .filter((t) => t.accountId === accountId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getSorted(): Promise<Transaction[]> {
    const all = await this.getAll();
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}

export const TransactionRepository = new TransactionRepositoryImpl(StorageKeys.transactions);
