import { DEFAULT_SETTINGS } from "@/lib/repositories/SettingsRepository";
import { validateImportPayload } from "@/utils/validation";

const KEY_SHAPED_FIELD_NAMES = ["apikey", "api_key", "secret", "token", "password", "credential"];

function hasKeyShapedField(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.keys(value).some((key) => KEY_SHAPED_FIELD_NAMES.some((bad) => key.toLowerCase().includes(bad)));
}

describe("market-data settings never carry secret-shaped fields", () => {
  it("DEFAULT_SETTINGS.marketData has no key/secret-shaped field", () => {
    expect(hasKeyShapedField(DEFAULT_SETTINGS.marketData)).toBe(false);
    // Only boolean "configured" flags represent provider connection state — never the key value itself.
    expect(typeof DEFAULT_SETTINGS.marketData.twelveDataConfigured).toBe("boolean");
    expect(typeof DEFAULT_SETTINGS.marketData.alphaVantageConfigured).toBe("boolean");
  });

  it("strips an injected API-key-shaped field from an imported settings payload", () => {
    const { pinHash: _pinHash, ...settingsWithoutPin } = DEFAULT_SETTINGS;
    const poisonedPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      accounts: [],
      investments: [],
      investmentTransactions: [],
      transactions: [],
      budgets: [],
      liabilities: [],
      settings: {
        ...settingsWithoutPin,
        marketData: {
          ...settingsWithoutPin.marketData,
          // Simulates a hand-crafted or corrupted import file trying to smuggle a real key back in.
          twelveDataApiKey: "should-never-survive-import",
        },
      },
    };

    const result = validateImportPayload(poisonedPayload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(hasKeyShapedField(result.data.settings.marketData)).toBe(false);
      expect("twelveDataApiKey" in result.data.settings.marketData).toBe(false);
    }
  });

  it("rejects a payload with the wrong shape instead of crashing", () => {
    const result = validateImportPayload({ not: "a valid export" });
    expect(result.success).toBe(false);
  });
});
