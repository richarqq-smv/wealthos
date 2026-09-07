import { readCollection, writeCollection } from "@/lib/storage";

export class BaseRepository<T extends { id: string }> {
  constructor(protected readonly key: string) {}

  async getAll(): Promise<T[]> {
    return readCollection<T>(this.key);
  }

  async getById(id: string): Promise<T | undefined> {
    const all = await this.getAll();
    return all.find((item) => item.id === id);
  }

  async save(item: T): Promise<void> {
    const all = await this.getAll();
    const index = all.findIndex((existing) => existing.id === item.id);
    if (index >= 0) {
      all[index] = item;
    } else {
      all.push(item);
    }
    await writeCollection(this.key, all);
  }

  async remove(id: string): Promise<void> {
    const all = await this.getAll();
    await writeCollection(
      this.key,
      all.filter((item) => item.id !== id)
    );
  }

  async replaceAll(items: T[]): Promise<void> {
    await writeCollection(this.key, items);
  }
}
