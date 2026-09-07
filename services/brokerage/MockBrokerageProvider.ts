import type { Investment, InvestmentTransaction } from "@/types/models";
import type { BrokerageProvider } from "@/types/providers";
import { buildDemoInvestmentTransactions, buildDemoInvestments } from "@/features/demoData/fixtures";

export class MockBrokerageProvider implements BrokerageProvider {
  readonly id = "mock-brokerage";
  readonly isMock = true;

  async getPortfolio(): Promise<Investment[]> {
    return buildDemoInvestments();
  }

  async getTransactions(): Promise<InvestmentTransaction[]> {
    return buildDemoInvestmentTransactions();
  }
}

export const mockBrokerageProvider = new MockBrokerageProvider();
