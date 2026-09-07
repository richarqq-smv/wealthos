/**
 * A rate lookup returns `null` when no rate is cached/known yet — callers
 * must degrade gracefully (show the native-currency amount) rather than
 * crash or hide the position, since FX data is one more thing that can be
 * offline or not-yet-fetched.
 */
export type FxRateLookup = (fromCurrency: string, toCurrency: string) => number | null;

export function convertAmountMinor(
  amountMinor: number,
  fromCurrency: string,
  toCurrency: string,
  lookup: FxRateLookup
): number {
  if (fromCurrency === toCurrency) return amountMinor;
  const rate = lookup(fromCurrency, toCurrency);
  if (rate === null || !Number.isFinite(rate)) return amountMinor;
  return Math.round(amountMinor * rate);
}

export function buildFxLookup(rates: Record<string, number>): FxRateLookup {
  return (fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) return 1;
    const direct = rates[`${fromCurrency}:${toCurrency}`];
    if (direct !== undefined) return direct;
    const inverse = rates[`${toCurrency}:${fromCurrency}`];
    if (inverse !== undefined && inverse !== 0) return 1 / inverse;
    return null;
  };
}
