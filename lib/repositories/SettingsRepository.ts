import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { StorageKeys } from "@/lib/storage";
import { readValue, writeValue } from "@/lib/storage";
import type { Settings } from "@/types/models";

const PIN_HASH_KEY = "wealthos_pin_hash";

export const DEFAULT_SETTINGS: Settings = {
  themePreference: "system",
  currency: "EUR",
  privacyMode: false,
  appLockMethod: "none",
  pinHash: null,
  onboardingCompleted: false,
  demoModeActive: false,
  userName: "",
  marketData: {
    enabled: false,
    twelveDataConfigured: false,
    alphaVantageConfigured: false,
    assetToggles: {
      stocks: true,
      etf: true,
      crypto: true,
      forex: true,
      historical: true,
      dividend: true,
      companyInfo: true,
    },
    autoRefresh: true,
    refreshIntervalMinutes: 10,
    lastSuccessfulUpdate: null,
  },
};

/**
 * expo-secure-store has no web implementation and can also fail on devices
 * without a secure enclave. Settings must load regardless, so every call is
 * wrapped: a PIN just won't survive on an unsupported platform rather than
 * blocking bootstrap forever.
 */
async function safeGetPin(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    return await SecureStore.getItemAsync(PIN_HASH_KEY);
  } catch {
    return null;
  }
}

async function safeSetPin(value: string | null): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    if (value) {
      await SecureStore.setItemAsync(PIN_HASH_KEY, value);
    } else {
      await SecureStore.deleteItemAsync(PIN_HASH_KEY);
    }
  } catch {
    // Ignored: PIN storage is best-effort on platforms without SecureStore support.
  }
}

class SettingsRepositoryImpl {
  async get(): Promise<Settings> {
    const stored = await readValue<Omit<Settings, "pinHash">>(StorageKeys.settings);
    const pinHash = await safeGetPin();
    return { ...DEFAULT_SETTINGS, ...stored, pinHash };
  }

  async update(patch: Partial<Settings>): Promise<Settings> {
    const current = await this.get();
    const next: Settings = { ...current, ...patch };

    if ("pinHash" in patch) {
      await safeSetPin(next.pinHash);
    }

    const { pinHash: _pinHash, ...rest } = next;
    await writeValue(StorageKeys.settings, rest);
    return next;
  }

  async reset(): Promise<void> {
    await safeSetPin(null);
    await writeValue(StorageKeys.settings, DEFAULT_SETTINGS);
  }
}

export const SettingsRepository = new SettingsRepositoryImpl();
