import { create } from "zustand";
import { AccountRepository, type AccountInput } from "@/lib/repositories/AccountRepository";
import type { Account } from "@/types/models";

interface AccountsState {
  accounts: Account[];
  isLoading: boolean;
  hasLoaded: boolean;
  refresh: () => Promise<void>;
  addAccount: (input: AccountInput) => Promise<Account>;
  editAccount: (id: string, patch: Partial<AccountInput>) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;
  adjustBalance: (id: string, deltaMinor: number) => Promise<void>;
}

export const useAccountsStore = create<AccountsState>((set, get) => ({
  accounts: [],
  isLoading: false,
  hasLoaded: false,

  refresh: async () => {
    set({ isLoading: true });
    const accounts = await AccountRepository.getAll();
    set({ accounts, isLoading: false, hasLoaded: true });
  },

  addAccount: async (input) => {
    const account = await AccountRepository.create(input);
    set({ accounts: [...get().accounts, account] });
    return account;
  },

  editAccount: async (id, patch) => {
    const updated = await AccountRepository.update(id, patch);
    if (!updated) return;
    set({ accounts: get().accounts.map((a) => (a.id === id ? updated : a)) });
  },

  removeAccount: async (id) => {
    await AccountRepository.remove(id);
    set({ accounts: get().accounts.filter((a) => a.id !== id) });
  },

  adjustBalance: async (id, deltaMinor) => {
    const account = get().accounts.find((a) => a.id === id);
    if (!account) return;
    const updated = await AccountRepository.update(id, {
      balanceMinor: account.balanceMinor + deltaMinor,
    });
    if (!updated) return;
    set({ accounts: get().accounts.map((a) => (a.id === id ? updated : a)) });
  },
}));
