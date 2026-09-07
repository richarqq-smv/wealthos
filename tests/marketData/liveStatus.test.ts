import {
  deriveLiveStatus,
  deriveGlobalLiveStatus,
  EMPTY_REFRESH_STATUS,
  type RefreshStatus,
} from "@/lib/marketData/liveStatus";

function status(overrides: Partial<RefreshStatus> = {}): RefreshStatus {
  return { ...EMPTY_REFRESH_STATUS, ...overrides };
}

describe("deriveLiveStatus", () => {
  it("is OFFLINE when there has never been an attempt (never configured / never fetched)", () => {
    expect(deriveLiveStatus("stock", EMPTY_REFRESH_STATUS)).toBe("offline");
  });

  it("is LIVE when the last attempt succeeded and the success is within the asset type's freshness window", () => {
    const now = new Date().toISOString();
    expect(deriveLiveStatus("stock", status({ lastAttemptAt: now, lastSuccessAt: now }))).toBe("live");
  });

  it("never reports LIVE off a successful fetch alone if a LATER attempt then failed", () => {
    // Regression guard for the "fake LIVE" bug: a stale success sitting in
    // state must not outrank a more recent failed attempt.
    const success = new Date(Date.now() - 2 * 60_000).toISOString();
    const laterFailedAttempt = new Date().toISOString();
    const s = status({ lastAttemptAt: laterFailedAttempt, lastSuccessAt: success, lastErrorKind: "networkUnavailable" });
    expect(deriveLiveStatus("stock", s)).toBe("error");
  });

  it("is DELAYED (VERTRAAGD) when the last success is older than the freshness window but no attempt has failed since", () => {
    const staleSuccess = new Date(Date.now() - 60 * 60_000).toISOString();
    const s = status({ lastAttemptAt: staleSuccess, lastSuccessAt: staleSuccess });
    expect(deriveLiveStatus("stock", s)).toBe("delayed");
  });

  it("uses the crypto freshness window (5 min), not the stock window (10 min)", () => {
    const eightMinutesAgo = new Date(Date.now() - 8 * 60_000).toISOString();
    const s = status({ lastAttemptAt: eightMinutesAgo, lastSuccessAt: eightMinutesAgo });
    expect(deriveLiveStatus("crypto", s)).toBe("delayed");
    expect(deriveLiveStatus("stock", s)).toBe("live");
  });

  it("is FOUT (error) when there was an attempt that never succeeded, even once", () => {
    const now = new Date().toISOString();
    const s = status({ lastAttemptAt: now, lastErrorKind: "rateLimited" });
    expect(deriveLiveStatus("stock", s)).toBe("error");
  });

  it("is FOUT, not OFFLINE, when the only attempt ever made failed outright", () => {
    const s = status({ lastAttemptAt: new Date().toISOString(), lastSuccessAt: null, lastErrorKind: "invalidApiKey" });
    expect(deriveLiveStatus("forex", s)).toBe("error");
  });

  it("is OFFLINE when live market data is disabled, even with a genuinely recent success — no live request is possible, so it must never linger as a fake LIVE", () => {
    const now = new Date().toISOString();
    const s = status({ lastAttemptAt: now, lastSuccessAt: now });
    expect(deriveLiveStatus("stock", s, false)).toBe("offline");
  });

  it("defaults to enabled (unchanged prior behavior) when the enabled flag is omitted", () => {
    const now = new Date().toISOString();
    const s = status({ lastAttemptAt: now, lastSuccessAt: now });
    expect(deriveLiveStatus("stock", s)).toBe("live");
  });
});

describe("deriveGlobalLiveStatus", () => {
  it("is OFFLINE when market data is disabled, regardless of any prior success", () => {
    const result = deriveGlobalLiveStatus({
      enabled: false,
      hasApiKey: true,
      lastSuccessfulUpdate: new Date().toISOString(),
      lastError: null,
    });
    expect(result).toBe("offline");
  });

  it("is OFFLINE when there is no API key configured", () => {
    const result = deriveGlobalLiveStatus({
      enabled: true,
      hasApiKey: false,
      lastSuccessfulUpdate: null,
      lastError: null,
    });
    expect(result).toBe("offline");
  });

  it("is FOUT when the most recent refresh cycle reported an error", () => {
    const result = deriveGlobalLiveStatus({
      enabled: true,
      hasApiKey: true,
      lastSuccessfulUpdate: new Date().toISOString(),
      lastError: "rateLimited",
    });
    expect(result).toBe("error");
  });

  it("is LIVE only when enabled, keyed, no error, and a recent successful update exists", () => {
    const result = deriveGlobalLiveStatus({
      enabled: true,
      hasApiKey: true,
      lastSuccessfulUpdate: new Date().toISOString(),
      lastError: null,
    });
    expect(result).toBe("live");
  });

  it("is DELAYED when the last successful update is older than the freshness window", () => {
    const result = deriveGlobalLiveStatus({
      enabled: true,
      hasApiKey: true,
      lastSuccessfulUpdate: new Date(Date.now() - 60 * 60_000).toISOString(),
      lastError: null,
    });
    expect(result).toBe("delayed");
  });
});
