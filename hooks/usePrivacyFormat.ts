import { useSettingsStore } from "@/store/settingsStore";
import { formatMoney, formatMoneyCompact, PRIVACY_MASK } from "@/utils/money";
import type { CurrencyCode } from "@/types/models";

export function usePrivacyFormat() {
  const privacyMode = useSettingsStore((s) => s.privacyMode);
  const currency = useSettingsStore((s) => s.currency);

  const money = (minor: number, options?: { currency?: CurrencyCode; hideSign?: boolean }) =>
    privacyMode ? PRIVACY_MASK : formatMoney(minor, options?.currency ?? currency, options);

  const moneyCompact = (minor: number, currencyOverride?: CurrencyCode) =>
    privacyMode ? PRIVACY_MASK : formatMoneyCompact(minor, currencyOverride ?? currency);

  return { privacyMode, money, moneyCompact };
}
