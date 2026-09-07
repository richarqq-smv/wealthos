import { create } from "zustand";
import { DEFAULT_SETTINGS, SettingsRepository } from "@/lib/repositories/SettingsRepository";
import { hashPin, verifyPin } from "@/lib/security";
import { deleteSecureKey, setSecureKey } from "@/lib/secureKeyStore";
import { API_KEY_STORAGE } from "@/lib/marketData/constants";
import type { MarketDataAssetToggles, Settings } from "@/types/models";
import type { MarketDataProviderId } from "@/types/marketData";

interface SettingsState extends Settings {
  isLoading: boolean;
  hasLoaded: boolean;
  isLocked: boolean;
  refresh: () => Promise<void>;
  setThemePreference: (value: Settings["themePreference"]) => Promise<void>;
  setCurrency: (value: Settings["currency"]) => Promise<void>;
  setPrivacyMode: (value: boolean) => Promise<void>;
  togglePrivacyMode: () => Promise<void>;
  setUserName: (value: string) => Promise<void>;
  completeOnboarding: (demoMode: boolean) => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  removePin: () => Promise<void>;
  checkPin: (pin: string) => Promise<boolean>;
  setAppLockMethod: (method: Settings["appLockMethod"]) => Promise<void>;
  lock: () => void;
  unlock: () => void;
  resetAllSettings: () => Promise<void>;
  setApiKey: (provider: MarketDataProviderId, apiKey: string) => Promise<void>;
  removeApiKey: (provider: MarketDataProviderId) => Promise<void>;
  setMarketDataEnabled: (enabled: boolean) => Promise<void>;
  setAssetToggle: (key: keyof MarketDataAssetToggles, value: boolean) => Promise<void>;
  setAutoRefresh: (value: boolean) => Promise<void>;
  setRefreshIntervalMinutes: (minutes: number) => Promise<void>;
  markMarketDataUpdated: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  isLoading: false,
  hasLoaded: false,
  isLocked: false,

  refresh: async () => {
    set({ isLoading: true });
    const settings = await SettingsRepository.get();
    set({
      ...settings,
      isLoading: false,
      hasLoaded: true,
      isLocked: settings.appLockMethod !== "none",
    });
  },

  setThemePreference: async (value) => {
    await SettingsRepository.update({ themePreference: value });
    set({ themePreference: value });
  },

  setCurrency: async (value) => {
    await SettingsRepository.update({ currency: value });
    set({ currency: value });
  },

  setPrivacyMode: async (value) => {
    await SettingsRepository.update({ privacyMode: value });
    set({ privacyMode: value });
  },

  togglePrivacyMode: async () => {
    await get().setPrivacyMode(!get().privacyMode);
  },

  setUserName: async (value) => {
    await SettingsRepository.update({ userName: value });
    set({ userName: value });
  },

  completeOnboarding: async (demoMode) => {
    await SettingsRepository.update({ onboardingCompleted: true, demoModeActive: demoMode });
    set({ onboardingCompleted: true, demoModeActive: demoMode });
  },

  setPin: async (pin) => {
    const pinHash = await hashPin(pin);
    await SettingsRepository.update({ pinHash, appLockMethod: "pin" });
    set({ pinHash, appLockMethod: "pin" });
  },

  removePin: async () => {
    await SettingsRepository.update({ pinHash: null, appLockMethod: "none" });
    set({ pinHash: null, appLockMethod: "none", isLocked: false });
  },

  checkPin: async (pin) => {
    const hash = get().pinHash;
    if (!hash) return false;
    return verifyPin(pin, hash);
  },

  setAppLockMethod: async (method) => {
    await SettingsRepository.update({ appLockMethod: method });
    set({ appLockMethod: method });
  },

  lock: () => {
    if (get().appLockMethod !== "none") {
      set({ isLocked: true });
    }
  },

  unlock: () => set({ isLocked: false }),

  resetAllSettings: async () => {
    await SettingsRepository.reset();
    set({ ...DEFAULT_SETTINGS, isLocked: false });
  },

  setApiKey: async (provider, apiKey) => {
    await setSecureKey(API_KEY_STORAGE[provider], apiKey);
    const marketData = {
      ...get().marketData,
      [provider === "twelveData" ? "twelveDataConfigured" : "alphaVantageConfigured"]: true,
    };
    await SettingsRepository.update({ marketData });
    set({ marketData });
  },

  removeApiKey: async (provider) => {
    await deleteSecureKey(API_KEY_STORAGE[provider]);
    const marketData = {
      ...get().marketData,
      [provider === "twelveData" ? "twelveDataConfigured" : "alphaVantageConfigured"]: false,
    };
    await SettingsRepository.update({ marketData });
    set({ marketData });
  },

  setMarketDataEnabled: async (enabled) => {
    const marketData = { ...get().marketData, enabled };
    await SettingsRepository.update({ marketData });
    set({ marketData });
  },

  setAssetToggle: async (key, value) => {
    const marketData = {
      ...get().marketData,
      assetToggles: { ...get().marketData.assetToggles, [key]: value },
    };
    await SettingsRepository.update({ marketData });
    set({ marketData });
  },

  setAutoRefresh: async (value) => {
    const marketData = { ...get().marketData, autoRefresh: value };
    await SettingsRepository.update({ marketData });
    set({ marketData });
  },

  setRefreshIntervalMinutes: async (minutes) => {
    const marketData = { ...get().marketData, refreshIntervalMinutes: minutes };
    await SettingsRepository.update({ marketData });
    set({ marketData });
  },

  markMarketDataUpdated: async () => {
    const marketData = { ...get().marketData, lastSuccessfulUpdate: new Date().toISOString() };
    await SettingsRepository.update({ marketData });
    set({ marketData });
  },
}));
