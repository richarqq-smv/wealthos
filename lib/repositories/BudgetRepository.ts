import { StorageKeys } from "@/lib/storage";
import type { Budget } from "@/types/models";
import { generateId } from "@/utils/id";
import { nowISO } from "@/utils/date";
import { BaseRepository } from "./BaseRepository";

export type BudgetInput = Omit<Budget, "id" | "createdAt" | "updatedAt">;

class BudgetRepositoryImpl extends BaseRepository<Budget> {
  async create(input: BudgetInput): Promise<Budget> {
    const now = nowISO();
    const budget: Budget = { ...input, id: generateId(), createdAt: now, updatedAt: now };
    await this.save(budget);
    return budget;
  }

  async update(id: string, patch: Partial<BudgetInput>): Promise<Budget | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;
    const updated: Budget = { ...existing, ...patch, updatedAt: nowISO() };
    await this.save(updated);
    return updated;
  }

  async getByMonth(month: string): Promise<Budget[]> {
    const all = await this.getAll();
    return all.filter((b) => b.month === month);
  }
}

export const BudgetRepository = new BudgetRepositoryImpl(StorageKeys.budgets);
