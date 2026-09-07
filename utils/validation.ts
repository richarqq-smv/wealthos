import { z } from "zod";

const dataOrigin = z.enum(["demo", "manual", "synced"]);
const isoDate = z.string().min(1);
const currencyCode = z.enum(["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD"]);

const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  institution: z.string(),
  type: z.enum(["checking", "savings", "cash", "other"]),
  balanceMinor: z.number(),
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
  quantity: z.number().nonnegative(),
  averagePriceMinor: z.number().nonnegative(),
  currentPriceMinor: z.number().nonnegative(),
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
  quantity: z.number().positive(),
  priceMinor: z.number().nonnegative(),
  date: isoDate,
  note: z.string().optional(),
  createdAt: isoDate,
});

const transactionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["income", "expense", "transfer", "investment"]),
  amountMinor: z.number(),
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
  amountMinor: z.number().nonnegative(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

const liabilitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["mortgage", "loan", "creditCard", "other"]),
  amountMinor: z.number().nonnegative(),
  interestRate: z.number().optional(),
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
  refreshIntervalMinutes: z.number().positive(),
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
