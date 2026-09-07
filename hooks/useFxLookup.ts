import { useEffect, useState } from "react";
import type { Account, Investment } from "@/types/models";
import { MarketDataService } from "@/services/market/MarketDataService";
import { buildFxLookup, type FxRateLookup } from "@/lib/marketData/currencyConversion";

/**
 * Cache-first FX lookup for whatever foreign currencies the portfolio
 * actually holds — investments (priced via live data) and accounts (a
 * currency only reachable today via import, since "add account" always
 * creates EUR accounts) alike. Same-currency portfolios (the common case,
 * and all demo data) never touch the network — `convertAmountMinor`
 * short-circuits before this lookup is even consulted.
 */
export function useFxLookup(investments: Investment[], accounts: Account[], baseCurrency: string): FxRateLookup {
  const [rates, setRates] = useState<Record<string, number>>({});

  const foreignCurrencies = Array.from(
    new Set(
      [...investments.map((inv) => inv.currency), ...accounts.map((acc) => acc.currency)].filter(
        (currency) => currency !== baseCurrency
      )
    )
  ).sort();
  const key = foreignCurrencies.join(",");

  useEffect(() => {
    if (foreignCurrencies.length === 0) return;
    let cancelled = false;

    (async () => {
      const entries = await Promise.all(
        foreignCurrencies.map(async (currency) => {
          const fx = await MarketDataService.getFxRate(currency, baseCurrency);
          return fx ? ([`${currency}:${baseCurrency}`, fx.rate] as const) : null;
        })
      );
      if (cancelled) return;
      const next: Record<string, number> = {};
      for (const entry of entries) {
        if (entry) next[entry[0]] = entry[1];
      }
      setRates(next);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, baseCurrency]);

  return buildFxLookup(rates);
}
