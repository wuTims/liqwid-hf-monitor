/**
 * Liqwid Client - GraphQL API client for Liqwid Finance
 * 
 * This module implements the new LiqwidClient interface as defined in the
 * liqwid-worker-design.md document. It provides two main functions:
 * 1. fetchLoansSnapshot - For health factor monitoring
 * 2. fetchMarketPrices - For Notion price updates
 */

// Import types
import { AppConfig } from '../models.js';
import { SimpleCache } from '../cache/simpleCache.js';

/**
 * Loan information returned from Liqwid
 */
export interface LoanInfo {
  id: string;
  healthFactor: number;
  assetSymbol: string;
  priceADA: number;
  collaterals: CollateralInfo[];
  LTV?: number; // Optional as per design doc
}

/**
 * Collateral information for a loan
 */
export interface CollateralInfo {
  id: string;
  assetSymbol: string;
  qTokenName: string;
  qTokenAmount: number;
  healthFactor: number;
  exchangeRate: number;
}

/**
 * Asset price information
 */
export interface AssetPrice {
  priceADA: number;        // Price in ADA
  exchangeRate: number;    // qToken to underlying ratio
  updatedAt: string;       // ISO timestamp
  priceUpdatedAt: string;  // ISO timestamp from oracle
}

/**
 * Error classes for Liqwid client
 */
export class LiqwidClientError extends Error {
  constructor(message: string, public originalError?: unknown) {
    super(`Liqwid client error: ${message}`);
    this.name = 'LiqwidClientError';
  }
}

/**
 * GraphQL queries for Liqwid Finance API
 */
const LIQWID_QUERIES = {
  /**
   * Loans query for health factor monitoring
   * Returns loan data including collaterals and health factors
   */
  LOANS_SNAPSHOT: `
    query GetLoansSnapshot($addresses: [String!]!) {
      liqwid {
        data {
          loans(input: { paymentKeys: $addresses }) {
            results {
              id
              healthFactor
              LTV
              asset {
                symbol
                price
              }
              collaterals {
                id
                asset {
                  symbol
                }
                qTokenName
                qTokenAmount
                healthFactor
                market {
                  exchangeRate
                }
              }
            }
          }
        }
      }
    }
  `,

  /**
   * Markets query for price updates
   * Returns asset prices and qToken exchange rates for specified markets
   */
  MARKET_PRICES: `
    query GetMarketPrices($marketIds: [String!]) {
      liqwid {
        data {
          markets(input: { ids: $marketIds }) {
            results {
              asset {
                id
                symbol
                price
                priceUpdatedAt
              }
              exchangeRate
              updatedAt
            }
          }
        }
      }
    }
  `,
};

/* SimpleCache implementation moved to ./cache/simpleCache.ts */

/**
 * Liqwid Client interface
 */
export interface LiqwidClient {
  /**
   * Fetch loans snapshot for health factor monitoring
   */
  fetchLoansSnapshot(opts: {
    paymentAddress: string;
  }): Promise<LoanInfo[]>;

  /**
   * Fetch market prices for Notion updates
   */
  fetchMarketPrices(opts: {
    symbols: string[];
  }): Promise<Record<string, AssetPrice>>;
}

/**
 * Liqwid GraphQL client implementation
 */
export class LiqwidGraphQLClient implements LiqwidClient {
  private config: AppConfig;
  private cache: SimpleCache<any>;
  
  // Cache TTL settings (in seconds)
  private readonly LOANS_CACHE_TTL = 60;      // 1 minute
  private readonly PRICES_CACHE_TTL = 300;    // 5 minutes
  
  constructor(config: AppConfig) {
    // Validate required config properties
    if (!config.LIQWID_GRAPHQL_URL) {
      throw new Error('LIQWID_GRAPHQL_URL is required for LiqwidClient');
    }
    
    this.config = config;
    this.cache = new SimpleCache();
  }

  /**
   * Fetch loans snapshot for health factor monitoring
   */
  async fetchLoansSnapshot(opts: { paymentAddress: string }): Promise<LoanInfo[]> {
    if (!opts.paymentAddress) {
      throw new LiqwidClientError('Payment address is required');
    }
    
    const cacheKey = `loans:${opts.paymentAddress}`;
    const cachedData = this.cache.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    try {
      const response = await this.executeGraphQL(
        LIQWID_QUERIES.LOANS_SNAPSHOT,
        { addresses: [opts.paymentAddress] }
      );
      
      // Transform the response into our domain model
      const loans = this.transformLoansResponse(response);
      
      // Cache the result
      this.cache.set(cacheKey, loans, this.LOANS_CACHE_TTL);
      
      return loans;
    } catch (error) {
      throw new LiqwidClientError(
        `Failed to fetch loans for address ${opts.paymentAddress}`,
        error
      );
    }
  }

  /**
   * Fetch market prices for Notion updates
   */
  async fetchMarketPrices(opts: { symbols: string[] }): Promise<Record<string, AssetPrice>> {
    if (!opts.symbols || opts.symbols.length === 0) {
      throw new LiqwidClientError('At least one symbol is required');
    }
    
    const cacheKey = `prices:${opts.symbols.sort().join(',')}`;
    const cachedData = this.cache.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    try {
      const response = await this.executeGraphQL(
        LIQWID_QUERIES.MARKET_PRICES,
        { marketIds: opts.symbols }
      );
      
      // Transform the response into our domain model
      const prices = this.transformPricesResponse(response);
      
      // Cache the result
      this.cache.set(cacheKey, prices, this.PRICES_CACHE_TTL);
      
      return prices;
    } catch (error) {
      throw new LiqwidClientError(
        `Failed to fetch prices for symbols: ${opts.symbols.join(', ')}`,
        error
      );
    }
  }

  /**
   * Execute a GraphQL query against the Liqwid API
   */
  private async executeGraphQL<T>(query: string, variables: Record<string, any>): Promise<T> {
    try {
      const response = await fetch(this.config.LIQWID_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.config.USER_AGENT || 'CardanoDefiHelper/1.0',
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as { data: T, errors?: any[] };
      
      if (data.errors && data.errors.length > 0) {
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
      }
      
      if (!data.data) {
        throw new Error('GraphQL response missing data');
      }
      
      return data.data;
    } catch (error) {
      if (error instanceof Error) {
        throw new LiqwidClientError(error.message, error);
      }
      throw new LiqwidClientError('Unknown error occurred', error);
    }
  }

  /**
   * Transform loans response from API to domain model
   */
  private transformLoansResponse(response: any): LoanInfo[] {
    try {
      const loans = response?.liqwid?.data?.loans?.results || [];
      
      return loans.map((loan: any) => ({
        id: loan.id,
        healthFactor: parseFloat(loan.healthFactor),
        assetSymbol: loan.asset.symbol,
        priceADA: parseFloat(loan.asset.price),
        LTV: loan.LTV ? parseFloat(loan.LTV) : undefined,
        collaterals: (loan.collaterals || []).map((col: any) => ({
          id: col.id,
          assetSymbol: col.asset.symbol,
          qTokenName: col.qTokenName,
          qTokenAmount: parseFloat(col.qTokenAmount),
          healthFactor: parseFloat(col.healthFactor),
          exchangeRate: parseFloat(col.market.exchangeRate),
        })),
      }));
    } catch (error) {
      throw new LiqwidClientError('Failed to transform loans response', error);
    }
  }

  /**
   * Transform prices response from API to domain model
   */
  private transformPricesResponse(response: any): Record<string, AssetPrice> {
    try {
      const markets = response?.liqwid?.data?.markets?.results || [];
      const prices: Record<string, AssetPrice> = {};
      
      for (const market of markets) {
        const symbol = market.asset.symbol;
        
        prices[symbol] = {
          priceADA: parseFloat(market.asset.price),
          exchangeRate: parseFloat(market.exchangeRate),
          updatedAt: market.updatedAt,
          priceUpdatedAt: market.asset.priceUpdatedAt,
        };
      }
      
      return prices;
    } catch (error) {
      throw new LiqwidClientError('Failed to transform prices response', error);
    }
  }
}

/**
 * Create a new Liqwid client with the given configuration
 * 
 * @param config Application configuration or subset with Liqwid properties
 * @returns A new Liqwid client instance
 */
export function createLiqwidClient(config: Partial<AppConfig>): LiqwidClient {
  // Convert partial config to full AppConfig with defaults
  const fullConfig: AppConfig = {
    // Default values for required AppConfig properties
    LIQWID_GRAPHQL_URL: '',
    PAYMENT_ADDRESS: '',
    USER_AGENT: 'CardanoDefiHelper/1.0',
    HF_WARN: 1.5,
    HF_CRIT: 1.2,
    TELEGRAM_TOKEN: '',
    CHATID: '',
    // Override with provided values
    ...config
  };
  
  return new LiqwidGraphQLClient(fullConfig);
}
