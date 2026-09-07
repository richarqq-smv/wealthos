import { StorageKeys } from "@/lib/storage";
import type { Liability } from "@/types/models";
import { generateId } from "@/utils/id";
import { nowISO } from "@/utils/date";
import { BaseRepository } from "./BaseRepository";

export type LiabilityInput = Omit<Liability, "id" | "createdAt" | "updatedAt" | "origin">;

class LiabilityRepositoryImpl extends BaseRepository<Liability> {
  async create(input: LiabilityInput): Promise<Liability> {
    const now = nowISO();
    const liability: Liability = {
      ...input,
      id: generateId(),
      origin: "manual",
      createdAt: now,
      updatedAt: now,
    };
    await this.save(liability);
    return liability;
  }

  async update(id: string, patch: Partial<LiabilityInput>): Promise<Liability | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;
    const updated: Liability = { ...existing, ...patch, updatedAt: nowISO() };
    await this.save(updated);
    return updated;
  }
}

export const LiabilityRepository = new LiabilityRepositoryImpl(StorageKeys.liabilities);
