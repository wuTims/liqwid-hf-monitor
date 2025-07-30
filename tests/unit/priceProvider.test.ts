/**
 * Unit tests for the price provider
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { LiqwidPriceProvider } from '../../src/lib/providers/liqwidPriceProvider.js';
import { MockLiqwidClient, createMockPrices } from '../mocks/liqwidMock.js';

describe('LiqwidPriceProvider', () => {
  let mockLiqwidClient: MockLiqwidClient;
  let priceProvider: LiqwidPriceProvider;
  
  beforeEach(() => {
    // Create a fresh mock client for each test
    mockLiqwidClient = new MockLiqwidClient();
    mockLiqwidClient.setMockPrices(createMockPrices());
    
    // Create the price provider with the mock client
    priceProvider = new LiqwidPriceProvider(mockLiqwidClient);
  });
  
  it('should have the correct name and source URL', () => {
    expect(priceProvider.getName()).toBe('Liqwid Finance');
    expect(priceProvider.getSourceUrl()).toBe('https://liqwid.finance/');
  });
  
  it('should return empty object for empty symbols array', async () => {
    const prices = await priceProvider.getPrices([]);
    expect(prices).toEqual({});
  });
  
  it('should fetch prices for specified symbols', async () => {
    const prices = await priceProvider.getPrices(['ADA', 'SNEK']);
    
    // Verify we got prices for both symbols
    expect(Object.keys(prices)).toHaveLength(2);
    expect(prices).toHaveProperty('ADA');
    expect(prices).toHaveProperty('SNEK');
    
    // Verify the price data structure
    expect(prices.ADA).toHaveProperty('priceADA');
    expect(prices.ADA).toHaveProperty('exchangeRate');
    expect(prices.ADA).toHaveProperty('updatedAt');
    
    // Verify the actual values match our mock data
    expect(prices.ADA.priceADA).toBe(1.0);
    expect(prices.SNEK.priceADA).toBe(0.003);
    expect(prices.ADA.exchangeRate).toBe(0.98);
  });
  
  it('should filter prices to only requested symbols', async () => {
    // Only request ADA
    const prices = await priceProvider.getPrices(['ADA']);
    
    // Should only have ADA, not SNEK, LQ, or MIN
    expect(Object.keys(prices)).toHaveLength(1);
    expect(prices).toHaveProperty('ADA');
    expect(prices).not.toHaveProperty('SNEK');
    expect(prices).not.toHaveProperty('LQ');
    expect(prices).not.toHaveProperty('MIN');
  });
  
  it('should handle errors from the client', async () => {
    // Make the mock client throw an error
    mockLiqwidClient.fetchMarketPrices = async () => {
      throw new Error('Test error');
    };
    
    // Expect the provider to propagate the error
    await expect(priceProvider.getPrices(['ADA'])).rejects.toThrow('Failed to fetch prices from Liqwid');
  });
});
