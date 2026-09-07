import { create } from "zustand";
import { ProfileRepository } from "@/lib/repositories/ProfileRepository";
import { clearProfileData, setActiveProfileId } from "@/lib/storage";
import { migrateLegacyDataToDefaultProfile } from "@/lib/profileMigration";
import { hashPin, verifyPin } from "@/lib/security";
import { deleteSecureKey, getSecureKey, setSecureKey } from "@/lib/secureKeyStore";
import { generateId } from "@/utils/id";
import { nowISO } from "@/utils/date";
import { seedDemoData } from "@/features/demoData/seed";
import { InvestmentRepository } from "@/lib/repositories/InvestmentRepository";
import { bootstrapApp } from "@/store/index";
import { useSettingsStore } from "@/store/settingsStore";
import type { Profile } from "@/types/models";

const DEMO_PROFILE_NAME = "Demo";

/**
 * The PIN hash never lives in the plain profile-registry JSON — only in OS
 * secure storage (Electron safeStorage/DPAPI, or expo-secure-store on
 * native), same mechanism already used for market-data API keys. This keeps
 * it out of exports, logs, and the AsyncStorage blob entirely.
 */
function profilePinKey(profileId: string): string {
  return `wealthos_profile_pin_${profileId}`;
}

export type LoginResult = { ok: true } | { ok: false; reason: "not-found" | "wrong-pin" | "needs-pin-setup" };
export type CreateProfileResult = { ok: true; profileId: string } | { ok: false; reason: "duplicate-name" | "invalid-name" | "invalid-pin" };

function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

interface ProfileState {
  profiles: Profile[];
  activeProfile: Profile | null;
  isAuthenticated: boolean;
  hasLoaded: boolean;
  pendingProfileId: string | null;
  migratedProfileId: string | null;

  loadProfiles: () => Promise<void>;
  selectForLogin: (profileId: string | null) => void;
  login: (profileId: string, pin: string) => Promise<LoginResult>;
  loginDemo: () => Promise<void>;
  completeProfileSetup: (profileId: string, pin: string) => Promise<{ ok: true } | { ok: false; reason: "invalid-pin" }>;
  createProfile: (name: string, pin: string) => Promise<CreateProfileResult>;
  resetPin: (profileId: string, newPin: string) => Promise<{ ok: true } | { ok: false; reason: "invalid-pin" }>;
  logout: () => void;
  deleteProfile: (profileId: string) => Promise<void>;
  renameActiveProfile: (name: string) => Promise<void>;
}

async function ensureDemoProfile(profiles: Profile[]): Promise<Profile[]> {
  const existing = profiles.find((p) => p.isDemo);
  if (existing) return profiles;
  const demo: Profile = {
    id: generateId(),
    name: DEMO_PROFILE_NAME,
    createdAt: nowISO(),
    lastLoginAt: null,
    isDemo: true,
  };
  await ProfileRepository.save(demo);
  return [...profiles, demo];
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  activeProfile: null,
  isAuthenticated: false,
  hasLoaded: false,
  pendingProfileId: null,
  migratedProfileId: null,

  loadProfiles: async () => {
    const migratedProfileId = await migrateLegacyDataToDefaultProfile();
    let profiles = await ProfileRepository.getAll();
    profiles = await ensureDemoProfile(profiles);
    set({ profiles, hasLoaded: true, migratedProfileId });
  },

  selectForLogin: (profileId) => set({ pendingProfileId: profileId }),

  login: async (profileId, pin) => {
    const profile = await ProfileRepository.getById(profileId);
    if (!profile) return { ok: false, reason: "not-found" };
    if (profile.needsPinSetup) return { ok: false, reason: "needs-pin-setup" };

    const storedHash = await getSecureKey(profilePinKey(profileId));
    if (!storedHash) return { ok: false, reason: "needs-pin-setup" };

    const valid = await verifyPin(pin, storedHash);
    if (!valid) return { ok: false, reason: "wrong-pin" };

    setActiveProfileId(profile.id);
    const updated: Profile = { ...profile, lastLoginAt: nowISO() };
    await ProfileRepository.save(updated);
    // Load this profile's (now correctly-scoped) financial data BEFORE the
    // authenticated app shell mounts, so it never has a chance to render
    // stale or empty data left over from a previous session/profile.
    await bootstrapApp();
    set((state) => ({
      activeProfile: updated,
      isAuthenticated: true,
      pendingProfileId: null,
      profiles: state.profiles.map((p) => (p.id === updated.id ? updated : p)),
    }));
    return { ok: true };
  },

  loginDemo: async () => {
    const profiles = await ProfileRepository.getAll();
    const demo = profiles.find((p) => p.isDemo);
    if (!demo) return;

    setActiveProfileId(demo.id);
    const updated: Profile = { ...demo, lastLoginAt: nowISO() };
    await ProfileRepository.save(updated);

    // First-ever demo login for this profile: seed the demo dataset once
    // (empty investments/accounts is the "never visited demo yet" signal).
    const investments = await InvestmentRepository.getAll();
    if (investments.length === 0) {
      await seedDemoData();
    }
    await bootstrapApp();
    await useSettingsStore.getState().completeOnboarding(true);

    set((state) => ({
      activeProfile: updated,
      isAuthenticated: true,
      pendingProfileId: null,
      profiles: state.profiles.map((p) => (p.id === updated.id ? updated : p)),
    }));
  },

  /**
   * For a `needsPinSetup` profile (migrated, or otherwise never had a PIN):
   * sets the PIN and only then activates the session — `isAuthenticated`
   * never flips true with the setup step still incomplete, so a user
   * backing out mid-setup is simply still on the picker, not half-logged-in
   * with no PIN.
   */
  completeProfileSetup: async (profileId, pin) => {
    if (!isValidPin(pin)) return { ok: false, reason: "invalid-pin" };
    const profile = await ProfileRepository.getById(profileId);
    if (!profile || !profile.needsPinSetup) return { ok: false, reason: "invalid-pin" };

    const pinHash = await hashPin(pin);
    await setSecureKey(profilePinKey(profileId), pinHash);

    setActiveProfileId(profile.id);
    const updated: Profile = { ...profile, needsPinSetup: false, lastLoginAt: nowISO() };
    await ProfileRepository.save(updated);
    await bootstrapApp();
    set((state) => ({
      activeProfile: updated,
      isAuthenticated: true,
      pendingProfileId: null,
      profiles: state.profiles.map((p) => (p.id === updated.id ? updated : p)),
    }));
    return { ok: true };
  },

  createProfile: async (name, pin) => {
    const trimmedName = name.trim();
    if (!trimmedName) return { ok: false, reason: "invalid-name" };
    if (!isValidPin(pin)) return { ok: false, reason: "invalid-pin" };

    const existing = get().profiles;
    const duplicate = existing.some(
      (p) => !p.isDemo && p.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) return { ok: false, reason: "duplicate-name" };

    const pinHash = await hashPin(pin);
    const profile: Profile = {
      id: generateId(),
      name: trimmedName,
      createdAt: nowISO(),
      lastLoginAt: nowISO(),
      isDemo: false,
    };
    await setSecureKey(profilePinKey(profile.id), pinHash);
    await ProfileRepository.save(profile);

    setActiveProfileId(profile.id);
    // A brand-new profile has no financial data yet, but its (default)
    // settings still need to load into the stores before the app shell
    // mounts — same guarantee as login/loginDemo above.
    await bootstrapApp();
    // Profile creation IS the "new user" flow — skip the old onboarding
    // screen (demo-vs-empty choice) entirely and land straight on an empty
    // dashboard, exactly as this profile's data already is.
    await useSettingsStore.getState().completeOnboarding(false);
    set((state) => ({
      profiles: [...state.profiles, profile],
      activeProfile: profile,
      isAuthenticated: true,
      pendingProfileId: null,
    }));
    return { ok: true, profileId: profile.id };
  },

  /**
   * The "PIN vergeten" recovery: sets a new PIN directly, without requiring
   * the old one. Never touches financial data — the PIN hash lives only in
   * OS secure storage, structurally separate from that profile's
   * `wealthos:profile:<id>:*` financial-data namespace.
   */
  resetPin: async (profileId, newPin) => {
    if (!isValidPin(newPin)) return { ok: false, reason: "invalid-pin" };
    const profile = await ProfileRepository.getById(profileId);
    if (!profile) return { ok: false, reason: "invalid-pin" };
    const pinHash = await hashPin(newPin);
    await setSecureKey(profilePinKey(profileId), pinHash);
    const updated: Profile = { ...profile, needsPinSetup: false };
    await ProfileRepository.save(updated);
    set((state) => ({ profiles: state.profiles.map((p) => (p.id === updated.id ? updated : p)) }));
    return { ok: true };
  },

  logout: () => {
    setActiveProfileId(null);
    set({ activeProfile: null, isAuthenticated: false, pendingProfileId: null });
  },

  deleteProfile: async (profileId) => {
    const wasActive = get().activeProfile?.id === profileId;
    await clearProfileData(profileId);
    await deleteSecureKey(profilePinKey(profileId));
    await ProfileRepository.remove(profileId);
    set((state) => ({ profiles: state.profiles.filter((p) => p.id !== profileId) }));
    if (wasActive) {
      setActiveProfileId(null);
      set({ activeProfile: null, isAuthenticated: false, pendingProfileId: null });
    }
  },

  renameActiveProfile: async (name) => {
    const current = get().activeProfile;
    const trimmed = name.trim();
    if (!current || !trimmed) return;
    const updated: Profile = { ...current, name: trimmed };
    await ProfileRepository.save(updated);
    set((state) => ({
      activeProfile: updated,
      profiles: state.profiles.map((p) => (p.id === updated.id ? updated : p)),
    }));
  },
}));
