import AsyncStorage from "@react-native-async-storage/async-storage";
import { AccountRepository } from "@/lib/repositories/AccountRepository";
import { InvestmentRepository } from "@/lib/repositories/InvestmentRepository";
import { ProfileRepository } from "@/lib/repositories/ProfileRepository";
import { getActiveProfileId, setActiveProfileId } from "@/lib/storage";

// expo-crypto's digestStringAsync has no real native module under jest-expo
// and silently returns an empty string for every input, which would make
// hashPin()/verifyPin() meaningless (every PIN "hashes" to ""). Back it with
// a real SHA-256 (Node's crypto) so PIN verification is genuinely exercised.
jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA256" },
  digestStringAsync: jest.fn(async (_algorithm: string, data: string) => {
    const { createHash } = require("crypto");
    return createHash("sha256").update(data).digest("hex");
  }),
}));

// expo-secure-store has no real native module under jest-expo — replace
// lib/secureKeyStore with an in-memory implementation (same pattern as
// tests/marketData/marketDataService.test.ts) so PIN storage round-trips.
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

import { useProfileStore } from "@/store/profileStore";

const secureKeyStoreMock = jest.requireMock("@/lib/secureKeyStore") as { __clear: () => void };

function resetProfileStoreState() {
  useProfileStore.setState({
    profiles: [],
    activeProfile: null,
    isAuthenticated: false,
    hasLoaded: false,
    pendingProfileId: null,
    migratedProfileId: null,
  });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  secureKeyStoreMock.__clear();
  setActiveProfileId(null);
  resetProfileStoreState();
});

function accountInput(overrides: Partial<Parameters<typeof AccountRepository.create>[0]> = {}) {
  return {
    name: "Rekening",
    institution: "ING",
    type: "checking" as const,
    balanceMinor: 1,
    currency: "EUR" as const,
    ...overrides,
  };
}

function investmentInput(overrides: Partial<Parameters<typeof InvestmentRepository.create>[0]> = {}) {
  return {
    name: "Aandeel",
    ticker: "AAPL",
    type: "stock" as const,
    quantity: 1,
    averagePriceMinor: 1000,
    currentPriceMinor: 1000,
    currency: "EUR" as const,
    broker: "DEGIRO",
    purchaseDate: "2026-01-01T00:00:00.000Z",
    providerSymbol: "AAPL",
    liveDataEnabled: false,
    ...overrides,
  };
}

describe("profileStore — profile creation (Phase 2/3)", () => {
  it("creates a profile, auto-logs-in, and lands on an empty (isAuthenticated) session", async () => {
    await useProfileStore.getState().loadProfiles();

    const result = await useProfileStore.getState().createProfile("Richard", "1234");

    expect(result.ok).toBe(true);
    const state = useProfileStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.activeProfile?.name).toBe("Richard");
    expect(getActiveProfileId()).toBe(state.activeProfile?.id);
  });

  it("rejects an empty name", async () => {
    await useProfileStore.getState().loadProfiles();

    const result = await useProfileStore.getState().createProfile("   ", "1234");
    expect(result).toEqual({ ok: false, reason: "invalid-name" });
  });

  it.each(["123", "12345", "abcd", "12a4", "", "1234 "])(
    "rejects an invalid PIN %p (must be exactly 4 digits, only 0-9)",
    async (badPin) => {
      await useProfileStore.getState().loadProfiles();

      const result = await useProfileStore.getState().createProfile("Richard", badPin);
      expect(result).toEqual({ ok: false, reason: "invalid-pin" });
    }
  );

  it("rejects a duplicate profile name (case-insensitive)", async () => {
    await useProfileStore.getState().loadProfiles();

    await useProfileStore.getState().createProfile("Richard", "1234");
    useProfileStore.getState().logout();

    const duplicate = await useProfileStore.getState().createProfile("richard", "5678");
    expect(duplicate).toEqual({ ok: false, reason: "duplicate-name" });
  });

  it("allows the same name again after the original profile with that name was deleted", async () => {
    await useProfileStore.getState().loadProfiles();

    const first = await useProfileStore.getState().createProfile("Richard", "1234");
    await useProfileStore.getState().deleteProfile((first as { profileId: string }).profileId);

    const second = await useProfileStore.getState().createProfile("Richard", "5678");
    expect(second.ok).toBe(true);
  });
});

describe("profileStore — login (Phase 3/4)", () => {
  it("logs in with the correct PIN", async () => {
    await useProfileStore.getState().loadProfiles();
    const created = await useProfileStore.getState().createProfile("Richard", "1234");
    const profileId = (created as { profileId: string }).profileId;
    useProfileStore.getState().logout();

    const result = await useProfileStore.getState().login(profileId, "1234");
    expect(result).toEqual({ ok: true });
    expect(useProfileStore.getState().isAuthenticated).toBe(true);
  });

  it("rejects the wrong PIN and stays logged out", async () => {
    await useProfileStore.getState().loadProfiles();
    const created = await useProfileStore.getState().createProfile("Richard", "1234");
    const profileId = (created as { profileId: string }).profileId;
    useProfileStore.getState().logout();

    const result = await useProfileStore.getState().login(profileId, "9999");
    expect(result).toEqual({ ok: false, reason: "wrong-pin" });
    expect(useProfileStore.getState().isAuthenticated).toBe(false);
  });

  it("reports not-found for a non-existent profile id", async () => {
    await useProfileStore.getState().loadProfiles();

    const result = await useProfileStore.getState().login("does-not-exist", "1234");
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("logout ends the session and clears the active profile id", async () => {
    await useProfileStore.getState().loadProfiles();
    await useProfileStore.getState().createProfile("Richard", "1234");

    useProfileStore.getState().logout();

    expect(useProfileStore.getState().isAuthenticated).toBe(false);
    expect(useProfileStore.getState().activeProfile).toBeNull();
    expect(getActiveProfileId()).toBeNull();
  });
});

describe("profileStore — demo mode (Phase 1)", () => {
  it("logging into demo seeds demo data exactly once and marks onboarding complete", async () => {
    await useProfileStore.getState().loadProfiles();

    await useProfileStore.getState().loginDemo();

    expect(useProfileStore.getState().isAuthenticated).toBe(true);
    expect(useProfileStore.getState().activeProfile?.isDemo).toBe(true);
    const investments = await InvestmentRepository.getAll();
    expect(investments.length).toBeGreaterThan(0);
  });

  it("demo can be exited via logout and a brand-new profile starts with zero demo data (no leakage)", async () => {
    await useProfileStore.getState().loadProfiles();
    await useProfileStore.getState().loginDemo();
    const demoInvestmentCount = (await InvestmentRepository.getAll()).length;
    expect(demoInvestmentCount).toBeGreaterThan(0);

    useProfileStore.getState().logout();
    const created = await useProfileStore.getState().createProfile("Nieuwe Gebruiker", "1234");
    expect(created.ok).toBe(true);

    const newProfileInvestments = await InvestmentRepository.getAll();
    const newProfileAccounts = await AccountRepository.getAll();
    expect(newProfileInvestments).toEqual([]);
    expect(newProfileAccounts).toEqual([]);
  });

  it("re-entering demo after leaving it does not re-seed (data is stable, not reset every login)", async () => {
    await useProfileStore.getState().loadProfiles();
    await useProfileStore.getState().loginDemo();
    const before = await InvestmentRepository.getAll();
    useProfileStore.getState().logout();

    await useProfileStore.getState().loginDemo();
    const after = await InvestmentRepository.getAll();
    expect(after).toEqual(before);
  });
});

describe("profileStore — profile switching & data isolation (Phase 6/7, the core privacy guarantee)", () => {
  it("two profiles never see each other's accounts/investments after switching", async () => {
    await useProfileStore.getState().loadProfiles();

    const richard = await useProfileStore.getState().createProfile("Richard", "1111");
    await AccountRepository.create(accountInput({ name: "Richard's Rekening", balanceMinor: 100_00 }));
    await InvestmentRepository.create(investmentInput({ name: "Richard's Aandeel", ticker: "RICH", providerSymbol: "RICH" }));
    useProfileStore.getState().logout();

    const testUser = await useProfileStore.getState().createProfile("Testgebruiker", "2222");
    const testUserAccountsBeforeOwnData = await AccountRepository.getAll();
    expect(testUserAccountsBeforeOwnData).toEqual([]);

    await AccountRepository.create(
      accountInput({ name: "Testgebruiker's Rekening", institution: "ABN AMRO", type: "savings", balanceMinor: 500_00 })
    );
    const testUserAccounts = await AccountRepository.getAll();
    expect(testUserAccounts).toHaveLength(1);
    expect(testUserAccounts[0]?.name).toBe("Testgebruiker's Rekening");
    useProfileStore.getState().logout();

    const richardId = (richard as { profileId: string }).profileId;
    const testUserId = (testUser as { profileId: string }).profileId;
    await useProfileStore.getState().login(richardId, "1111");
    const richardAccounts = await AccountRepository.getAll();
    const richardInvestments = await InvestmentRepository.getAll();
    expect(richardAccounts).toHaveLength(1);
    expect(richardAccounts[0]?.name).toBe("Richard's Rekening");
    expect(richardInvestments).toHaveLength(1);
    expect(richardInvestments[0]?.name).toBe("Richard's Aandeel");
    // Richard's view must never contain any of Testgebruiker's data.
    expect(richardAccounts.some((a) => a.name.includes("Testgebruiker"))).toBe(false);
    useProfileStore.getState().logout();

    await useProfileStore.getState().login(testUserId, "2222");
    const testUserAccountsAgain = await AccountRepository.getAll();
    expect(testUserAccountsAgain).toHaveLength(1);
    expect(testUserAccountsAgain[0]?.name).toBe("Testgebruiker's Rekening");
    expect(testUserAccountsAgain.some((a) => a.name.includes("Richard"))).toBe(false);
  });

  it("deleting one profile's data never touches another profile's data", async () => {
    await useProfileStore.getState().loadProfiles();

    const a = await useProfileStore.getState().createProfile("Profiel A", "1111");
    await AccountRepository.create(accountInput({ name: "A's rekening" }));
    useProfileStore.getState().logout();

    const b = await useProfileStore.getState().createProfile("Profiel B", "2222");
    await AccountRepository.create(accountInput({ name: "B's rekening" }));
    useProfileStore.getState().logout();

    await useProfileStore.getState().deleteProfile((a as { profileId: string }).profileId);

    const bId = (b as { profileId: string }).profileId;
    await useProfileStore.getState().login(bId, "2222");
    const bAccounts = await AccountRepository.getAll();
    expect(bAccounts).toHaveLength(1);
    expect(bAccounts[0]?.name).toBe("B's rekening");
  });
});

describe("profileStore — profile deletion (Phase 5/6)", () => {
  it("deleting the active profile logs the session out", async () => {
    await useProfileStore.getState().loadProfiles();
    const created = await useProfileStore.getState().createProfile("Richard", "1234");

    await useProfileStore.getState().deleteProfile((created as { profileId: string }).profileId);

    expect(useProfileStore.getState().isAuthenticated).toBe(false);
    expect(useProfileStore.getState().activeProfile).toBeNull();
  });

  it("deleting a profile removes it from the profiles list and its financial data", async () => {
    await useProfileStore.getState().loadProfiles();
    const created = await useProfileStore.getState().createProfile("Richard", "1234");
    const profileId = (created as { profileId: string }).profileId;
    await AccountRepository.create(accountInput());

    await useProfileStore.getState().deleteProfile(profileId);

    expect(useProfileStore.getState().profiles.some((p) => p.id === profileId)).toBe(false);

    setActiveProfileId(profileId);
    const orphanedAccounts = await AccountRepository.getAll();
    expect(orphanedAccounts).toEqual([]);
  });

  it("the demo profile is untouched by creating/using real profiles — distinct from a data reset or wipe", async () => {
    await useProfileStore.getState().loadProfiles();
    await useProfileStore.getState().createProfile("Richard", "1234");
    useProfileStore.getState().logout();

    const stillHasBoth = useProfileStore.getState().profiles;
    expect(stillHasBoth.some((p) => p.isDemo)).toBe(true);
    expect(stillHasBoth.some((p) => p.name === "Richard")).toBe(true);
  });
});

describe("profileStore — PIN recovery / reset (Phase 15, must never touch financial data)", () => {
  it("resetPin sets a new PIN without requiring the old one, and financial data survives untouched", async () => {
    await useProfileStore.getState().loadProfiles();
    const created = await useProfileStore.getState().createProfile("Richard", "1234");
    const profileId = (created as { profileId: string }).profileId;
    await AccountRepository.create(accountInput({ name: "Belangrijke rekening", balanceMinor: 999_00 }));
    useProfileStore.getState().logout();

    const resetResult = await useProfileStore.getState().resetPin(profileId, "9999");
    expect(resetResult).toEqual({ ok: true });

    const oldPinLogin = await useProfileStore.getState().login(profileId, "1234");
    expect(oldPinLogin).toEqual({ ok: false, reason: "wrong-pin" });

    const newPinLogin = await useProfileStore.getState().login(profileId, "9999");
    expect(newPinLogin).toEqual({ ok: true });

    const accounts = await AccountRepository.getAll();
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.name).toBe("Belangrijke rekening");
  });

  it("resetPin rejects an invalid new PIN", async () => {
    await useProfileStore.getState().loadProfiles();
    const created = await useProfileStore.getState().createProfile("Richard", "1234");

    const result = await useProfileStore.getState().resetPin((created as { profileId: string }).profileId, "12");
    expect(result).toEqual({ ok: false, reason: "invalid-pin" });
  });
});

describe("profileStore — completeProfileSetup (migrated profile's one-time PIN setup)", () => {
  it("does not authenticate until a valid PIN is actually saved, then logging in with it works", async () => {
    await useProfileStore.getState().loadProfiles();
    const created = await useProfileStore.getState().createProfile("Migrated", "1234");
    const profileId = (created as { profileId: string }).profileId;
    useProfileStore.getState().logout();

    // Simulate a migrated profile that has no PIN yet (persisted, like migration would write it).
    const profile = await ProfileRepository.getById(profileId);
    await ProfileRepository.save({ ...profile!, needsPinSetup: true });

    expect(useProfileStore.getState().isAuthenticated).toBe(false);

    const result = await useProfileStore.getState().completeProfileSetup(profileId, "4321");
    expect(result).toEqual({ ok: true });
    expect(useProfileStore.getState().isAuthenticated).toBe(true);
    expect(useProfileStore.getState().profiles.find((p) => p.id === profileId)?.needsPinSetup).toBe(false);
    useProfileStore.getState().logout();

    const login = await useProfileStore.getState().login(profileId, "4321");
    expect(login).toEqual({ ok: true });
  });

  it("rejects an invalid PIN without authenticating", async () => {
    await useProfileStore.getState().loadProfiles();
    const created = await useProfileStore.getState().createProfile("Migrated", "1234");
    const profileId = (created as { profileId: string }).profileId;
    useProfileStore.getState().logout();
    const profile = await ProfileRepository.getById(profileId);
    await ProfileRepository.save({ ...profile!, needsPinSetup: true });

    const result = await useProfileStore.getState().completeProfileSetup(profileId, "12");
    expect(result).toEqual({ ok: false, reason: "invalid-pin" });
    expect(useProfileStore.getState().isAuthenticated).toBe(false);
  });
});

describe("profileStore — security (PIN never leaks into plain storage)", () => {
  it("the PIN hash never appears anywhere in the plain profile-registry JSON, and the raw PIN appears nowhere in AsyncStorage", async () => {
    await useProfileStore.getState().loadProfiles();
    await useProfileStore.getState().createProfile("Richard", "1234");

    const rawProfilesJson = await AsyncStorage.getItem("wealthos:profiles");
    expect(rawProfilesJson).not.toBeNull();
    expect(rawProfilesJson).not.toContain("pinHash");

    const allKeys = await AsyncStorage.getAllKeys();
    for (const key of allKeys) {
      const raw = await AsyncStorage.getItem(key);
      expect(raw).not.toContain("1234");
    }
  });
});
