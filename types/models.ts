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
  /** ISIN, when known — the primary matching key for broker imports (ticker alone is provably ambiguous: e.g. Revolut's "SAP" ticker is the US ADR, ISIN US8030542042, not the Xetra share). Absent for manual entries and demo data. */
  isin?: string;
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
  /** Set when quantity reached 0 via a broker import — purely informational (the "closed" state is always derived live from quantity === 0, never trusted from this field alone). Absent for positions that were never fully sold. */
  closedAt?: ISODateString;
}

export type InvestmentTransactionType = "buy" | "sell" | "dividend" | "fee" | "corporate_action";

/** Which broker a transaction was imported from; absent for manual entries. */
export type BrokerId = "revolut" | "degiro";

/** Whether realized P&L for this transaction came straight from the broker's own report, or was computed by WealthOS (e.g. for brokers that don't provide FIFO P&L themselves). Never mix the two silently. */
export type PnlSource = "broker-reported" | "wealthos-calculated";

export interface InvestmentTransaction {
  id: string;
  investmentId: string;
  type: InvestmentTransactionType;
  quantity: number;
  priceMinor: number;
  date: ISODateString;
  note?: string;
  createdAt: ISODateString;

  // --- Broker-import fields below: all optional, all absent on manual/demo entries ---
  /** Transaction's own currency, when it can differ from the parent Investment's declared currency. Defaults to the parent Investment.currency when absent. */
  currency?: CurrencyCode;
  /** Pure execution value (price × quantity), before fees/commission — NOT the same as the cash amount that actually moved. */
  grossAmountMinor?: number;
  netAmountMinor?: number;
  feesMinor?: number;
  commissionMinor?: number;
  withholdingTaxMinor?: number;
  /** Only meaningful on "sell" rows that close (part of) a lot. */
  realizedPnlMinor?: number;
  costBasisMinor?: number;
  /** Explicit false when a corporate action's cost basis genuinely isn't known (e.g. a spin-off) — never inferred as 0 by omission. Absent = not applicable (manual entries, buys). */
  costBasisKnown?: boolean;
  pnlSource?: PnlSource;
  /** FX rate captured at the time of the transaction, if the broker reported one — used for point-in-time conversion, never overwritten by a later live rate lookup. */
  fxRateAtTransaction?: number;
  broker?: BrokerId;
  sourceFile?: string;
  sourceRowRef?: string;
  /** Composite dedup key — see features/brokerImport/fingerprint.ts. Absent on manual entries. */
  importFingerprint?: string;
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

/**
 * A local Windows user profile — lets multiple people share one WealthOS
 * installation with fully isolated data. Lives in a global (never
 * profile-scoped) registry. The PIN hash is deliberately NOT a field here:
 * it lives only in OS-level secure storage (Electron safeStorage/DPAPI via
 * `lib/secureKeyStore.ts`, keyed per profile id), structurally separate from
 * both this registry and every profile's financial data (which lives under
 * its own `wealthos:profile:<id>:*` storage namespace) — so a PIN reset can
 * never touch financial data, financial data can never leak between
 * profiles, and the PIN hash can never end up in a plain-JSON export.
 */
export interface Profile {
  id: string;
  name: string;
  createdAt: ISODateString;
  lastLoginAt: ISODateString | null;
  isDemo: boolean;
  /** True until a PIN has been set for this profile — new profiles set one at creation time and never see this; migrated pre-0.3.0 profiles always start here since the old app-lock PIN could not be safely carried over. The demo profile never has a PIN and never checks this. */
  needsPinSetup?: boolean;
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

/** One record per completed broker import — metadata only, never raw statement contents (see security notes in features/brokerImport). */
export interface BrokerImportRecord {
  id: string;
  broker: BrokerId;
  importedAt: ISODateString;
  sourceFileNames: string[];
  rowsScanned: number;
  rowsImported: number;
  rowsDuplicate: number;
  warnings: string[];
}

/** Local, best-effort tracking of live-market-data request volume against the free-tier assumption WealthOS documents (Twelve Data Basic: 8/min, 800/day). Never claims to be the provider's own authoritative remaining quota. */
export interface MarketDataQuota {
  /** UTC calendar date (YYYY-MM-DD) this count applies to; a mismatch means the count resets to 0 before use. */
  date: string;
  requestsUsed: number;
}
