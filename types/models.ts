export type ISODateString = string;
export type CurrencyCode = "EUR" | "USD" | "GBP" | "CHF" | "JPY" | "CAD" | "AUD";

export type DataOrigin = "demo" | "manual" | "synced";

export type AccountType = "checking" | "savings" | "cash" | "other";

export interface Account {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  balanceMinor: number;
  currency: CurrencyCode;
  note?: string;
  origin: DataOrigin;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type InvestmentType = "stock" | "etf" | "crypto" | "fund" | "other";

export interface Investment {
  id: string;
  name: string;
  ticker: string;
  type: InvestmentType;
  quantity: number;
  averagePriceMinor: number;
  currentPriceMinor: number;
  currency: CurrencyCode;
  broker: string;
  purchaseDate: ISODateString;
  origin: DataOrigin;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  /** Same ticker can exist on multiple exchanges — kept distinct from `ticker` for display. */
  exchange?: string;
  /** The exact symbol the market-data provider expects (e.g. "BTC/USD"), chosen once via symbol search. */
  providerSymbol?: string;
  /** Set once the user links this position to live market data; absent = manual-only, never fetched. */
  liveDataEnabled?: boolean;
  priceUpdatedAt?: ISODateString;
}

export type InvestmentTransactionType = "buy" | "sell";

export interface InvestmentTransaction {
  id: string;
  investmentId: string;
  type: InvestmentTransactionType;
  quantity: number;
  priceMinor: number;
  date: ISODateString;
  note?: string;
  createdAt: ISODateString;
}

export type TransactionType = "income" | "expense" | "transfer" | "investment";

export type TransactionCategory =
  | "salaris"
  | "wonen"
  | "boodschappen"
  | "vervoer"
  | "entertainment"
  | "abonnementen"
  | "gezondheid"
  | "vakantie"
  | "shopping"
  | "belegging"
  | "overboeking"
  | "overig";

export interface Transaction {
  id: string;
  type: TransactionType;
  amountMinor: number;
  description: string;
  category: TransactionCategory;
  accountId: string;
  date: ISODateString;
  note?: string;
  origin: DataOrigin;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type LiabilityType = "mortgage" | "loan" | "creditCard" | "other";

export interface Liability {
  id: string;
  name: string;
  type: LiabilityType;
  amountMinor: number;
  interestRate?: number;
  note?: string;
  origin: DataOrigin;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Budget {
  id: string;
  category: TransactionCategory;
  month: string;
  amountMinor: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface PortfolioSnapshot {
  id: string;
  date: ISODateString;
  netWorthMinor: number;
  cashMinor: number;
  investmentsMinor: number;
  liabilitiesMinor: number;
}

export type ThemePreference = "light" | "dark" | "system";

export type AppLockMethod = "none" | "pin" | "biometric";

export interface MarketDataAssetToggles {
  stocks: boolean;
  etf: boolean;
  crypto: boolean;
  forex: boolean;
  historical: boolean;
  dividend: boolean;
  companyInfo: boolean;
}

/**
 * Connection/preference state only — never the API key values themselves.
 * Keys live exclusively in the OS-encrypted secure store (see
 * `lib/secureKeyStore.ts`) so they can never end up in a JSON export.
 */
export interface MarketDataSettings {
  enabled: boolean;
  twelveDataConfigured: boolean;
  alphaVantageConfigured: boolean;
  assetToggles: MarketDataAssetToggles;
  autoRefresh: boolean;
  refreshIntervalMinutes: number;
  lastSuccessfulUpdate: ISODateString | null;
}

export interface Settings {
  themePreference: ThemePreference;
  currency: CurrencyCode;
  privacyMode: boolean;
  appLockMethod: AppLockMethod;
  pinHash: string | null;
  onboardingCompleted: boolean;
  demoModeActive: boolean;
  userName: string;
  marketData: MarketDataSettings;
}

export interface ExportPayload {
  version: 1;
  exportedAt: ISODateString;
  accounts: Account[];
  investments: Investment[];
  investmentTransactions: InvestmentTransaction[];
  transactions: Transaction[];
  budgets: Budget[];
  liabilities: Liability[];
  settings: Omit<Settings, "pinHash">;
}
