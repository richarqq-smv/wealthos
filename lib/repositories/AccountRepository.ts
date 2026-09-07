import { StorageKeys } from "@/lib/storage";
import type { Account } from "@/types/models";
import { generateId } from "@/utils/id";
import { nowISO } from "@/utils/date";
import { BaseRepository } from "./BaseRepository";

export type AccountInput = Omit<Account, "id" | "createdAt" | "updatedAt" | "origin">;

class AccountRepositoryImpl extends BaseRepository<Account> {
  async create(input: AccountInput): Promise<Account> {
    const now = nowISO();
    const account: Account = {
      ...input,
      id: generateId(),
      origin: "manual",
      createdAt: now,
      updatedAt: now,
    };
    await this.save(account);
    return account;
  }

  async update(id: string, patch: Partial<AccountInput>): Promise<Account | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;
    const updated: Account = { ...existing, ...patch, updatedAt: nowISO() };
    await this.save(updated);
    return updated;
  }
}

export const AccountRepository = new AccountRepositoryImpl(StorageKeys.accounts);
