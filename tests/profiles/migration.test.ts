import AsyncStorage from "@react-native-async-storage/async-storage";
import { StorageKeys, setActiveProfileId, readCollection, readValue } from "@/lib/storage";
import { migrateLegacyDataToDefaultProfile } from "@/lib/profileMigration";
import { ProfileRepository } from "@/lib/repositories/ProfileRepository";

// expo-secure-store has no real native module under jest-expo (calls silently
// no-op), so — following the same pattern as tests/marketData/marketDataService.test.ts —
// this replaces `lib/secureKeyStore` with a real in-memory implementation for
// these tests, so PIN-hash persistence can actually be exercised end-to-end.
jest.mock("@/lib/secureKeyStore", () => {
  const store = new Map<string, string>();
  return {
    getSecureKey: jest.fn(async (key: string) => store.get(key) ?? null),
    setSecureKey: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteSecureKey: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __clear: () => store.clear(),
  };
});

import { getSecureKey, setSecureKey } from "@/lib/secureKeyStore";

const secureKeyStoreMock = jest.requireMock("@/lib/secureKeyStore") as { __clear: () => void };
const LEGACY_PIN_HASH_KEY = "wealthos_pin_hash";

beforeEach(async () => {
  await AsyncStorage.clear();
  setActiveProfileId(null);
  secureKeyStoreMock.__clear();
});

describe("migrateLegacyDataToDefaultProfile — Phase 14 (existing 0.2.0 data must not be lost)", () => {
  it("does nothing on a fresh install (no legacy settings key at all)", async () => {
    const result = await migrateLegacyDataToDefaultProfile();
    expect(result).toBeNull();
    expect(await ProfileRepository.getAll()).toEqual([]);
  });

  it("moves every legacy collection/value into a new default profile's scoped namespace, and removes the old unscoped keys", async () => {
    await AsyncStorage.setItem(
      StorageKeys.accounts,
      JSON.stringify([{ id: "acc1", name: "Betaalrekening", balanceMinor: 123456 }])
    );
    await AsyncStorage.setItem(
      StorageKeys.transactions,
      JSON.stringify([{ id: "t1", description: "Boodschappen", amountMinor: -2500 }])
    );
    await AsyncStorage.setItem(
      StorageKeys.settings,
      JSON.stringify({ appLockMethod: "none", currency: "EUR", demoModeActive: false })
    );

    const profileId = await migrateLegacyDataToDefaultProfile();
    expect(profileId).not.toBeNull();

    // Old unscoped keys are gone.
    expect(await AsyncStorage.getItem(StorageKeys.accounts)).toBeNull();
    expect(await AsyncStorage.getItem(StorageKeys.transactions)).toBeNull();
    expect(await AsyncStorage.getItem(StorageKeys.settings)).toBeNull();

    // Data is intact under the migrated profile's scope.
    setActiveProfileId(profileId!);
    const accounts = await readCollection<{ id: string; name: string; balanceMinor: number }>(StorageKeys.accounts);
    expect(accounts).toEqual([{ id: "acc1", name: "Betaalrekening", balanceMinor: 123456 }]);
    const transactions = await readCollection<{ id: string; description: string; amountMinor: number }>(
      StorageKeys.transactions
    );
    expect(transactions).toEqual([{ id: "t1", description: "Boodschappen", amountMinor: -2500 }]);
    const settings = await readValue<{ currency: string }>(StorageKeys.settings);
    expect(settings?.currency).toBe("EUR");

    // A profile now exists, named "Mijn WealthOS", not the demo profile.
    setActiveProfileId(null);
    const profiles = await ProfileRepository.getAll();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.name).toBe("Mijn WealthOS");
    expect(profiles[0]?.isDemo).toBe(false);
  });

  it("migrates demo data (demoModeActive: true) faithfully too — it becomes the migrated profile's own data, never silently dropped", async () => {
    await AsyncStorage.setItem(StorageKeys.investments, JSON.stringify([{ id: "inv1", name: "Demo Aandeel" }]));
    await AsyncStorage.setItem(StorageKeys.settings, JSON.stringify({ demoModeActive: true, appLockMethod: "none" }));

    const profileId = await migrateLegacyDataToDefaultProfile();

    setActiveProfileId(profileId!);
    const investments = await readCollection<{ id: string; name: string }>(StorageKeys.investments);
    expect(investments).toEqual([{ id: "inv1", name: "Demo Aandeel" }]);
    const settings = await readValue<{ demoModeActive: boolean }>(StorageKeys.settings);
    expect(settings?.demoModeActive).toBe(true);
  });

  it("carries over a reusable PIN hash when the old app-lock was PIN-based and the hash actually persisted", async () => {
    await AsyncStorage.setItem(StorageKeys.settings, JSON.stringify({ appLockMethod: "pin" }));
    await setSecureKey(LEGACY_PIN_HASH_KEY, "some-sha256-hash");

    const profileId = await migrateLegacyDataToDefaultProfile();

    const profile = await ProfileRepository.getById(profileId!);
    expect(profile?.needsPinSetup).toBe(false);
    expect(await getSecureKey(`wealthos_profile_pin_${profileId}`)).toBe("some-sha256-hash");
  });

  it("sets needsPinSetup when the old lock method was biometric (no PIN hash to reuse)", async () => {
    await AsyncStorage.setItem(StorageKeys.settings, JSON.stringify({ appLockMethod: "biometric" }));

    const profileId = await migrateLegacyDataToDefaultProfile();

    const profile = await ProfileRepository.getById(profileId!);
    expect(profile?.needsPinSetup).toBe(true);
  });

  it("sets needsPinSetup when appLockMethod was 'pin' but no hash ever actually persisted (the historical SecureStore/web bug)", async () => {
    await AsyncStorage.setItem(StorageKeys.settings, JSON.stringify({ appLockMethod: "pin" }));
    // Deliberately no setSecureKey call — simulates the hash never having persisted.

    const profileId = await migrateLegacyDataToDefaultProfile();

    const profile = await ProfileRepository.getById(profileId!);
    expect(profile?.needsPinSetup).toBe(true);
  });

  it("sets needsPinSetup when the old lock was off entirely", async () => {
    await AsyncStorage.setItem(StorageKeys.settings, JSON.stringify({ appLockMethod: "none" }));

    const profileId = await migrateLegacyDataToDefaultProfile();

    const profile = await ProfileRepository.getById(profileId!);
    expect(profile?.needsPinSetup).toBe(true);
  });

  it("never writes a plaintext or hashed PIN into the profile registry JSON itself — only into secure storage", async () => {
    await AsyncStorage.setItem(StorageKeys.settings, JSON.stringify({ appLockMethod: "pin" }));
    await setSecureKey(LEGACY_PIN_HASH_KEY, "some-sha256-hash");

    await migrateLegacyDataToDefaultProfile();

    const rawProfilesJson = await AsyncStorage.getItem("wealthos:profiles");
    expect(rawProfilesJson).not.toBeNull();
    expect(rawProfilesJson).not.toContain("some-sha256-hash");
    expect(rawProfilesJson).not.toContain("pinHash");
  });

  it("is idempotent — running it twice does not duplicate profiles or re-migrate", async () => {
    await AsyncStorage.setItem(StorageKeys.accounts, JSON.stringify([{ id: "acc1" }]));
    await AsyncStorage.setItem(StorageKeys.settings, JSON.stringify({ appLockMethod: "none" }));

    const firstId = await migrateLegacyDataToDefaultProfile();
    const secondId = await migrateLegacyDataToDefaultProfile();

    expect(firstId).not.toBeNull();
    expect(secondId).toBeNull();

    const profiles = await ProfileRepository.getAll();
    expect(profiles).toHaveLength(1);
  });

  it("marks migration done on a fresh install too, so a later real install is never mistaken for having legacy data", async () => {
    await migrateLegacyDataToDefaultProfile();
    await AsyncStorage.setItem(StorageKeys.accounts, JSON.stringify([{ id: "should-not-be-picked-up" }]));

    const result = await migrateLegacyDataToDefaultProfile();
    expect(result).toBeNull();
    expect(await ProfileRepository.getAll()).toEqual([]);
  });
});
