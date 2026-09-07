import { create } from "zustand";
import { InvestmentRepository, type InvestmentInput } from "@/lib/repositories/InvestmentRepository";
import {
  InvestmentTransactionRepository,
  type InvestmentTransactionInput,
} from "@/lib/repositories/InvestmentTransactionRepository";
import { calculateWeightedAveragePosition } from "@/lib/calculations";
import type { Investment, InvestmentTransaction } from "@/types/models";

interface InvestmentsState {
  investments: Investment[];
  investmentTransactions: InvestmentTransaction[];
  isLoading: boolean;
  hasLoaded: boolean;
  refresh: () => Promise<void>;
  addInvestment: (input: InvestmentInput) => Promise<Investment>;
  editInvestment: (id: string, patch: Partial<InvestmentInput>) => Promise<void>;
  removeInvestment: (id: string) => Promise<void>;
  recordPurchase: (
    investmentId: string,
    trade: Omit<InvestmentTransactionInput, "investmentId" | "type">
  ) => Promise<void>;
  recordSale: (
    investmentId: string,
    trade: Omit<InvestmentTransactionInput, "investmentId" | "type">
  ) => Promise<void>;
  getTransactionsFor: (investmentId: string) => InvestmentTransaction[];
}

async function recomputePosition(investmentId: string): Promise<void> {
  const investment = await InvestmentRepository.getById(investmentId);
  if (!investment) return;
  const transactions = await InvestmentTransactionRepository.getByInvestmentId(investmentId);
  const position = calculateWeightedAveragePosition(transactions);
  await InvestmentRepository.update(investmentId, {
    quantity: position.quantity,
    averagePriceMinor: position.averagePriceMinor,
  });
}

export const useInvestmentsStore = create<InvestmentsState>((set, get) => ({
  investments: [],
  investmentTransactions: [],
  isLoading: false,
  hasLoaded: false,

  refresh: async () => {
    set({ isLoading: true });
    const [investments, investmentTransactions] = await Promise.all([
      InvestmentRepository.getAll(),
      InvestmentTransactionRepository.getAll(),
    ]);
    set({ investments, investmentTransactions, isLoading: false, hasLoaded: true });
  },

  addInvestment: async (input) => {
    const investment = await InvestmentRepository.create(input);
    if (input.quantity > 0) {
      await InvestmentTransactionRepository.create({
        investmentId: investment.id,
        type: "buy",
        quantity: input.quantity,
        priceMinor: input.averagePriceMinor,
        date: input.purchaseDate,
      });
    }
    const [investments, investmentTransactions] = await Promise.all([
      InvestmentRepository.getAll(),
      InvestmentTransactionRepository.getAll(),
    ]);
    set({ investments, investmentTransactions });
    return investment;
  },

  editInvestment: async (id, patch) => {
    const updated = await InvestmentRepository.update(id, patch);
    if (!updated) return;
    set({ investments: get().investments.map((i) => (i.id === id ? updated : i)) });
  },

  removeInvestment: async (id) => {
    await InvestmentRepository.remove(id);
    await InvestmentTransactionRepository.removeByInvestmentId(id);
    set({
      investments: get().investments.filter((i) => i.id !== id),
      investmentTransactions: get().investmentTransactions.filter((t) => t.investmentId !== id),
    });
  },

  recordPurchase: async (investmentId, trade) => {
    await InvestmentTransactionRepository.create({ ...trade, investmentId, type: "buy" });
    await recomputePosition(investmentId);
    const [investments, investmentTransactions] = await Promise.all([
      InvestmentRepository.getAll(),
      InvestmentTransactionRepository.getAll(),
    ]);
    set({ investments, investmentTransactions });
  },

  recordSale: async (investmentId, trade) => {
    const investment = get().investments.find((i) => i.id === investmentId);
    const cappedQuantity = investment ? Math.min(trade.quantity, investment.quantity) : trade.quantity;
    await InvestmentTransactionRepository.create({
      ...trade,
      quantity: cappedQuantity,
      investmentId,
      type: "sell",
    });
    await recomputePosition(investmentId);
    const [investments, investmentTransactions] = await Promise.all([
      InvestmentRepository.getAll(),
      InvestmentTransactionRepository.getAll(),
    ]);
    set({ investments, investmentTransactions });
  },

  getTransactionsFor: (investmentId) => {
    return get()
      .investmentTransactions.filter((t) => t.investmentId === investmentId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },
}));
