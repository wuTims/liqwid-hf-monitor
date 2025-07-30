/**
 * Integration test for the Notion update flow
 * 
 * This test demonstrates the full flow of fetching prices and updating Notion,
 * but using mocks to avoid making real API calls.
 */
import { vi } from 'vitest';

// No need to mock the entire module anymore, we'll create mock clients directly

import { describe, it, expect, beforeEach } from 'vitest';
import { createNotionAdapter } from '../../src/lib/adapters/notionAdapter.js';
import { PriceInfo } from '../../src/lib/models/price.js';
import { LiqwidPriceProvider } from '../../src/lib/providers/liqwidPriceProvider.js';
import { NotionClientConfig } from '../../src/lib/clients/notionClient.js';
import { MockLiqwidClient, createMockPrices } from '../mocks/liqwidMock.js';

// Create a direct mock client for tests
function createMockNotionClient() {
  return {
    updatePriceDatabase: vi.fn().mockResolvedValue({
      updated: 4,
      errors: []
    }),
    queryPricesDatabase: vi.fn().mockResolvedValue([]),
    createPriceRow: vi.fn().mockResolvedValue({}),
    updatePriceRow: vi.fn().mockResolvedValue({}),
    createPropertiesPayload: vi.fn().mockReturnValue({})
  };
}

describe('Notion Update Integration', () => {
  let mockLiqwidClient: MockLiqwidClient;
  let priceProvider: LiqwidPriceProvider;
  let notionAdapter: ReturnType<typeof createNotionAdapter>;
  
  // Test configuration
  const config = {
    NOTION_PRICES_DB_ID: 'test-db-id',
    NOTION_API_TOKEN: 'test-token'
  };
  
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Create mock Liqwid client with predefined prices
    mockLiqwidClient = new MockLiqwidClient();
    mockLiqwidClient.setMockPrices(createMockPrices());
    
    // Create price provider with mock client
    priceProvider = new LiqwidPriceProvider(mockLiqwidClient);
    
    // Create Notion adapter and set a mock client
    notionAdapter = createNotionAdapter(config);
    notionAdapter.setClient(createMockNotionClient() as any);
  });
  
  it('should fetch prices and update Notion database', async () => {
    // Define symbols to fetch
    const symbols = ['ADA', 'SNEK', 'LQ', 'MIN'];
    
    // Fetch prices using the price provider
    const prices = await priceProvider.getPrices(symbols);
    
    // Verify prices were fetched correctly
    expect(Object.keys(prices)).toHaveLength(4);
    expect(prices).toHaveProperty('ADA');
    expect(prices).toHaveProperty('SNEK');
    expect(prices).toHaveProperty('LQ');
    expect(prices).toHaveProperty('MIN');
    
    // Update Notion database with the prices
    const result = await notionAdapter.updatePriceDatabase(prices);
    
    // Verify the update was successful
    expect(result.updated).toBe(4);
    expect(result.errors).toHaveLength(0);
  });
  
  it('should handle errors when fetching prices', async () => {
    // Make the mock client throw an error
    mockLiqwidClient.fetchMarketPrices = async () => {
      throw new Error('Test error');
    };
    
    // Expect the price provider to propagate the error
    await expect(priceProvider.getPrices(['ADA'])).rejects.toThrow('Failed to fetch prices from Liqwid');
  });
  
  it('should handle errors when updating Notion', async () => {
    // Create a mock that throws an error
    const errorMock = {
      updatePriceDatabase: vi.fn().mockRejectedValue(new Error('Notion API error')),
      queryPricesDatabase: vi.fn(),
      createPriceRow: vi.fn(),
      updatePriceRow: vi.fn(),
      createPropertiesPayload: vi.fn()
    };
    
    // Fetch prices using the price provider
    const prices = await priceProvider.getPrices(['ADA']);
    
    // Create a new adapter with the error mock client
    const errorAdapter = createNotionAdapter(config);
    errorAdapter.setClient(errorMock as any);
    
    // Expect the update to fail
    await expect(errorAdapter.updatePriceDatabase(prices)).rejects.toThrow('Notion API error');
  });
});
