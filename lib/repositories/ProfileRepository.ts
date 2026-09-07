import { readGlobalValue, writeGlobalValue } from "@/lib/storage";
import type { Profile } from "@/types/models";

const PROFILES_KEY = "profiles";

class ProfileRepositoryImpl {
  async getAll(): Promise<Profile[]> {
    return (await readGlobalValue<Profile[]>(PROFILES_KEY)) ?? [];
  }

  async getById(id: string): Promise<Profile | undefined> {
    const all = await this.getAll();
    return all.find((profile) => profile.id === id);
  }

  async save(profile: Profile): Promise<void> {
    const all = await this.getAll();
    const index = all.findIndex((existing) => existing.id === profile.id);
    if (index >= 0) {
      all[index] = profile;
    } else {
      all.push(profile);
    }
    await writeGlobalValue(PROFILES_KEY, all);
  }

  async remove(id: string): Promise<void> {
    const all = await this.getAll();
    await writeGlobalValue(
      PROFILES_KEY,
      all.filter((profile) => profile.id !== id)
    );
  }
}

export const ProfileRepository = new ProfileRepositoryImpl();
