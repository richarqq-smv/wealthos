import type { AccountType, InvestmentType, LiabilityType, TransactionCategory, TransactionType } from "@/types/models";

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  checking: "Betaalrekening",
  savings: "Spaarrekening",
  cash: "Contant",
  other: "Overig",
};

export const INVESTMENT_TYPE_LABEL: Record<InvestmentType, string> = {
  stock: "Aandeel",
  etf: "ETF",
  crypto: "Crypto",
  fund: "Fonds",
  other: "Overig",
};

export const LIABILITY_TYPE_LABEL: Record<LiabilityType, string> = {
  mortgage: "Hypotheek",
  loan: "Lening",
  creditCard: "Creditcard",
  other: "Overig",
};

export const TRANSACTION_TYPE_LABEL: Record<TransactionType, string> = {
  income: "Inkomst",
  expense: "Uitgave",
  transfer: "Overboeking",
  investment: "Belegging",
};

export const TRANSACTION_CATEGORY_LABEL: Record<TransactionCategory, string> = {
  salaris: "Salaris",
  wonen: "Wonen",
  boodschappen: "Boodschappen",
  vervoer: "Vervoer",
  entertainment: "Entertainment",
  abonnementen: "Abonnementen",
  gezondheid: "Gezondheid",
  vakantie: "Vakantie",
  shopping: "Shopping",
  belegging: "Belegging",
  overboeking: "Overboeking",
  overig: "Overig",
};

export const EXPENSE_CATEGORIES: TransactionCategory[] = [
  "wonen",
  "boodschappen",
  "vervoer",
  "entertainment",
  "abonnementen",
  "gezondheid",
  "vakantie",
  "shopping",
  "overig",
];

export const ALL_CATEGORIES: TransactionCategory[] = [
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
];
