import type { Account, Investment, InvestmentTransaction, Transaction } from "./models";

export interface MarketQuote {
  ticker: string;
  priceMinor: number;
  currency: string;
  asOf: string;
  isMock: true;
}

export interface BankingProvider {
  readonly id: string;
  readonly isMock: boolean;
  getAccounts(): Promise<Account[]>;
  getTransactions(accountId: string): Promise<Transaction[]>;
}

export interface BrokerageProvider {
  readonly id: string;
  readonly isMock: boolean;
  getPortfolio(): Promise<Investment[]>;
  getTransactions(): Promise<InvestmentTransaction[]>;
}

export interface MarketDataProvider {
  readonly id: string;
  readonly isMock: boolean;
  getQuote(ticker: string): Promise<MarketQuote>;
}
