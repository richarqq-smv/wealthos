import { create } from "zustand";
import { TransactionRepository, type TransactionInput } from "@/lib/repositories/TransactionRepository";
import { useAccountsStore } from "./accountsStore";
import type { Transaction, TransactionType } from "@/types/models";

/**
 * Account-balance impact of a transaction. Transfers do not adjust the
 * balance because this MVP's Transaction model tracks a single account per
 * entry (no destination account) — a transfer is recorded for cashflow
 * visibility only. Income adds to the account, expense and investment
 * outflows subtract from it. See README "Transaction impact" for the full
 * rationale, including how edits/deletes reverse the previous effect before
 * applying the new one to avoid double-booking.
 */
function balanceEffect(type: TransactionType, amountMinor: number): number {
  switch (type) {
    case "income":
      return amountMinor;
    case "expense":
    case "investment":
      return -amountMinor;
    case "transfer":
      return 0;
  }
}

interface TransactionsState {
  transactions: Transaction[];
  isLoading: boolean;
  hasLoaded: boolean;
  refresh: () => Promise<void>;
  addTransaction: (input: TransactionInput) => Promise<Transaction>;
  editTransaction: (id: string, patch: Partial<TransactionInput>) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
}

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  transactions: [],
  isLoading: false,
  hasLoaded: false,

  refresh: async () => {
    set({ isLoading: true });
    const transactions = await TransactionRepository.getSorted();
    set({ transactions, isLoading: false, hasLoaded: true });
  },

  addTransaction: async (input) => {
    const transaction = await TransactionRepository.create(input);
    const delta = balanceEffect(transaction.type, transaction.amountMinor);
    if (delta !== 0) {
      await useAccountsStore.getState().adjustBalance(transaction.accountId, delta);
    }
    set({ transactions: [transaction, ...get().transactions] });
    return transaction;
  },

  editTransaction: async (id, patch) => {
    const existing = get().transactions.find((t) => t.id === id);
    if (!existing) return;

    const updated = await TransactionRepository.update(id, patch);
    if (!updated) return;

    const reverseDelta = -balanceEffect(existing.type, existing.amountMinor);
    if (reverseDelta !== 0) {
      await useAccountsStore.getState().adjustBalance(existing.accountId, reverseDelta);
    }
    const applyDelta = balanceEffect(updated.type, updated.amountMinor);
    if (applyDelta !== 0) {
      await useAccountsStore.getState().adjustBalance(updated.accountId, applyDelta);
    }

    set({
      transactions: get()
        .transactions.map((t) => (t.id === id ? updated : t))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    });
  },

  removeTransaction: async (id) => {
    const existing = get().transactions.find((t) => t.id === id);
    if (!existing) return;
    await TransactionRepository.remove(id);
    const reverseDelta = -balanceEffect(existing.type, existing.amountMinor);
    if (reverseDelta !== 0) {
      await useAccountsStore.getState().adjustBalance(existing.accountId, reverseDelta);
    }
    set({ transactions: get().transactions.filter((t) => t.id !== id) });
  },
}));
