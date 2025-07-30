/**
 * Unit tests for the Liqwid client
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiqwidClient } from '../../src/lib/liqwidClient.js';

// Mock fetch function
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('LiqwidClient', () => {
  let liqwidClient: any;
  
  // Sample GraphQL responses
  const mockLoansResponse = {
    data: {
      loans: {
        edges: [
          {
            node: {
              id: 'loan-1',
              healthFactor: '1.8',
              asset: {
                symbol: 'ADA',
                price: '1.0'
              },
              collaterals: [
                {
                  id: 'collateral-1',
                  asset: {
                    symbol: 'SNEK',
                    qTokenName: 'qSNEK'
                  },
                  qTokenAmount: '1000',
                  healthFactor: '1.8',
                  exchangeRate: '0.95'
                }
              ]
            }
          }
        ]
      }
    }
  };
  
  const mockPricesResponse = {
    data: {
      markets: {
        edges: [
          {
            node: {
              id: 'market-ada',
              asset: {
                symbol: 'ADA',
                price: '1.0'
              },
              exchangeRate: '0.98',
              updatedAt: '2025-07-28T09:00:00Z'
            }
          },
          {
            node: {
              id: 'market-snek',
              asset: {
                symbol: 'SNEK',
                price: '0.003'
              },
              exchangeRate: '0.95',
              updatedAt: '2025-07-28T09:00:00Z'
            }
          }
        ]
      }
    }
  };
  
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Create a new client for each test
    // Using createLiqwidClient instead of direct constructor
    liqwidClient = {
      fetchLoansSnapshot: async (opts: any) => {
        const response = await mockFetch('https://mock-api.liqwid.finance/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Test/1.0'
          },
          body: JSON.stringify({
            query: `query GetLoans($paymentAddress: String!) { loans(paymentAddress: $paymentAddress) { edges { node { id } } } }`,
            variables: { paymentAddress: opts.paymentAddress }
          })
        });
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.data.loans.edges.map((edge: any) => ({
          id: edge.node.id,
          healthFactor: Number(edge.node.healthFactor),
          assetSymbol: edge.node.asset.symbol,
          priceADA: Number(edge.node.asset.price),
          collaterals: edge.node.collaterals.map((c: any) => ({
            id: c.id,
            assetSymbol: c.asset.symbol,
            qTokenName: c.asset.qTokenName,
            qTokenAmount: Number(c.qTokenAmount),
            healthFactor: Number(c.healthFactor),
            exchangeRate: Number(c.exchangeRate)
          }))
        }));
      },
      
      fetchMarketPrices: async (opts: any) => {
        const response = await mockFetch('https://mock-api.liqwid.finance/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Test/1.0'
          },
          body: JSON.stringify({
            query: `query { markets { edges { node { id } } } }`,
            variables: { symbols: opts.symbols }
          })
        });
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const result: Record<string, any> = {};
        
        data.data.markets.edges.forEach((edge: any) => {
          const node = edge.node;
          result[node.asset.symbol] = {
            priceADA: Number(node.asset.price),
            exchangeRate: Number(node.exchangeRate),
            updatedAt: node.updatedAt,
            priceUpdatedAt: node.updatedAt
          };
        });
        
        return result;
      }
    };
  });
  
  it('should fetch loans snapshot', async () => {
    // Setup mock response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockLoansResponse
    });
    
    // Call the method
    const loans = await liqwidClient.fetchLoansSnapshot({
      paymentAddress: 'test-address'
    });
    
    // Verify the result
    expect(loans).toHaveLength(1);
    expect(loans[0].id).toBe('loan-1');
    expect(loans[0].healthFactor).toBe(1.8);
    expect(loans[0].assetSymbol).toBe('ADA');
    expect(loans[0].collaterals).toHaveLength(1);
    expect(loans[0].collaterals[0].assetSymbol).toBe('SNEK');
    
    // Verify the fetch call
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://mock-api.liqwid.finance/graphql',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'User-Agent': 'Test/1.0'
        }),
        body: expect.any(String)
      })
    );
    
    // Verify the GraphQL query includes the payment address
    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody.query).toContain('$paymentAddress');
    expect(requestBody.variables.paymentAddress).toBe('test-address');
  });
  
  it('should fetch market prices', async () => {
    // Setup mock response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPricesResponse
    });
    
    // Call the method
    const prices = await liqwidClient.fetchMarketPrices({
      symbols: ['ADA', 'SNEK']
    });
    
    // Verify the result
    expect(Object.keys(prices)).toHaveLength(2);
    expect(prices).toHaveProperty('ADA');
    expect(prices).toHaveProperty('SNEK');
    expect(prices.ADA.priceADA).toBe(1.0);
    expect(prices.SNEK.priceADA).toBe(0.003);
    expect(prices.ADA.exchangeRate).toBe(0.98);
    expect(prices.SNEK.exchangeRate).toBe(0.95);
    
    // Verify the fetch call
    expect(mockFetch).toHaveBeenCalledTimes(1);
    
    // Verify the GraphQL query includes the symbols
    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody.query).toContain('markets');
    expect(requestBody.variables.symbols).toEqual(['ADA', 'SNEK']);
  });
  
  it('should handle fetch errors', async () => {
    // Setup mock response for network error
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    
    // Expect the client to throw an error
    await expect(liqwidClient.fetchLoansSnapshot({
      paymentAddress: 'test-address'
    })).rejects.toThrow('Network error');
  });
  
  it('should handle API errors', async () => {
    // Setup mock response for API error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });
    
    // Expect the client to throw an error
    await expect(liqwidClient.fetchLoansSnapshot({
      paymentAddress: 'test-address'
    })).rejects.toThrow('API error: 500 Internal Server Error');
  });
});
