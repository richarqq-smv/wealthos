import type {
  Account,
  Budget,
  Investment,
  InvestmentTransaction,
  Liability,
  PortfolioSnapshot,
  Transaction,
} from "@/types/models";
import { generateId } from "@/utils/id";
import { monthKey, subtractDays, subtractMonths } from "@/utils/date";

const now = () => new Date();
const iso = (d: Date) => d.toISOString();
const daysAgo = (days: number) => iso(subtractDays(now(), days));
const monthsAgo = (months: number) => iso(subtractMonths(now(), months));

export const DEMO_ACCOUNT_IDS = {
  ingChecking: "demo-acc-ing-checking",
  raboChecking: "demo-acc-rabo-checking",
  raboSavings: "demo-acc-rabo-savings",
  cash: "demo-acc-cash",
};

export function buildDemoAccounts(): Account[] {
  const createdAt = monthsAgo(14);
  return [
    {
      id: DEMO_ACCOUNT_IDS.ingChecking,
      name: "ING Betaalrekening",
      institution: "ING",
      type: "checking",
      balanceMinor: 1_245_025,
      currency: "EUR",
      origin: "demo",
      createdAt,
      updatedAt: daysAgo(1),
    },
    {
      id: DEMO_ACCOUNT_IDS.raboChecking,
      name: "Rabobank Betaalrekening",
      institution: "Rabobank",
      type: "checking",
      balanceMinor: 832_050,
      currency: "EUR",
      origin: "demo",
      createdAt,
      updatedAt: daysAgo(2),
    },
    {
      id: DEMO_ACCOUNT_IDS.raboSavings,
      name: "Rabobank Sparen",
      institution: "Rabobank",
      type: "savings",
      balanceMinor: 2_500_000,
      currency: "EUR",
      origin: "demo",
      createdAt,
      updatedAt: daysAgo(5),
    },
    {
      id: DEMO_ACCOUNT_IDS.cash,
      name: "Contant geld",
      institution: "Portemonnee",
      type: "cash",
      balanceMinor: 50_000,
      currency: "EUR",
      origin: "demo",
      createdAt,
      updatedAt: daysAgo(10),
    },
  ];
}

interface DemoInvestmentSeed {
  id: string;
  name: string;
  ticker: string;
  type: Investment["type"];
  quantity: number;
  averagePriceMinor: number;
  currentPriceMinor: number;
  broker: string;
  purchaseMonthsAgo: number;
}

const DEMO_INVESTMENT_SEEDS: DemoInvestmentSeed[] = [
  { id: "demo-inv-aapl", name: "Apple", ticker: "AAPL", type: "stock", quantity: 12, averagePriceMinor: 14_200, currentPriceMinor: 17_850, broker: "DEGIRO", purchaseMonthsAgo: 11 },
  { id: "demo-inv-msft", name: "Microsoft", ticker: "MSFT", type: "stock", quantity: 10, averagePriceMinor: 28_000, currentPriceMinor: 33_500, broker: "DEGIRO", purchaseMonthsAgo: 9 },
  { id: "demo-inv-nvda", name: "NVIDIA", ticker: "NVDA", type: "stock", quantity: 8, averagePriceMinor: 6_200, currentPriceMinor: 11_800, broker: "DEGIRO", purchaseMonthsAgo: 7 },
  { id: "demo-inv-asml", name: "ASML", ticker: "ASML", type: "stock", quantity: 4, averagePriceMinor: 61_000, currentPriceMinor: 70_500, broker: "DEGIRO", purchaseMonthsAgo: 6 },
  { id: "demo-inv-vusa", name: "Vanguard S&P 500 ETF", ticker: "VUSA", type: "etf", quantity: 90, averagePriceMinor: 7_800, currentPriceMinor: 9_250, broker: "DEGIRO", purchaseMonthsAgo: 13 },
  { id: "demo-inv-iwda", name: "iShares Core MSCI World", ticker: "IWDA", type: "etf", quantity: 60, averagePriceMinor: 7_200, currentPriceMinor: 8_100, broker: "DEGIRO", purchaseMonthsAgo: 10 },
  { id: "demo-inv-btc", name: "Bitcoin", ticker: "BTC", type: "crypto", quantity: 0.15, averagePriceMinor: 3_800_000, currentPriceMinor: 5_850_000, broker: "Bitvavo", purchaseMonthsAgo: 8 },
  { id: "demo-inv-eth", name: "Ethereum", ticker: "ETH", type: "crypto", quantity: 2.2, averagePriceMinor: 220_000, currentPriceMinor: 295_000, broker: "Bitvavo", purchaseMonthsAgo: 5 },
];

export function buildDemoInvestments(): Investment[] {
  return DEMO_INVESTMENT_SEEDS.map((seed) => ({
    id: seed.id,
    name: seed.name,
    ticker: seed.ticker,
    type: seed.type,
    quantity: seed.quantity,
    averagePriceMinor: seed.averagePriceMinor,
    currentPriceMinor: seed.currentPriceMinor,
    currency: "EUR",
    broker: seed.broker,
    purchaseDate: monthsAgo(seed.purchaseMonthsAgo),
    origin: "demo",
    createdAt: monthsAgo(seed.purchaseMonthsAgo),
    updatedAt: daysAgo(1),
  }));
}

export function buildDemoInvestmentTransactions(): InvestmentTransaction[] {
  return DEMO_INVESTMENT_SEEDS.flatMap((seed) => {
    const initialQuantity = Math.round(seed.quantity * 0.7 * 1000) / 1000;
    const followUpQuantity = Math.round((seed.quantity - initialQuantity) * 1000) / 1000;
    const transactions: InvestmentTransaction[] = [
      {
        id: generateId(),
        investmentId: seed.id,
        type: "buy",
        quantity: initialQuantity,
        priceMinor: Math.round(seed.averagePriceMinor * 0.92),
        date: monthsAgo(seed.purchaseMonthsAgo),
        createdAt: monthsAgo(seed.purchaseMonthsAgo),
      },
    ];
    if (followUpQuantity > 0) {
      transactions.push({
        id: generateId(),
        investmentId: seed.id,
        type: "buy",
        quantity: followUpQuantity,
        priceMinor: Math.round(seed.averagePriceMinor * 1.08),
        date: monthsAgo(Math.max(1, Math.floor(seed.purchaseMonthsAgo / 2))),
        createdAt: monthsAgo(Math.max(1, Math.floor(seed.purchaseMonthsAgo / 2))),
      });
    }
    return transactions;
  });
}

export const DEMO_LIABILITY: Liability = {
  id: "demo-liability-studielening",
  name: "Studieschuld DUO",
  type: "loan",
  amountMinor: 850_000,
  interestRate: 1.5,
  note: "Aflossing via automatische incasso",
  origin: "demo",
  createdAt: monthsAgo(24),
  updatedAt: monthsAgo(1),
};

export function buildDemoLiabilities(): Liability[] {
  return [DEMO_LIABILITY];
}

interface DemoTransactionSeed {
  daysAgo: number;
  type: Transaction["type"];
  amountMinor: number;
  description: string;
  category: Transaction["category"];
  accountId: string;
}

const DEMO_TRANSACTION_SEEDS: DemoTransactionSeed[] = [
  { daysAgo: 0, type: "expense", amountMinor: 8342, description: "Albert Heijn", category: "boodschappen", accountId: DEMO_ACCOUNT_IDS.ingChecking },
  { daysAgo: 0, type: "expense", amountMinor: 1599, description: "Netflix", category: "abonnementen", accountId: DEMO_ACCOUNT_IDS.ingChecking },
  { daysAgo: 1, type: "expense", amountMinor: 25000, description: "Apple Store", category: "shopping", accountId: DEMO_ACCOUNT_IDS.raboChecking },
  { daysAgo: 2, type: "expense", amountMinor: 4750, description: "Shell Tankstation", category: "vervoer", accountId: DEMO_ACCOUNT_IDS.ingChecking },
  { daysAgo: 3, type: "expense", amountMinor: 12995, description: "Coolblue", category: "shopping", accountId: DEMO_ACCOUNT_IDS.raboChecking },
  { daysAgo: 4, type: "expense", amountMinor: 6230, description: "Jumbo", category: "boodschappen", accountId: DEMO_ACCOUNT_IDS.ingChecking },
  { daysAgo: 5, type: "expense", amountMinor: 999, description: "Spotify", category: "abonnementen", accountId: DEMO_ACCOUNT_IDS.ingChecking },
  { daysAgo: 6, type: "expense", amountMinor: 3450, description: "NS Reizigers", category: "vervoer", accountId: DEMO_ACCOUNT_IDS.ingChecking },
  { daysAgo: 7, type: "expense", amountMinor: 5800, description: "Bioscoop Pathé", category: "entertainment", accountId: DEMO_ACCOUNT_IDS.raboChecking },
  { daysAgo: 8, type: "expense", amountMinor: 129500, description: "Huur Woning", category: "wonen", accountId: DEMO_ACCOUNT_IDS.ingChecking },
  { daysAgo: 9, type: "expense", amountMinor: 4899, description: "Zilveren Kruis", category: "gezondheid", accountId: DEMO_ACCOUNT_IDS.ingChecking },
  { daysAgo: 10, type: "expense", amountMinor: 8760, description: "Albert Heijn", category: "boodschappen", accountId: DEMO_ACCOUNT_IDS.ingChecking },
  { daysAgo: 11, type: "expense", amountMinor: 3200, description: "Uber", category: "vervoer", accountId: DEMO_ACCOUNT_IDS.raboChecking },
  { daysAgo: 12, type: "income", amountMinor: 42500, description: "Salaris", category: "salaris", accountId: DEMO_ACCOUNT_IDS.ingChecking },
  { daysAgo: 13, type: "expense", amountMinor: 6540, description: "Bol.com", category: "shopping", accountId: DEMO_ACCOUNT_IDS.raboChecking },
  { daysAgo: 15, type: "expense", amountMinor: 7200, description: "Restaurant De Kroon", category: "entertainment", accountId: DEMO_ACCOUNT_IDS.raboChecking },
  { daysAgo: 17, type: "expense", amountMinor: 9450, description: "Albert Heijn", category: "boodschappen", accountId: DEMO_ACCOUNT_IDS.ingChecking },
  { daysAgo: 18, type: "transfer", amountMinor: 50000, description: "Naar Rabobank Sparen", category: "overboeking", accountId: DEMO_ACCOUNT_IDS.ingChecking },
  { daysAgo: 20, type: "expense", amountMinor: 3999, description: "Ziggo", category: "abonnementen", accountId: DEMO_ACCOUNT_IDS.ingChecking },
  { daysAgo: 22, type: "expense", amountMinor: 18500, description: "Decathlon", category: "shopping", accountId: DEMO_ACCOUNT_IDS.raboChecking },
  { daysAgo: 25, type: "expense", amountMinor: 45000, description: "Vliegtickets KLM", category: "vakantie", accountId: DEMO_ACCOUNT_IDS.raboChecking },
  { daysAgo: 28, type: "expense", amountMinor: 8100, description: "Jumbo", category: "boodschappen", accountId: DEMO_ACCOUNT_IDS.ingChecking },
  { daysAgo: 30, type: "expense", amountMinor: 129500, description: "Huur Woning", category: "wonen", accountId: DEMO_ACCOUNT_IDS.ingChecking },
  { daysAgo: 32, type: "income", amountMinor: 42500, description: "Salaris", category: "salaris", accountId: DEMO_ACCOUNT_IDS.ingChecking },
  { daysAgo: 35, type: "expense", amountMinor: 2450, description: "NS Reizigers", category: "vervoer", accountId: DEMO_ACCOUNT_IDS.ingChecking },
  { daysAgo: 40, type: "expense", amountMinor: 6800, description: "Albert Heijn", category: "boodschappen", accountId: DEMO_ACCOUNT_IDS.ingChecking },
];

export function buildDemoTransactions(): Transaction[] {
  return DEMO_TRANSACTION_SEEDS.map((seed) => {
    const createdAt = daysAgo(seed.daysAgo);
    return {
      id: generateId(),
      type: seed.type,
      amountMinor: seed.amountMinor,
      description: seed.description,
      category: seed.category,
      accountId: seed.accountId,
      date: createdAt,
      origin: "demo" as const,
      createdAt,
      updatedAt: createdAt,
    };
  });
}

export function buildDemoBudgets(): Budget[] {
  const month = monthKey();
  const budgetAmounts: Array<[Transaction["category"], number]> = [
    ["boodschappen", 50_000],
    ["wonen", 130_000],
    ["vervoer", 25_000],
    ["entertainment", 12_000],
    ["abonnementen", 8_000],
    ["shopping", 20_000],
  ];
  return budgetAmounts.map(([category, amountMinor]) => {
    const createdAt = monthsAgo(1);
    return {
      id: generateId(),
      category,
      month,
      amountMinor,
      createdAt,
      updatedAt: createdAt,
    };
  });
}

export function buildDemoPortfolioSnapshots(finalNetWorthMinor: number): PortfolioSnapshot[] {
  const months = 12;
  const growthPerMonth = 0.985;
  const snapshots: PortfolioSnapshot[] = [];
  let value = finalNetWorthMinor;
  const values: number[] = [];
  for (let i = 0; i <= months; i++) {
    values.unshift(Math.round(value));
    value = value * growthPerMonth;
  }
  values.forEach((netWorthMinor, index) => {
    const date = monthsAgo(months - index);
    snapshots.push({
      id: generateId(),
      date,
      netWorthMinor,
      cashMinor: Math.round(netWorthMinor * 0.42),
      investmentsMinor: Math.round(netWorthMinor * 0.66),
      liabilitiesMinor: Math.round(netWorthMinor * 0.08),
    });
  });
  return snapshots;
}
