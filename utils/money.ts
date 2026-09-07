import type { CurrencyCode } from "@/types/models";

/**
 * Money is stored internally as an integer number of minor units (eurocents)
 * to avoid floating-point rounding errors in financial calculations.
 * `10,25` euro is stored as `1025`.
 */

export function toMinorUnits(major: number): number {
  return Math.round(major * 100);
}

export function toMajorUnits(minor: number): number {
  return minor / 100;
}

const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "CHF",
  JPY: "¥",
  CAD: "C$",
  AUD: "A$",
};

export function formatMoney(
  minor: number,
  currency: CurrencyCode = "EUR",
  options?: { hideSign?: boolean; compact?: boolean }
): string {
  const major = toMajorUnits(Math.abs(minor));
  const symbol = CURRENCY_SYMBOL[currency];
  const formatted = new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major);
  const sign = !options?.hideSign && minor < 0 ? "-" : "";
  return `${sign}${symbol} ${formatted}`;
}

export function formatMoneyCompact(minor: number, currency: CurrencyCode = "EUR"): string {
  const major = toMajorUnits(minor);
  const abs = Math.abs(major);
  const symbol = CURRENCY_SYMBOL[currency];
  const sign = major < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    return `${sign}${symbol} ${(abs / 1_000_000).toFixed(1).replace(".", ",")}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${symbol} ${(abs / 1_000).toFixed(1).replace(".", ",")}k`;
  }
  return formatMoney(minor, currency);
}

export function formatMoneySigned(minor: number, currency: CurrencyCode = "EUR"): string {
  const sign = minor > 0 ? "+" : minor < 0 ? "-" : "";
  return `${sign}${formatMoney(Math.abs(minor), currency, { hideSign: true })}`;
}

export function formatPercentage(fraction: number, options?: { signed?: boolean }): string {
  const value = fraction * 100;
  const formatted = new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(value));
  const sign = options?.signed ? (value > 0 ? "+" : value < 0 ? "-" : "") : value < 0 ? "-" : "";
  return `${sign}${formatted}%`;
}

export const PRIVACY_MASK = "••••••";
