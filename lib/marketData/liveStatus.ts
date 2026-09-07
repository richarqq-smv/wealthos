import type { MarketAssetType, MarketDataErrorKind } from "@/types/marketData";
import { QUOTE_STALE_AFTER_MINUTES, minutesSince } from "./cachePolicy";

export type LiveStatus = "live" | "delayed" | "offline" | "error";

/** Per-instrument (or global) refresh bookkeeping — never inferred from cache age alone. */
export interface RefreshStatus {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastErrorKind: MarketDataErrorKind | null;
}

export const EMPTY_REFRESH_STATUS: RefreshStatus = {
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastErrorKind: null,
};

/**
 * The single source of truth for what the UI is allowed to call "LIVE".
 * Deliberately does NOT look at cache age alone — a quote that is merely
 * young could still be sitting behind a refresh that just failed (rate
 * limit, invalid key, network down). Only a refresh attempt that is BOTH
 * the most recent attempt AND succeeded may ever produce "live"/"delayed";
 * everything else is "offline" (never attempted / not configured) or
 * "error" (attempted and failed), so the UI can never show a fake LIVE.
 */
export function deriveLiveStatus(assetType: MarketAssetType, status: RefreshStatus, enabled: boolean = true): LiveStatus {
  // A recent success from BEFORE the user turned live data off is still a
  // real past success, but with no live request possible right now it must
  // read as OFFLINE, never as a lingering fake LIVE — matches
  // deriveGlobalLiveStatus's own `enabled` gate below.
  if (!enabled) return "offline";

  const { lastAttemptAt, lastSuccessAt, lastErrorKind } = status;

  if (lastAttemptAt && lastAttemptAt !== lastSuccessAt) {
    return "error";
  }
  if (!lastSuccessAt) {
    return lastErrorKind ? "error" : "offline";
  }

  const ageMinutes = minutesSince(lastSuccessAt);
  return ageMinutes <= QUOTE_STALE_AFTER_MINUTES[assetType] ? "live" : "delayed";
}

/**
 * Portfolio-wide variant of {@link deriveLiveStatus} for a summary badge
 * that isn't about any one instrument (the dashboard's overall indicator).
 * Same non-negotiable rule: `lastError` (set only by a genuine failed
 * refresh attempt) always wins over how young `lastSuccessfulUpdate` is.
 */
export function deriveGlobalLiveStatus(params: {
  enabled: boolean;
  hasApiKey: boolean;
  lastSuccessfulUpdate: string | null;
  lastError: MarketDataErrorKind | null;
}): LiveStatus {
  if (!params.enabled || !params.hasApiKey) return "offline";
  if (params.lastError) return "error";
  if (!params.lastSuccessfulUpdate) return "offline";
  return minutesSince(params.lastSuccessfulUpdate) <= QUOTE_STALE_AFTER_MINUTES.stock ? "live" : "delayed";
}

export const LIVE_STATUS_LABEL: Record<LiveStatus, string> = {
  live: "LIVE",
  delayed: "VERTRAAGD",
  offline: "OFFLINE",
  error: "FOUT",
};

export const MARKET_DATA_ERROR_LABEL: Record<MarketDataErrorKind, string> = {
  invalidApiKey: "Ongeldige API-key",
  rateLimited: "Limiet bereikt, probeer later opnieuw",
  networkUnavailable: "Geen internetverbinding",
  providerUnavailable: "Marktdata-bron niet bereikbaar",
  notFound: "Symbool niet gevonden",
  malformedResponse: "Onverwacht antwoord van de bron",
  unknown: "Onbekende fout",
};

export function formatTimeHHMMSS(iso: string): string {
  return new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
