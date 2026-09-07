import { StorageKeys } from "@/lib/storage";
import type { Investment } from "@/types/models";
import { generateId } from "@/utils/id";
import { nowISO } from "@/utils/date";
import { BaseRepository } from "./BaseRepository";

export type InvestmentInput = Omit<Investment, "id" | "createdAt" | "updatedAt" | "origin">;

class InvestmentRepositoryImpl extends BaseRepository<Investment> {
  async create(input: InvestmentInput): Promise<Investment> {
    const now = nowISO();
    const investment: Investment = {
      ...input,
      id: generateId(),
      origin: "manual",
      createdAt: now,
      updatedAt: now,
    };
    await this.save(investment);
    return investment;
  }

  async update(id: string, patch: Partial<InvestmentInput>): Promise<Investment | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;
    const updated: Investment = { ...existing, ...patch, updatedAt: nowISO() };
    await this.save(updated);
    return updated;
  }
}

export const InvestmentRepository = new InvestmentRepositoryImpl(StorageKeys.investments);
