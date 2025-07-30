/**
 * Mock implementation of the Notion client for testing
 */
import { AppConfig } from '../../src/lib/models.js';
import { PriceInfo } from '../../src/lib/models/price.js';

// Interface that matches the public methods of NotionClient we need to mock
interface NotionClientInterface {
  updatePriceDatabase(prices: Record<string, PriceInfo>): Promise<{
    updated: number;
    errors: Array<{ symbol: string; error: string }>;
  }>;
  queryPricesDatabase(): Promise<any[]>;
  createPriceRow(symbol: string, priceInfo: PriceInfo): Promise<any>;
  updatePriceRow(rowId: string, symbol: string, priceInfo: PriceInfo): Promise<any>;
  createPropertiesPayload(symbol: string, priceInfo: PriceInfo): any;
}

/**
 * Mock implementation of the Notion client for testing
 * This allows tests to run without making actual API calls to Notion
 */
export class MockNotionClient implements NotionClientInterface {
  private mockDatabase: Record<string, any> = {};
  private mockResults: { updated: number; errors: Array<{ symbol: string; error: string }> } = {
    updated: 0,
    errors: []
  };
  private shouldThrowError = false;
  private errorMessage = 'Mock Notion API error';

  // Configuration for the mock client
  config: AppConfig;
  
  /**
   * Create a new mock Notion client
   */
  constructor(config: AppConfig) {
    this.config = config;
  }

  /**
   * Set the mock results to be returned by updatePriceDatabase
   */
  setMockResults(results: { updated: number; errors: Array<{ symbol: string; error: string }> }) {
    this.mockResults = results;
  }

  /**
   * Configure the mock to throw an error on next API call
   */
  setThrowError(shouldThrow: boolean, message?: string) {
    this.shouldThrowError = shouldThrow;
    if (message) {
      this.errorMessage = message;
    }
  }

  /**
   * Get the current state of the mock database
   */
  getMockDatabase() {
    return this.mockDatabase;
  }

  /**
   * Update the mock database with price information
   * This simulates the behavior of the real Notion client without making API calls
   */
  async updatePriceDatabase(prices: Record<string, PriceInfo>): Promise<{
    updated: number;
    errors: Array<{ symbol: string; error: string }>;
  }> {
    if (this.shouldThrowError) {
      throw new Error(this.errorMessage);
    }

    // If mock results are set, return those
    if (this.mockResults.updated > 0 || this.mockResults.errors.length > 0) {
      return this.mockResults;
    }

    // Otherwise process each price
    let updated = 0;
    const errors: Array<{ symbol: string; error: string }> = [];

    for (const [symbol, priceInfo] of Object.entries(prices)) {
      try {
        // Store in mock database
        this.mockDatabase[symbol] = {
          symbol,
          priceADA: priceInfo.priceADA,
          exchangeRate: priceInfo.exchangeRate,
          updatedAt: priceInfo.updatedAt,
          sourceUpdatedAt: priceInfo.sourceUpdatedAt
        };
        
        updated++;
      } catch (error) {
        errors.push({
          symbol,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return { updated, errors };
  }

  /**
   * Mock implementation of queryPricesDatabase
   */
  async queryPricesDatabase(): Promise<any[]> {
    if (this.shouldThrowError) {
      throw new Error(this.errorMessage);
    }
    return Object.values(this.mockDatabase);
  }

  /**
   * Mock implementation of createPriceRow
   */
  async createPriceRow(symbol: string, priceInfo: PriceInfo): Promise<any> {
    if (this.shouldThrowError) {
      throw new Error(this.errorMessage);
    }
    const row = {
      id: `mock-row-${symbol}`,
      symbol,
      priceADA: priceInfo.priceADA,
      exchangeRate: priceInfo.exchangeRate
    };
    this.mockDatabase[symbol] = row;
    return row;
  }

  /**
   * Mock implementation of updatePriceRow
   */
  async updatePriceRow(rowId: string, symbol: string, priceInfo: PriceInfo): Promise<any> {
    if (this.shouldThrowError) {
      throw new Error(this.errorMessage);
    }
    const row = {
      id: rowId,
      symbol,
      priceADA: priceInfo.priceADA,
      exchangeRate: priceInfo.exchangeRate
    };
    this.mockDatabase[symbol] = row;
    return row;
  }

  /**
   * Mock implementation of createPropertiesPayload
   */
  createPropertiesPayload(symbol: string, priceInfo: PriceInfo): any {
    return {
      Symbol: { title: [{ text: { content: symbol } }] },
      'Price (ADA)': { number: priceInfo.priceADA },
      'Exchange Rate': { number: priceInfo.exchangeRate },
      'Updated At': { date: { start: priceInfo.updatedAt } },
      'Source Updated At': { date: { start: priceInfo.sourceUpdatedAt } }
    };
  }
}

/**
 * Create a new mock Notion client that implements the NotionClient interface
 */
export function createMockNotionClient(config: AppConfig): MockNotionClient {
  return new MockNotionClient(config);
}
