import { useAccountsStore } from "./accountsStore";
import { useBudgetsStore } from "./budgetsStore";
import { useInvestmentsStore } from "./investmentsStore";
import { useLiabilitiesStore } from "./liabilitiesStore";
import { useSettingsStore } from "./settingsStore";
import { useTransactionsStore } from "./transactionsStore";
import { useMarketDataStore } from "./marketDataStore";

export async function bootstrapApp(): Promise<void> {
  await useSettingsStore.getState().refresh();
  await Promise.all([
    useAccountsStore.getState().refresh(),
    useInvestmentsStore.getState().refresh(),
    useTransactionsStore.getState().refresh(),
    useBudgetsStore.getState().refresh(),
    useLiabilitiesStore.getState().refresh(),
    useMarketDataStore.getState().loadCachedQuotes(),
  ]);
}

export async function refreshAllFinancialData(): Promise<void> {
  await Promise.all([
    useAccountsStore.getState().refresh(),
    useInvestmentsStore.getState().refresh(),
    useTransactionsStore.getState().refresh(),
    useBudgetsStore.getState().refresh(),
    useLiabilitiesStore.getState().refresh(),
  ]);
}

export { useAccountsStore } from "./accountsStore";
export { useBudgetsStore } from "./budgetsStore";
export { useInvestmentsStore } from "./investmentsStore";
export { useLiabilitiesStore } from "./liabilitiesStore";
export { useSettingsStore } from "./settingsStore";
export { useTransactionsStore } from "./transactionsStore";
