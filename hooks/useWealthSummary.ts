import { useMemo } from "react";
import { useAccountsStore } from "@/store/accountsStore";
import { useInvestmentsStore } from "@/store/investmentsStore";
import { useLiabilitiesStore } from "@/store/liabilitiesStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useFxLookup } from "@/hooks/useFxLookup";
import {
  calculateNetWorthInBaseCurrency,
  calculatePortfolioValueInBaseCurrency,
  calculateTotalCashInBaseCurrency,
  calculateTotalLiabilities,
  calculateWealthAllocation,
} from "@/lib/calculations";

/**
 * Same-currency portfolios (the default, and all demo data) get identical
 * output to plain `calculatePortfolioValue`/`calculateNetWorth`/`calculateTotalCash`
 * — the FX lookup only changes anything once a position or account is priced
 * in a currency other than the user's base currency (rule: multi-currency FX).
 */
export function useWealthSummary() {
  const accounts = useAccountsStore((s) => s.accounts);
  const investments = useInvestmentsStore((s) => s.investments);
  const liabilities = useLiabilitiesStore((s) => s.liabilities);
  const baseCurrency = useSettingsStore((s) => s.currency);
  const fxLookup = useFxLookup(investments, accounts, baseCurrency);

  return useMemo(() => {
    const cashMinor = calculateTotalCashInBaseCurrency(accounts, baseCurrency, fxLookup);
    const portfolioMinor = calculatePortfolioValueInBaseCurrency(investments, baseCurrency, fxLookup);
    const liabilitiesMinor = calculateTotalLiabilities(liabilities);
    const netWorthMinor = calculateNetWorthInBaseCurrency(accounts, investments, liabilities, baseCurrency, fxLookup);
    const allocation = calculateWealthAllocation(accounts, investments);
    return { cashMinor, portfolioMinor, liabilitiesMinor, netWorthMinor, allocation, accounts, investments, liabilities };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, investments, liabilities, baseCurrency, fxLookup]);
}
