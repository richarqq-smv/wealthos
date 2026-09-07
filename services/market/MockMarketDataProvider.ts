import type { MarketDataProvider, MarketQuote } from "@/types/providers";
import { buildDemoInvestments } from "@/features/demoData/fixtures";

export class MockMarketDataProvider implements MarketDataProvider {
  readonly id = "mock-market-data";
  readonly isMock = true;

  async getQuote(ticker: string): Promise<MarketQuote> {
    const investment = buildDemoInvestments().find((inv) => inv.ticker === ticker);
    return {
      ticker,
      priceMinor: investment?.currentPriceMinor ?? 0,
      currency: investment?.currency ?? "EUR",
      asOf: new Date().toISOString(),
      isMock: true,
    };
  }
}

export const mockMarketDataProvider = new MockMarketDataProvider();
