import { create } from "zustand";
import { LiabilityRepository, type LiabilityInput } from "@/lib/repositories/LiabilityRepository";
import type { Liability } from "@/types/models";

interface LiabilitiesState {
  liabilities: Liability[];
  isLoading: boolean;
  hasLoaded: boolean;
  refresh: () => Promise<void>;
  addLiability: (input: LiabilityInput) => Promise<Liability>;
  editLiability: (id: string, patch: Partial<LiabilityInput>) => Promise<void>;
  removeLiability: (id: string) => Promise<void>;
}

export const useLiabilitiesStore = create<LiabilitiesState>((set, get) => ({
  liabilities: [],
  isLoading: false,
  hasLoaded: false,

  refresh: async () => {
    set({ isLoading: true });
    const liabilities = await LiabilityRepository.getAll();
    set({ liabilities, isLoading: false, hasLoaded: true });
  },

  addLiability: async (input) => {
    const liability = await LiabilityRepository.create(input);
    set({ liabilities: [...get().liabilities, liability] });
    return liability;
  },

  editLiability: async (id, patch) => {
    const updated = await LiabilityRepository.update(id, patch);
    if (!updated) return;
    set({ liabilities: get().liabilities.map((l) => (l.id === id ? updated : l)) });
  },

  removeLiability: async (id) => {
    await LiabilityRepository.remove(id);
    set({ liabilities: get().liabilities.filter((l) => l.id !== id) });
  },
}));
