import AsyncStorage from "@react-native-async-storage/async-storage";

const NAMESPACE = "wealthos";

export const StorageKeys = {
  accounts: `${NAMESPACE}:accounts`,
  investments: `${NAMESPACE}:investments`,
  investmentTransactions: `${NAMESPACE}:investmentTransactions`,
  transactions: `${NAMESPACE}:transactions`,
  budgets: `${NAMESPACE}:budgets`,
  liabilities: `${NAMESPACE}:liabilities`,
  portfolioSnapshots: `${NAMESPACE}:portfolioSnapshots`,
  settings: `${NAMESPACE}:settings`,
  bootstrapped: `${NAMESPACE}:bootstrapped`,
} as const;

/**
 * The profile currently logged in for this session. Set once at login/
 * switch/logout (`store/profileStore.ts`) and read by every function below —
 * every repository (`BaseRepository`, `SettingsRepository`,
 * `MarketDataCacheRepository`) already funnels through `readValue`/
 * `writeValue`/`readCollection`/`writeCollection`, so scoping just these four
 * functions gives every repository full per-profile data isolation with zero
 * changes to any individual repository file.
 */
let activeProfileId: string | null = null;

export function setActiveProfileId(id: string | null): void {
  activeProfileId = id;
}

export function getActiveProfileId(): string | null {
  return activeProfileId;
}

/** Every existing caller already passes a fully-namespaced key like "wealthos:accounts" — this inserts the profile segment right after the namespace. */
function scopedKey(key: string): string {
  if (!activeProfileId) return key;
  const withoutNamespace = key.startsWith(`${NAMESPACE}:`) ? key.slice(NAMESPACE.length + 1) : key;
  return `${NAMESPACE}:profile:${activeProfileId}:${withoutNamespace}`;
}

export async function readCollection<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(scopedKey(key));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export async function writeCollection<T>(key: string, items: T[]): Promise<void> {
  await AsyncStorage.setItem(scopedKey(key), JSON.stringify(items));
}

export async function readValue<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(scopedKey(key));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeValue<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(scopedKey(key), JSON.stringify(value));
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(StorageKeys).map(scopedKey));
}

/**
 * Deletes every stored key belonging to a specific profile, regardless of
 * which repository wrote it — used when a profile itself is deleted. Looks
 * up all keys rather than the fixed `StorageKeys` list so it also removes
 * the market-data cache (`wealthos:marketDataCache`, scoped) and anything
 * else stored under that profile's namespace.
 */
export async function clearProfileData(profileId: string): Promise<void> {
  const prefix = `${NAMESPACE}:profile:${profileId}:`;
  const allKeys = await AsyncStorage.getAllKeys();
  const ownedKeys = allKeys.filter((key) => key.startsWith(prefix));
  if (ownedKeys.length > 0) {
    await AsyncStorage.multiRemove(ownedKeys);
  }
}

/**
 * Never profile-scoped — used only for the profile registry itself (the
 * list of local profiles must be readable before anyone is logged in) and
 * for one-time migration bookkeeping.
 */
export async function readGlobalValue<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(`${NAMESPACE}:${key}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeGlobalValue<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(`${NAMESPACE}:${key}`, JSON.stringify(value));
}

/** Raw AsyncStorage access for migration only — reads/writes an exact, already-formed key with no namespace/scoping applied. */
export async function readRawKey(key: string): Promise<string | null> {
  return AsyncStorage.getItem(key);
}

export async function writeRawKey(key: string, raw: string): Promise<void> {
  await AsyncStorage.setItem(key, raw);
}

export async function removeRawKey(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

export async function getAllStorageKeys(): Promise<readonly string[]> {
  return AsyncStorage.getAllKeys();
}
