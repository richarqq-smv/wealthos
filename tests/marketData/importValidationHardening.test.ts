import { DEFAULT_SETTINGS } from "@/lib/repositories/SettingsRepository";
import { validateImportPayload } from "@/utils/validation";

function baseAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "a1",
    name: "Betaalrekening",
    institution: "ING",
    type: "checking",
    balanceMinor: 100_000,
    currency: "EUR",
    origin: "manual",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function basePayload(overrides: { accounts?: unknown[] } = {}) {
  const { pinHash: _pinHash, ...settingsWithoutPin } = DEFAULT_SETTINGS;
  return {
    version: 1,
    exportedAt: "2026-01-01T00:00:00.000Z",
    accounts: overrides.accounts ?? [baseAccount()],
    investments: [],
    investmentTransactions: [],
    transactions: [],
    budgets: [],
    liabilities: [],
    settings: settingsWithoutPin,
  };
}

describe("import validation hardening — M4 (numeric bounds: reject Infinity/-Infinity/NaN)", () => {
  it("accepts a well-formed payload with ordinary finite amounts", () => {
    const result = validateImportPayload(basePayload());
    expect(result.success).toBe(true);
  });

  it("rejects an oversized numeral (1e999) that JSON.parse silently overflows to Infinity", () => {
    // Prove the real-world attack vector first: 1e999 is syntactically valid JSON,
    // and JSON.parse genuinely turns it into the JS value Infinity.
    const parsed = JSON.parse('{"balanceMinor": 1e999}') as { balanceMinor: number };
    expect(parsed.balanceMinor).toBe(Infinity);

    const payload = basePayload({ accounts: [baseAccount({ balanceMinor: parsed.balanceMinor })] });
    const result = validateImportPayload(payload);
    expect(result.success).toBe(false);
  });

  it("rejects a literal Infinity balanceMinor", () => {
    const payload = basePayload({ accounts: [baseAccount({ balanceMinor: Infinity })] });
    expect(validateImportPayload(payload).success).toBe(false);
  });

  it("rejects a literal -Infinity balanceMinor", () => {
    const payload = basePayload({ accounts: [baseAccount({ balanceMinor: -Infinity })] });
    expect(validateImportPayload(payload).success).toBe(false);
  });

  it("rejects a NaN balanceMinor", () => {
    const payload = basePayload({ accounts: [baseAccount({ balanceMinor: NaN })] });
    expect(validateImportPayload(payload).success).toBe(false);
  });

  it("still accepts large-but-legitimate real-world amounts (e.g. a EUR 5,000,000 balance)", () => {
    const payload = basePayload({ accounts: [baseAccount({ balanceMinor: 500_000_000 })] });
    expect(validateImportPayload(payload).success).toBe(true);
  });
});

describe("import validation hardening — M5 (semantic date validation)", () => {
  it("accepts a date-only ISO string (2026-01-01)", () => {
    const payload = basePayload({ accounts: [baseAccount({ createdAt: "2026-01-01", updatedAt: "2026-01-01" })] });
    expect(validateImportPayload(payload).success).toBe(true);
  });

  it("accepts a full ISO timestamp (2026-01-01T12:30:00.000Z)", () => {
    const payload = basePayload({
      accounts: [baseAccount({ createdAt: "2026-01-01T12:30:00.000Z", updatedAt: "2026-01-01T12:30:00.000Z" })],
    });
    expect(validateImportPayload(payload).success).toBe(true);
  });

  it("rejects a non-date string ('not-a-date')", () => {
    const payload = basePayload({ accounts: [baseAccount({ createdAt: "not-a-date" })] });
    expect(validateImportPayload(payload).success).toBe(false);
  });

  it("rejects an out-of-range calendar date ('2026-99-99')", () => {
    const payload = basePayload({ accounts: [baseAccount({ createdAt: "2026-99-99" })] });
    expect(validateImportPayload(payload).success).toBe(false);
  });

  it("rejects an empty date string", () => {
    const payload = basePayload({ accounts: [baseAccount({ createdAt: "" })] });
    expect(validateImportPayload(payload).success).toBe(false);
  });
});

describe("import validation hardening — malformed payload is still rejected cleanly, not applied partially", () => {
  it("a garbage top-level payload fails without throwing", () => {
    expect(() => validateImportPayload({ nonsense: true })).not.toThrow();
    expect(validateImportPayload({ nonsense: true }).success).toBe(false);
  });
});
