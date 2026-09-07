import { create } from "zustand";
import { BudgetRepository, type BudgetInput } from "@/lib/repositories/BudgetRepository";
import type { Budget } from "@/types/models";

interface BudgetsState {
  budgets: Budget[];
  isLoading: boolean;
  hasLoaded: boolean;
  refresh: () => Promise<void>;
  addBudget: (input: BudgetInput) => Promise<Budget>;
  editBudget: (id: string, patch: Partial<BudgetInput>) => Promise<void>;
  removeBudget: (id: string) => Promise<void>;
}

export const useBudgetsStore = create<BudgetsState>((set, get) => ({
  budgets: [],
  isLoading: false,
  hasLoaded: false,

  refresh: async () => {
    set({ isLoading: true });
    const budgets = await BudgetRepository.getAll();
    set({ budgets, isLoading: false, hasLoaded: true });
  },

  addBudget: async (input) => {
    const budget = await BudgetRepository.create(input);
    set({ budgets: [...get().budgets, budget] });
    return budget;
  },

  editBudget: async (id, patch) => {
    const updated = await BudgetRepository.update(id, patch);
    if (!updated) return;
    set({ budgets: get().budgets.map((b) => (b.id === id ? updated : b)) });
  },

  removeBudget: async (id) => {
    await BudgetRepository.remove(id);
    set({ budgets: get().budgets.filter((b) => b.id !== id) });
  },
}));
