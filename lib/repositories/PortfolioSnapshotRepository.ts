import { StorageKeys } from "@/lib/storage";
import type { PortfolioSnapshot } from "@/types/models";
import { generateId } from "@/utils/id";
import { BaseRepository } from "./BaseRepository";

export type PortfolioSnapshotInput = Omit<PortfolioSnapshot, "id">;

class PortfolioSnapshotRepositoryImpl extends BaseRepository<PortfolioSnapshot> {
  async create(input: PortfolioSnapshotInput): Promise<PortfolioSnapshot> {
    const snapshot: PortfolioSnapshot = { ...input, id: generateId() };
    await this.save(snapshot);
    return snapshot;
  }

  async getSorted(): Promise<PortfolioSnapshot[]> {
    const all = await this.getAll();
    return all.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }
}

export const PortfolioSnapshotRepository = new PortfolioSnapshotRepositoryImpl(
  StorageKeys.portfolioSnapshots
);
