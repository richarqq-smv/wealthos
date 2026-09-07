import type {
  FxRate,
  HistoricalPeriod,
  HistoricalPoint,
  HistoricalSeries,
  MarketAssetType,
  MarketDataErrorKind,
  MarketDataProviderClient,
  MarketQuote,
  SymbolSearchResult,
} from "@/types/marketData";
import { MarketDataError } from "@/types/marketData";
import { toMinorUnits } from "@/utils/money";

const BASE_URL = "https://api.twelvedata.com";
const REQUEST_TIMEOUT_MS = 10_000;

const HISTORICAL_PARAMS: Record<HistoricalPeriod, { interval: string; outputsize: number }> = {
  "1D": { interval: "15min", outputsize: 32 },
  "1W": { interval: "1h", outputsize: 40 },
  "1M": { interval: "1day", outputsize: 22 },
  "3M": { interval: "1day", outputsize: 65 },
  "6M": { interval: "1day", outputsize: 130 },
  YTD: { interval: "1day", outputsize: 260 },
  "1Y": { interval: "1week", outputsize: 52 },
  "5Y": { interval: "1month", outputsize: 60 },
  MAX: { interval: "1month", outputsize: 500 },
};

/** Never let a hung request block the UI indefinitely — degrade to cache instead. */
async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new MarketDataError("networkUnavailable", "twelveData", "Verzoek verliep (timeout).");
    }
    throw new MarketDataError("networkUnavailable", "twelveData", "Geen internetverbinding.");
  } finally {
    clearTimeout(timeout);
  }
}

interface TwelveDataErrorBody {
  status?: string;
  code?: number;
  message?: string;
}

function classifyErrorCode(code: number | undefined): MarketDataErrorKind {
  switch (code) {
    case 401:
    case 403:
      return "invalidApiKey";
    case 429:
      return "rateLimited";
    case 404:
      return "notFound";
    default:
      return "providerUnavailable";
  }
}

function throwIfErrorBody(body: unknown): asserts body is Record<string, unknown> {
  if (body && typeof body === "object" && (body as TwelveDataErrorBody).status === "error") {
    const err = body as TwelveDataErrorBody;
    throw new MarketDataError(
      classifyErrorCode(err.code),
      "twelveData",
      err.message ?? "Twelve Data gaf een onbekende fout terug."
    );
  }
}

function parseQuoteBody(
  data: Record<string, unknown>,
  providerSymbol: string,
  assetType: MarketAssetType,
  exchange?: string
): MarketQuote {
  const close = Number.parseFloat(String(data.close ?? ""));
  const previousClose = data.previous_close !== undefined ? Number.parseFloat(String(data.previous_close)) : NaN;
  const change = data.change !== undefined ? Number.parseFloat(String(data.change)) : NaN;
  const changePercent = data.percent_change !== undefined ? Number.parseFloat(String(data.percent_change)) : NaN;

  if (Number.isNaN(close)) {
    throw new MarketDataError("malformedResponse", "twelveData", "Onverwacht antwoordformaat van Twelve Data.");
  }

  return {
    symbol: providerSymbol,
    providerSymbol,
    exchange,
    provider: "twelveData",
    assetType,
    priceMinor: toMinorUnits(close),
    previousCloseMinor: Number.isNaN(previousClose) ? null : toMinorUnits(previousClose),
    changeMinor: Number.isNaN(change) ? null : toMinorUnits(change),
    changePercent: Number.isNaN(changePercent) ? null : changePercent / 100,
    currency: typeof data.currency === "string" ? data.currency : "USD",
    timestamp: new Date().toISOString(),
    isDelayed: true,
  };
}

export const TwelveDataProvider: MarketDataProviderClient = {
  id: "twelveData",

  async testConnection(apiKey) {
    try {
      const body = await fetchJson(`${BASE_URL}/api_usage?apikey=${encodeURIComponent(apiKey)}`);
      throwIfErrorBody(body);
      return { ok: true };
    } catch (error) {
      if (error instanceof MarketDataError) {
        return { ok: false, kind: error.kind, message: error.message };
      }
      return { ok: false, kind: "unknown", message: "Onbekende fout bij het testen van de verbinding." };
    }
  },

  async getQuote(providerSymbol, assetType, apiKey, exchange): Promise<MarketQuote> {
    const exchangeParam = exchange ? `&exchange=${encodeURIComponent(exchange)}` : "";
    const url = `${BASE_URL}/quote?symbol=${encodeURIComponent(providerSymbol)}${exchangeParam}&apikey=${encodeURIComponent(apiKey)}`;
    const body = await fetchJson(url);
    throwIfErrorBody(body);
    return parseQuoteBody(body as Record<string, unknown>, providerSymbol, assetType, exchange);
  },

  async getQuotesBatch(symbols, apiKey): Promise<MarketQuote[]> {
    if (symbols.length === 0) return [];

    // Symbols cross-listed on multiple exchanges (e.g. a European stock that
    // also has a US ADR) MUST be disambiguated with `exchange`, which the
    // multi-symbol endpoint below cannot express per-symbol — so those go
    // through individual getQuote calls instead of the shared batch call.
    const disambiguated = symbols.filter((s) => s.exchange);
    const plain = symbols.filter((s) => !s.exchange);

    const disambiguatedResults = await Promise.all(
      disambiguated.map(async (s) => {
        try {
          return await TwelveDataProvider.getQuote!(s.providerSymbol, s.assetType, apiKey, s.exchange);
        } catch {
          return null;
        }
      })
    );
    const quotes: MarketQuote[] = disambiguatedResults.filter((q): q is MarketQuote => q !== null);

    if (plain.length === 1) {
      const only = plain[0]!;
      try {
        quotes.push(await TwelveDataProvider.getQuote!(only.providerSymbol, only.assetType, apiKey));
      } catch {
        // Skip — the individual quote failed, leave it out of this refresh cycle.
      }
    } else if (plain.length > 1) {
      const joined = plain.map((s) => s.providerSymbol).join(",");
      const url = `${BASE_URL}/quote?symbol=${encodeURIComponent(joined)}&apikey=${encodeURIComponent(apiKey)}`;
      const body = await fetchJson(url);
      throwIfErrorBody(body);

      // With multiple symbols Twelve Data keys the response by symbol instead
      // of returning quote fields at the top level.
      const byAssetType = new Map(plain.map((s) => [s.providerSymbol, s.assetType]));
      const data = body as Record<string, unknown>;
      for (const [symbol, assetType] of byAssetType) {
        const entry = data[symbol];
        if (entry && typeof entry === "object") {
          try {
            quotes.push(parseQuoteBody(entry as Record<string, unknown>, symbol, assetType));
          } catch {
            // Skip symbols Twelve Data couldn't resolve rather than failing the whole batch.
          }
        }
      }
    }
    return quotes;
  },

  async getHistorical(providerSymbol, assetType, period, apiKey, exchange): Promise<HistoricalSeries> {
    const { interval, outputsize } = HISTORICAL_PARAMS[period];
    const exchangeParam = exchange ? `&exchange=${encodeURIComponent(exchange)}` : "";
    const url = `${BASE_URL}/time_series?symbol=${encodeURIComponent(providerSymbol)}${exchangeParam}&interval=${interval}&outputsize=${outputsize}&apikey=${encodeURIComponent(apiKey)}`;
    const body = await fetchJson(url);
    throwIfErrorBody(body);

    const data = body as Record<string, unknown>;
    const values = Array.isArray(data.values) ? (data.values as Record<string, unknown>[]) : null;
    if (!values) {
      throw new MarketDataError("malformedResponse", "twelveData", "Geen historische data ontvangen.");
    }

    const points: HistoricalPoint[] = values
      .map((point) => {
        const close = Number.parseFloat(String(point.close ?? ""));
        return {
          date: String(point.datetime ?? ""),
          closeMinor: toMinorUnits(close),
        };
      })
      .filter((point) => point.date && !Number.isNaN(point.closeMinor))
      .reverse();

    return {
      symbol: providerSymbol,
      exchange,
      period,
      points,
      currency: typeof data.meta === "object" && data.meta !== null && "currency" in data.meta
        ? String((data.meta as Record<string, unknown>).currency)
        : "USD",
      timestamp: new Date().toISOString(),
    };
  },

  async searchSymbol(query, apiKey): Promise<SymbolSearchResult[]> {
    const url = `${BASE_URL}/symbol_search?symbol=${encodeURIComponent(query)}&apikey=${encodeURIComponent(apiKey)}`;
    const body = await fetchJson(url);
    throwIfErrorBody(body);

    const data = body as Record<string, unknown>;
    const results = Array.isArray(data.data) ? (data.data as Record<string, unknown>[]) : [];

    return results.slice(0, 15).map((item) => {
      const instrumentType = String(item.instrument_type ?? "").toLowerCase();
      let assetType: MarketAssetType = "stock";
      if (instrumentType.includes("etf")) assetType = "etf";
      else if (instrumentType.includes("crypto") || instrumentType.includes("digital")) assetType = "crypto";
      else if (instrumentType.includes("forex") || instrumentType.includes("currency")) assetType = "forex";

      return {
        symbol: String(item.symbol ?? ""),
        providerSymbol: String(item.symbol ?? ""),
        name: String(item.instrument_name ?? item.symbol ?? ""),
        exchange: String(item.exchange ?? ""),
        assetType,
        currency: String(item.currency ?? "USD"),
      };
    });
  },

  async getFxRate(base, quote, apiKey): Promise<FxRate> {
    const symbol = `${base}/${quote}`;
    const url = `${BASE_URL}/exchange_rate?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
    const body = await fetchJson(url);
    throwIfErrorBody(body);

    const data = body as Record<string, unknown>;
    const rate = Number.parseFloat(String(data.rate ?? ""));
    if (Number.isNaN(rate)) {
      throw new MarketDataError("malformedResponse", "twelveData", "Geen geldige wisselkoers ontvangen.");
    }

    return { base, quote, rate, timestamp: new Date().toISOString() };
  },
};
