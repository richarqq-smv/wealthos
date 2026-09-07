import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

declare global {
  interface Window {
    wealthOS?: {
      secrets: {
        get: (key: string) => Promise<string | null>;
        set: (key: string, value: string) => Promise<boolean>;
        delete: (key: string) => Promise<boolean>;
      };
    };
  }
}

/**
 * Market-data API keys are the only secrets WealthOS holds besides the PIN.
 * On desktop they go through `electron/preload.js` → `safeStorage` (OS
 * credential store, DPAPI on Windows) — never through AsyncStorage, so the
 * export feature can never see them, by construction. Native falls back to
 * `expo-secure-store` (already used for the PIN hash); a bare web preview
 * with no Electron bridge falls back to nothing persisting (dev-only path).
 */
function hasElectronBridge(): boolean {
  return typeof window !== "undefined" && !!window.wealthOS?.secrets;
}

export async function getSecureKey(key: string): Promise<string | null> {
  if (hasElectronBridge()) {
    return window.wealthOS!.secrets.get(key);
  }
  if (Platform.OS !== "web") {
    return SecureStore.getItemAsync(key);
  }
  return null;
}

export async function setSecureKey(key: string, value: string): Promise<void> {
  if (hasElectronBridge()) {
    await window.wealthOS!.secrets.set(key, value);
    return;
  }
  if (Platform.OS !== "web") {
    await SecureStore.setItemAsync(key, value);
  }
}

export async function deleteSecureKey(key: string): Promise<void> {
  if (hasElectronBridge()) {
    await window.wealthOS!.secrets.delete(key);
    return;
  }
  if (Platform.OS !== "web") {
    await SecureStore.deleteItemAsync(key);
  }
}
