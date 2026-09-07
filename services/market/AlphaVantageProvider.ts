import type {
  CompanyProfile,
  DividendInfo,
  MarketDataErrorKind,
  MarketDataProviderClient,
} from "@/types/marketData";
import { MarketDataError } from "@/types/marketData";
import { toMinorUnits } from "@/utils/money";

const BASE_URL = "https://www.alphavantage.co/query";
const REQUEST_TIMEOUT_MS = 10_000;
/** Alpha Vantage's own documentation demo symbol — cheapest possible way to validate a key. */
const TEST_SYMBOL = "IBM";

async function fetchOverview(symbol: string, apiKey: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let body: unknown;
  try {
    const response = await fetch(
      `${BASE_URL}?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`,
      { signal: controller.signal }
    );
    body = await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new MarketDataError("networkUnavailable", "alphaVantage", "Verzoek verliep (timeout).");
    }
    throw new MarketDataError("networkUnavailable", "alphaVantage", "Geen internetverbinding.");
  } finally {
    clearTimeout(timeout);
  }

  const data = (body ?? {}) as Record<string, unknown>;

  // Alpha Vantage never uses HTTP error codes — every failure mode is a 200
  // with a differently-shaped JSON body, so each has to be checked by hand.
  if (typeof data.Note === "string") {
    throw new MarketDataError("rateLimited", "alphaVantage", data.Note);
  }
  if (typeof data.Information === "string") {
    const kind: MarketDataErrorKind = /invalid api/i.test(data.Information) ? "invalidApiKey" : "rateLimited";
    throw new MarketDataError(kind, "alphaVantage", data.Information);
  }
  if (typeof data["Error Message"] === "string") {
    throw new MarketDataError("notFound", "alphaVantage", data["Error Message"] as string);
  }
  if (!data.Symbol) {
    throw new MarketDataError("invalidApiKey", "alphaVantage", "Ongeldige API-key of geen data beschikbaar.");
  }

  return data;
}

function parseNumberOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === "None" || value === "-") return null;
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

export const AlphaVantageProvider: MarketDataProviderClient = {
  id: "alphaVantage",

  async testConnection(apiKey) {
    try {
      await fetchOverview(TEST_SYMBOL, apiKey);
      return { ok: true };
    } catch (error) {
      if (error instanceof MarketDataError) {
        return { ok: false, kind: error.kind, message: error.message };
      }
      return { ok: false, kind: "unknown", message: "Onbekende fout bij het testen van de verbinding." };
    }
  },

  async getCompanyProfile(providerSymbol, apiKey): Promise<CompanyProfile> {
    const data = await fetchOverview(providerSymbol, apiKey);
    const marketCap = parseNumberOrNull(data.MarketCapitalization);

    return {
      symbol: providerSymbol,
      name: typeof data.Name === "string" ? data.Name : null,
      exchange: typeof data.Exchange === "string" ? data.Exchange : null,
      sector: typeof data.Sector === "string" ? data.Sector : null,
      industry: typeof data.Industry === "string" ? data.Industry : null,
      country: typeof data.Country === "string" ? data.Country : null,
      website: null,
      marketCapMinor: marketCap === null ? null : toMinorUnits(marketCap),
      description: typeof data.Description === "string" ? data.Description : null,
      currency: typeof data.Currency === "string" ? data.Currency : "USD",
      timestamp: new Date().toISOString(),
    };
  },

  async getDividend(providerSymbol, apiKey): Promise<DividendInfo> {
    const data = await fetchOverview(providerSymbol, apiKey);
    const perShare = parseNumberOrNull(data.DividendPerShare);
    const yieldValue = parseNumberOrNull(data.DividendYield);

    return {
      symbol: providerSymbol,
      dividendPerShareMinor: perShare === null ? null : toMinorUnits(perShare),
      dividendYield: yieldValue,
      exDividendDate:
        typeof data.ExDividendDate === "string" && data.ExDividendDate !== "None" ? data.ExDividendDate : null,
      currency: typeof data.Currency === "string" ? data.Currency : "USD",
      timestamp: new Date().toISOString(),
    };
  },
};
