import {
  StorageKeys,
  readGlobalValue,
  readRawKey,
  removeRawKey,
  writeGlobalValue,
  writeRawKey,
} from "@/lib/storage";
import { ProfileRepository } from "@/lib/repositories/ProfileRepository";
import { getSecureKey, setSecureKey } from "@/lib/secureKeyStore";
import { generateId } from "@/utils/id";
import { nowISO } from "@/utils/date";
import type { Profile, Settings } from "@/types/models";

const MIGRATION_DONE_KEY = "migrationV3Complete";
const MARKET_DATA_CACHE_KEY = "wealthos:marketDataCache";
const DEFAULT_PROFILE_NAME = "Mijn WealthOS";
const LEGACY_PIN_HASH_KEY = "wealthos_pin_hash";

function profilePinKey(profileId: string): string {
  return `wealthos_profile_pin_${profileId}`;
}

/** Every unscoped key a pre-0.3.0 install could have written. */
const LEGACY_KEYS: string[] = [
  StorageKeys.accounts,
  StorageKeys.investments,
  StorageKeys.investmentTransactions,
  StorageKeys.transactions,
  StorageKeys.budgets,
  StorageKeys.liabilities,
  StorageKeys.portfolioSnapshots,
  StorageKeys.settings,
  MARKET_DATA_CACHE_KEY,
];

function scopedKeyFor(profileId: string, legacyKey: string): string {
  const withoutNamespace = legacyKey.startsWith("wealthos:") ? legacyKey.slice("wealthos:".length) : legacyKey;
  return `wealthos:profile:${profileId}:${withoutNamespace}`;
}

/**
 * One-time upgrade from the pre-0.3.0 single-profile storage layout to the
 * profile-scoped one. Runs at most once (guarded by a global flag) and is a
 * pure move — every legacy key is read, written under the new profile's
 * namespace, and only then removed, so a crash mid-migration never loses
 * data (the legacy key simply stays put and migration retries next launch).
 *
 * The migrated profile reuses the old app-lock PIN hash directly when one
 * exists in secure storage (same hashing algorithm, `lib/security.ts` is
 * unchanged) — no forced re-entry. If the old lock was off, biometric, or
 * the hash never actually persisted (e.g. no secure-storage bridge on the
 * platform that wrote it), `needsPinSetup` is set instead of fabricating a
 * PIN nobody knows — the user just sets a fresh one once, financial data
 * untouched either way.
 *
 * Returns the migrated profile's id (so the UI can pre-select it), or null
 * if there was nothing to migrate (fresh install, or migration already ran).
 */
export async function migrateLegacyDataToDefaultProfile(): Promise<string | null> {
  const alreadyMigrated = await readGlobalValue<boolean>(MIGRATION_DONE_KEY);
  if (alreadyMigrated) return null;

  const legacySettingsRaw = await readRawKey(StorageKeys.settings);
  if (!legacySettingsRaw) {
    // Fresh install — nothing to move. Mark migration done so we never re-check.
    await writeGlobalValue(MIGRATION_DONE_KEY, true);
    return null;
  }

  let legacySettings: Partial<Settings> | null = null;
  try {
    legacySettings = JSON.parse(legacySettingsRaw) as Partial<Settings>;
  } catch {
    legacySettings = null;
  }

  const profileId = generateId();

  // The old app-lock PIN hash was never part of the settings JSON blob (it
  // was written separately, see SettingsRepository) — read it from the same
  // secure key it actually lived under, via the Electron/DPAPI-aware helper.
  const legacyPinHash = await getSecureKey(LEGACY_PIN_HASH_KEY);
  const hasReusablePin = legacySettings?.appLockMethod === "pin" && !!legacyPinHash;
  if (hasReusablePin) {
    await setSecureKey(profilePinKey(profileId), legacyPinHash as string);
  }

  const profile: Profile = {
    id: profileId,
    name: DEFAULT_PROFILE_NAME,
    createdAt: nowISO(),
    lastLoginAt: null,
    isDemo: false,
    needsPinSetup: !hasReusablePin,
  };

  for (const legacyKey of LEGACY_KEYS) {
    const raw = await readRawKey(legacyKey);
    if (raw === null) continue;
    await writeRawKey(scopedKeyFor(profileId, legacyKey), raw);
    await removeRawKey(legacyKey);
  }

  await ProfileRepository.save(profile);
  await writeGlobalValue(MIGRATION_DONE_KEY, true);
  return profileId;
}
