import { StorageKeys, readValue, writeValue } from "@/lib/storage";
import type { BrokerImportRecord } from "@/types/models";
import { generateId } from "@/utils/id";
import { nowISO } from "@/utils/date";
import { BaseRepository } from "./BaseRepository";

export type BrokerImportRecordInput = Omit<BrokerImportRecord, "id" | "importedAt">;

class BrokerImportRepositoryImpl extends BaseRepository<BrokerImportRecord> {
  async create(input: BrokerImportRecordInput): Promise<BrokerImportRecord> {
    const record: BrokerImportRecord = {
      ...input,
      id: generateId(),
      importedAt: nowISO(),
    };
    await this.save(record);
    return record;
  }

  /** Most recent imports first — matches how import history is always displayed. */
  async getAllSorted(): Promise<BrokerImportRecord[]> {
    const all = await this.getAll();
    return [...all].sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
  }
}

export const BrokerImportRepository = new BrokerImportRepositoryImpl(StorageKeys.brokerImports);

/**
 * Persistent dedup ledger, checked before a broker import writes any new
 * transaction — so re-uploading the same export files a second time is a
 * true no-op, not just "deduped within this session's preview" like the
 * existing cash-CSV importer. A flat string set, not a BaseRepository
 * collection, since fingerprints have no other fields worth modeling.
 */
export const ImportedFingerprintStore = {
  async getAll(): Promise<Set<string>> {
    const list = await readValue<string[]>(StorageKeys.importedTransactionFingerprints);
    return new Set(list ?? []);
  },

  /** Adds many fingerprints in one write — always called once per confirmed import, never per row. */
  async addMany(fingerprints: string[]): Promise<void> {
    if (fingerprints.length === 0) return;
    const existing = await this.getAll();
    fingerprints.forEach((fp) => existing.add(fp));
    await writeValue(StorageKeys.importedTransactionFingerprints, Array.from(existing));
  },
};
