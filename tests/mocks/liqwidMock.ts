/**
 * Mock implementation of the Liqwid client for testing
 */
import { LiqwidClient, LoanInfo, AssetPrice } from '../../src/lib/liqwidClient.js';

/**
 * Mock implementation of the Liqwid client for testing
 * This allows tests to run without making actual API calls to Liqwid
 */
export class MockLiqwidClient implements LiqwidClient {
  private mockLoans: LoanInfo[] = [];
  private mockPrices: Record<string, AssetPrice> = {};

  /**
   * Set mock loan data to be returned by fetchLoansSnapshot
   */
  setMockLoans(loans: LoanInfo[]) {
    this.mockLoans = loans;
  }

  /**
   * Set mock price data to be returned by fetchMarketPrices
   */
  setMockPrices(prices: Record<string, AssetPrice>) {
    this.mockPrices = prices;
  }

  /**
   * Fetch loans snapshot for health factor monitoring
   * Returns mock data instead of making API calls
   */
  async fetchLoansSnapshot(_opts: { paymentAddress: string }): Promise<LoanInfo[]> {
    return [...this.mockLoans];
  }

  /**
   * Fetch market prices for Notion updates
   * Returns mock data instead of making API calls
   */
  async fetchMarketPrices(_opts: { symbols: string[] }): Promise<Record<string, AssetPrice>> {
    // Filter prices to only include requested symbols if specified
    if (_opts.symbols && _opts.symbols.length > 0) {
      const filteredPrices: Record<string, AssetPrice> = {};
      for (const symbol of _opts.symbols) {
        if (symbol in this.mockPrices) {
          filteredPrices[symbol] = this.mockPrices[symbol];
        }
      }
      return filteredPrices;
    }
    
    return { ...this.mockPrices };
  }
}

/**
 * Create mock loan data for testing
 */
export function createMockLoans(): LoanInfo[] {
  return [
    {
      id: 'loan-1',
      healthFactor: 1.8,
      assetSymbol: 'ADA',
      priceADA: 1.0,
      collaterals: [
        {
          id: 'collateral-1',
          assetSymbol: 'SNEK',
          qTokenName: 'qSNEK',
          qTokenAmount: 1000,
          healthFactor: 1.8,
          exchangeRate: 0.95
        }
      ]
    },
    {
      id: 'loan-2',
      healthFactor: 1.4,
      assetSymbol: 'MIN',
      priceADA: 0.025,
      collaterals: [
        {
          id: 'collateral-2',
          assetSymbol: 'LQ',
          qTokenName: 'qLQ',
          qTokenAmount: 100,
          healthFactor: 1.4,
          exchangeRate: 0.92
        }
      ]
    }
  ];
}

/**
 * Create mock price data for testing
 */
export function createMockPrices(): Record<string, AssetPrice> {
  const now = new Date().toISOString();
  
  return {
    'ADA': {
      priceADA: 1.0,
      exchangeRate: 0.98,
      updatedAt: now,
      priceUpdatedAt: now
    },
    'SNEK': {
      priceADA: 0.003,
      exchangeRate: 0.95,
      updatedAt: now,
      priceUpdatedAt: now
    },
    'LQ': {
      priceADA: 3.5,
      exchangeRate: 0.92,
      updatedAt: now,
      priceUpdatedAt: now
    },
    'MIN': {
      priceADA: 0.025,
      exchangeRate: 0.97,
      updatedAt: now,
      priceUpdatedAt: now
    }
  };
}

/**
 * Create a new mock Liqwid client with optional initial mock data
 */
export function createMockLiqwidClient(options?: {
  loans?: LoanInfo[];
  prices?: Record<string, AssetPrice>;
}): MockLiqwidClient {
  const client = new MockLiqwidClient();
  
  if (options?.loans) {
    client.setMockLoans(options.loans);
  } else {
    client.setMockLoans(createMockLoans());
  }
  
  if (options?.prices) {
    client.setMockPrices(options.prices);
  } else {
    client.setMockPrices(createMockPrices());
  }
  
  return client;
}
