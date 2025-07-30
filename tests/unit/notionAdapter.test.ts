/**
 * Unit tests for the Notion adapter
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NotionAdapter, createNotionAdapter } from '../../src/lib/adapters/notionAdapter.js';
import { PriceInfo } from '../../src/lib/models/price.js';
import { NotionClient } from '../../src/lib/clients/notionClient.js';

// Create a direct mock client for tests
function createMockNotionClient() {
  return {
    updatePriceDatabase: vi.fn().mockResolvedValue({
      updated: 3,
      errors: []
    }),
    queryPricesDatabase: vi.fn().mockResolvedValue([]),
    createPriceRow: vi.fn().mockResolvedValue({}),
    updatePriceRow: vi.fn().mockResolvedValue({}),
    createPropertiesPayload: vi.fn().mockReturnValue({})
  };
}

describe('NotionAdapter', () => {
  // Sample test data
  const samplePrices: Record<string, PriceInfo> = {
    'ADA': {
      priceADA: 1.0,
      exchangeRate: 0.98,
      updatedAt: '2025-07-28T09:00:00Z',
      sourceUpdatedAt: '2025-07-28T09:00:00Z'
    },
    'SNEK': {
      priceADA: 0.003,
      exchangeRate: 0.95,
      updatedAt: '2025-07-28T09:00:00Z',
      sourceUpdatedAt: '2025-07-28T09:00:00Z'
    }
  };

  // Test configuration
  const config = {
    NOTION_PRICES_DB_ID: 'test-db-id',
    NOTION_API_TOKEN: 'test-token'
  };

  // Reset mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should create a NotionAdapter instance', () => {
    const adapter = createNotionAdapter(config);
    expect(adapter).toBeInstanceOf(NotionAdapter);
  });

  it('should update price database using direct API', async () => {
    // Create test data
    const prices: Record<string, PriceInfo> = {
      ADA: {
        priceADA: 1,
        exchangeRate: 1,
        updatedAt: new Date().toISOString(),
        sourceUpdatedAt: new Date().toISOString()
      },
      SNEK: {
        priceADA: 0.01,
        exchangeRate: 100,
        updatedAt: new Date().toISOString(),
        sourceUpdatedAt: new Date().toISOString()
      },
      LQ: {
        priceADA: 0.5,
        exchangeRate: 2,
        updatedAt: new Date().toISOString(),
        sourceUpdatedAt: new Date().toISOString()
      }
    };
    
    // Create a mock client
    const mockClient = createMockNotionClient();
    
    // Create adapter with API token
    const adapter = createNotionAdapter({
      NOTION_PRICES_DB_ID: 'test-db-id',
      NOTION_API_TOKEN: 'test-token'
    });
    
    // Set the mock client directly
    adapter.setClient(mockClient as any);
    
    // Update the price database
    const result = await adapter.updatePriceDatabase(prices);
    
    // Verify the results
    expect(result.updated).toBe(3);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle missing API token', async () => {
    const adapter = createNotionAdapter({
      NOTION_PRICES_DB_ID: 'test-db-id'
      // No API token
    });
    
    const result = await adapter.updatePriceDatabase(samplePrices);

    // Verify the result shows an error due to missing token
    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].symbol).toBe('all');
    expect(result.errors[0].error).toContain('NOTION_API_TOKEN not provided');
  });

  it('should throw error if NOTION_PRICES_DB_ID is missing when initializing client', async () => {
    const adapter = createNotionAdapter({
      // No database ID
      NOTION_API_TOKEN: 'test-token'
    });
    
    // Should throw when trying to initialize the client
    await expect(adapter.updatePriceDatabase(samplePrices)).rejects.toThrow('NOTION_PRICES_DB_ID is required');
  });
});
