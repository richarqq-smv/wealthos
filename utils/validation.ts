import { z } from "zod";

const dataOrigin = z.enum(["demo", "manual", "synced"]);
/**
 * Non-empty AND semantically a real, parseable date (accepts both date-only
 * `"2026-01-01"` and full ISO timestamp `"2026-01-01T12:30:00.000Z"` forms,
 * matching every format WealthOS itself writes) — a malformed string like
 * `"not-a-date"` or an out-of-range one like `"2026-99-99"` is rejected at
 * import time instead of silently becoming `Invalid Date`/`NaN` later in
 * sorting or display.
 */
const isoDate = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), { message: "Ongeldige datum." });
/** Plain finite numbers only — `z.number()` alone accepts `Infinity`/`-Infinity` (only `NaN` is rejected by default), and a numeral like `1e999` is valid JSON that overflows to `Infinity` when parsed. No arbitrary upper bound is imposed — only real, legitimate WealthOS amounts must never be blocked. */
const financialNumber = z.number().finite();
const currencyCode = z.enum(["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD"]);

const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  institution: z.string(),
  type: z.enum(["checking", "savings", "cash", "other"]),
  balanceMinor: financialNumber,
  currency: currencyCode,
  note: z.string().optional(),
  origin: dataOrigin,
  createdAt: isoDate,
  updatedAt: isoDate,
});

const investmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  ticker: z.string().min(1),
  type: z.enum(["stock", "etf", "crypto", "fund", "other"]),
  quantity: financialNumber.nonnegative(),
  averagePriceMinor: financialNumber.nonnegative(),
  currentPriceMinor: financialNumber.nonnegative(),
  currency: currencyCode,
  broker: z.string(),
  purchaseDate: isoDate,
  origin: dataOrigin,
  createdAt: isoDate,
  updatedAt: isoDate,
  exchange: z.string().optional(),
  providerSymbol: z.string().optional(),
  liveDataEnabled: z.boolean().optional(),
  priceUpdatedAt: isoDate.optional(),
});

const investmentTransactionSchema = z.object({
  id: z.string().min(1),
  investmentId: z.string().min(1),
  type: z.enum(["buy", "sell"]),
  quantity: financialNumber.positive(),
  priceMinor: financialNumber.nonnegative(),
  date: isoDate,
  note: z.string().optional(),
  createdAt: isoDate,
});

const transactionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["income", "expense", "transfer", "investment"]),
  amountMinor: financialNumber,
  description: z.string().min(1),
  category: z.enum([
    "salaris",
    "wonen",
    "boodschappen",
    "vervoer",
    "entertainment",
    "abonnementen",
    "gezondheid",
    "vakantie",
    "shopping",
    "belegging",
    "overboeking",
    "overig",
  ]),
  accountId: z.string().min(1),
  date: isoDate,
  note: z.string().optional(),
  origin: dataOrigin,
  createdAt: isoDate,
  updatedAt: isoDate,
});

const budgetSchema = z.object({
  id: z.string().min(1),
  category: transactionSchema.shape.category,
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amountMinor: financialNumber.nonnegative(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

const liabilitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["mortgage", "loan", "creditCard", "other"]),
  amountMinor: financialNumber.nonnegative(),
  interestRate: financialNumber.optional(),
  note: z.string().optional(),
  origin: dataOrigin,
  createdAt: isoDate,
  updatedAt: isoDate,
});

/**
 * Connection flags and preferences only. There is no field here for an API
 * key value — the `Settings` type never carries one, so there is nothing
 * for this schema to accidentally accept or an export to accidentally leak.
 */
const marketDataSettingsSchema = z.object({
  enabled: z.boolean(),
  twelveDataConfigured: z.boolean(),
  alphaVantageConfigured: z.boolean(),
  assetToggles: z.object({
    stocks: z.boolean(),
    etf: z.boolean(),
    crypto: z.boolean(),
    forex: z.boolean(),
    historical: z.boolean(),
    dividend: z.boolean(),
    companyInfo: z.boolean(),
  }),
  autoRefresh: z.boolean(),
  refreshIntervalMinutes: z.number().finite().positive(),
  lastSuccessfulUpdate: isoDate.nullable(),
});

const settingsSchema = z.object({
  themePreference: z.enum(["light", "dark", "system"]),
  currency: currencyCode,
  privacyMode: z.boolean(),
  appLockMethod: z.enum(["none", "pin", "biometric"]),
  onboardingCompleted: z.boolean(),
  demoModeActive: z.boolean(),
  userName: z.string(),
  marketData: marketDataSettingsSchema,
});

export const exportPayloadSchema = z.object({
  version: z.literal(1),
  exportedAt: isoDate,
  accounts: z.array(accountSchema),
  investments: z.array(investmentSchema),
  investmentTransactions: z.array(investmentTransactionSchema),
  transactions: z.array(transactionSchema),
  budgets: z.array(budgetSchema),
  liabilities: z.array(liabilitySchema),
  settings: settingsSchema,
});

export type ValidatedExportPayload = z.infer<typeof exportPayloadSchema>;

export function validateImportPayload(data: unknown) {
  return exportPayloadSchema.safeParse(data);
}
