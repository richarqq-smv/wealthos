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

export async function readCollection<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export async function writeCollection<T>(key: string, items: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(items));
}

export async function readValue<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeValue<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(StorageKeys));
}
